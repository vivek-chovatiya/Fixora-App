/**
 * HttpClient
 *
 * The single axios instance for the application.
 *
 * Nothing outside core/http constructs an axios instance, and no screen ever
 * imports axios. ApiService implementations are built on top of this client so
 * that auth headers, timeouts, logging and error normalisation are applied in
 * exactly one place.
 *
 * Since Phase 4A (17/11/2026) it also speaks the backend's envelope, so that no
 * service ever handles one:
 *
 * - success is `{ success: true, data, meta? }`, and `Http.*` resolve with
 *   `data` alone — `Http.getEnvelope` / `Http.postEnvelope` keep `meta` too, for
 *   the lists that page;
 * - failure is an HTTP status and `{ success: false, message, code, errors }`,
 *   and becomes one `AppError`: its kind from the status, its copy from the
 *   `code` (`AppError.messageForCode`), its field names from `errors`.
 *
 * Since Phase 4B (24/11/2026) it uploads files too (`Http.postForm`, the only
 * multipart call), and logs a refusal — a 4xx — below error level: it is the
 * backend answering, and only a server failing earns the red debug toast.
 *
 * ⚠️ Nothing the backend wrote in English reaches `userMessage`, and nothing the
 * request carried reaches the error. The axios error is deliberately not kept as
 * the `cause`: it holds the request body — a one-time code, a vendor's auth
 * code — and the Authorization header, and an error is logged, reported to the
 * crash reporter and passed around the UI. The cause is a small description of
 * the call instead. Joi's field messages are dropped for the same reason: one
 * that fails a pattern quotes the value it was given.
 */

import axios, {
  AxiosHeaders,
  type AxiosError,
  type AxiosInstance,
  type AxiosProgressEvent,
  type AxiosRequestConfig,
  type InternalAxiosRequestConfig,
} from 'axios';

import { AppConfig } from '@/core/config/AppConfig';
import { createLogger } from '@/core/logger/Logger';
import { AppError } from '@/shared/types/error';

const log = createLogger('HttpClient');

/**
 * Supplies the bearer token for outgoing requests. The auth module registers a
 * provider at startup, keeping this client unaware of how sessions are stored.
 */
type TokenProvider = () => string | null | undefined;

let tokenProvider: TokenProvider = () => null;

/**
 * Invoked when the server rejects the current session — and only the current
 * one: see `isCurrentSessionRejected`.
 */
type UnauthorizedHandler = () => void;

let onUnauthorized: UnauthorizedHandler = () => {};

export function setTokenProvider(provider: TokenProvider): void {
  tokenProvider = provider;
}

export function setUnauthorizedHandler(handler: UnauthorizedHandler): void {
  onUnauthorized = handler;
}

/** A request's options: axios's own, and the one this client adds. */
export interface HttpRequestConfig extends AxiosRequestConfig {
  /**
   * Keeps a 401 on this call from reaching the unauthorized handler.
   *
   * For signing out, and nothing else so far: a 401 there means the server had
   * already ended the session, the caller is clearing it anyway, and the handler
   * would start a second sign out alongside the first.
   */
  skipUnauthorizedHandler?: boolean;
}

/**
 * The pagination detail the backend sends beside a list
 * (`Fixora-Backend/src/utils/pagination.js`). Partial because it is read from a
 * response, not trusted: `BaseApiService.pageFromMeta` checks it.
 */
export interface HttpPageMeta {
  total: number;
  page: number;
  limit: number;
  pages: number;
  hasNextPage: boolean;
}

/** A successful response with the envelope removed, `meta` kept. */
export interface HttpEnvelope<T> {
  data: T;
  meta?: Partial<HttpPageMeta>;
}

/**
 * 401 codes that refuse a credential rather than a session.
 *
 * A vendor typing a wrong auth code has no session to end. Sending that refusal
 * to the unauthorized handler would, on a device where somebody is somehow still
 * signed in, sign them out for another person's typing mistake.
 */
const CREDENTIAL_REFUSAL_CODES: ReadonlySet<string> = new Set(['AUTH_CODE_INVALID']);

/**
 * A request as this client sends it: with the token it carried, kept so that its
 * 401 can be judged against the session it was sent for rather than whichever
 * one is signed in when the answer arrives.
 */
type SentConfig = InternalAxiosRequestConfig & { sentWithToken?: string };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * What an error may say about the call that failed: the method and the path.
 * Never the body, never the headers, never the full axios config.
 */
function describeCall(config: AxiosRequestConfig | undefined): { method?: string; url?: string } {
  return { method: config?.method, url: config?.url };
}

/**
 * Joi's `[{ field, message }]` as the app's field-error shape.
 *
 * The field names are kept; the backend's sentences are not. They are English
 * written for developers, and Joi's pattern message quotes the rejected value —
 * which for the auth code would put the credential in the error.
 */
function toFieldErrors(errors: unknown): Record<string, string> | undefined {
  if (!Array.isArray(errors)) {
    return undefined;
  }

  const fieldMessage = AppError.defaultMessage('validation');
  const entries = errors.flatMap((entry): [string, string][] =>
    isRecord(entry) && typeof entry.field === 'string' && entry.field !== ''
      ? [[entry.field, fieldMessage]]
      : [],
  );

  return entries.length > 0 ? Object.fromEntries(entries) : undefined;
}

/**
 * `Retry-After` as whole seconds, when the backend sent one in that form.
 *
 * The contract sends seconds. The header's other form, an HTTP date, is not
 * read: it would put the phone's clock in charge of how long the wait is.
 */
function readRetryAfter(headers: unknown): number | undefined {
  if (!isRecord(headers)) {
    return undefined;
  }
  const raw = AxiosHeaders.from(headers as Record<string, string>).get('Retry-After');
  const value = typeof raw === 'string' && /^\d+$/.test(raw.trim()) ? Number(raw.trim()) : raw;
  return typeof value === 'number' && Number.isInteger(value) && value >= 0 ? value : undefined;
}

interface FailureBody {
  message?: string;
  code?: string;
  fieldErrors?: Record<string, string>;
}

/** Reads a failure envelope without trusting its shape. */
function readFailureBody(body: unknown): FailureBody {
  if (!isRecord(body)) {
    return {};
  }

  return {
    message: typeof body.message === 'string' ? body.message : undefined,
    code: typeof body.code === 'string' && body.code !== '' ? body.code : undefined,
    fieldErrors: toFieldErrors(body.errors),
  };
}

/**
 * Removes the envelope from a successful response.
 *
 * A 2xx that is not an envelope is a server fault rather than data: handing it
 * on would leave every service to guess what it was given.
 */
function readEnvelope<T>(body: unknown, config: AxiosRequestConfig): HttpEnvelope<T> {
  if (isRecord(body) && body.success === true) {
    return {
      data: body.data as T,
      meta: isRecord(body.meta) ? (body.meta as Partial<HttpPageMeta>) : undefined,
    };
  }

  const failure = readFailureBody(body);
  log.error('response was not a success envelope', { url: config.url, code: failure.code });
  throw new AppError({
    kind: 'server',
    message: failure.message ?? 'Response was not a Fixora success envelope',
    code: failure.code,
    cause: describeCall(config),
  });
}

function createInstance(): AxiosInstance {
  const instance = axios.create({
    baseURL: AppConfig.api.baseUrl,
    timeout: AppConfig.api.timeoutMs,
    headers: { 'Content-Type': 'application/json' },
  });

  instance.interceptors.request.use((config: InternalAxiosRequestConfig) => {
    const token = tokenProvider();
    if (token) {
      config.headers.set('Authorization', `Bearer ${token}`);
      (config as SentConfig).sentWithToken = token;
    }
    log.debug('request', { method: config.method, url: config.url });
    return config;
  });

  instance.interceptors.response.use(
    response => response,
    (error: AxiosError) => Promise.reject(normalizeAxiosError(error)),
  );

  return instance;
}

/**
 * Whether a 401 ends the session that is signed in now.
 *
 * Only when the request carried that very session's token. A late answer to a
 * request sent for an account that has since signed out — and perhaps been
 * replaced by another — says nothing about the account signed in now, and
 * acting on it would sign the wrong person out. A request that carried no token
 * had no session to lose. A revoked session (the backend's token version) is
 * still the current token, so it still signs out.
 */
function isCurrentSessionRejected(appError: AppError, config: SentConfig | undefined): boolean {
  if (appError.kind !== 'unauthorized') {
    return false;
  }
  if (appError.code && CREDENTIAL_REFUSAL_CODES.has(appError.code)) {
    return false;
  }
  if ((config as HttpRequestConfig | undefined)?.skipUnauthorizedHandler) {
    return false;
  }
  const sentWith = config?.sentWithToken;
  return sentWith !== undefined && sentWith === tokenProvider();
}

/**
 * Converts an axios failure into the application's single error type. The
 * response body is trusted for its machine `code` and its field names only; the
 * user-facing message always comes from AppError, so the backend cannot inject
 * copy.
 */
function normalizeAxiosError(error: AxiosError): AppError {
  const call = describeCall(error.config);

  if (axios.isCancel(error)) {
    return new AppError({ kind: 'cancelled', message: 'Request cancelled', cause: call });
  }

  if (error.code === 'ECONNABORTED' || error.code === 'ETIMEDOUT') {
    return new AppError({ kind: 'timeout', message: error.message, cause: call });
  }

  if (!error.response) {
    return new AppError({ kind: 'network', message: error.message, cause: call });
  }

  const { status, data, headers } = error.response;
  const failure = readFailureBody(data);

  const appError = new AppError({
    kind: AppError.kindFromStatus(status),
    message: failure.message ?? error.message,
    code: failure.code,
    statusCode: status,
    retryAfterSeconds: readRetryAfter(headers),
    fieldErrors: failure.fieldErrors,
    cause: { ...call, status },
  });

  if (isCurrentSessionRejected(appError, error.config as SentConfig | undefined)) {
    onUnauthorized();
  }

  const details = { status, url: call.url, kind: appError.kind, code: appError.code };
  if (isAnswer(status)) {
    log.info('response refused', details);
  } else {
    log.error('response failed', details);
  }
  return appError;
}

/**
 * Whether a failed status is the backend answering rather than failing.
 *
 * A 4xx is a considered answer to this request — "no review yet"
 * (`REVIEW_NOT_FOUND`), "already accepted" (`REQUEST_NOT_CANCELLABLE`), a field
 * refused — and every service turns it into an outcome or its copy. Logged at
 * error level, each one raised the red debug toast over a screen that was
 * behaving exactly as designed (Phase 4B, 24/11/2026). A 5xx, or a status the
 * contract never uses, is the server failing, and stays an error. Transport
 * failures (no response, a timeout) are not logged here at all: the caller has
 * them as an AppError.
 */
function isAnswer(status: number): boolean {
  return status >= 400 && status < 500;
}

export const httpClient = createInstance();

async function send<T>(config: HttpRequestConfig): Promise<HttpEnvelope<T>> {
  const response = await httpClient.request<unknown>(config);
  return readEnvelope<T>(response.data, config);
}

/** A multipart POST's options: how far the body has gone, as it goes. */
export interface HttpFormOptions {
  /**
   * The share of the body sent so far, 0 to 1, as the platform reports it.
   * Not called while the size is unknown — a guess would draw a bar that jumps.
   */
  onProgress?: (fraction: number) => void;
}

/** What an upload progress event says, as a 0–1 fraction, or undefined when it cannot say. */
function progressOf(event: AxiosProgressEvent): number | undefined {
  const fraction =
    typeof event.progress === 'number'
      ? event.progress
      : typeof event.total === 'number' && event.total > 0
        ? event.loaded / event.total
        : undefined;
  return typeof fraction === 'number' && Number.isFinite(fraction)
    ? Math.min(1, Math.max(0, fraction))
    : undefined;
}

/**
 * Thin typed wrappers so ApiService implementations stay free of axios generics
 * and of the envelope. Each resolves with the envelope's `data`.
 */
export const Http = {
  async get<T>(url: string, config?: HttpRequestConfig): Promise<T> {
    return (await send<T>({ ...config, method: 'get', url })).data;
  },
  async post<T>(url: string, body?: unknown, config?: HttpRequestConfig): Promise<T> {
    return (await send<T>({ ...config, method: 'post', url, data: body })).data;
  },
  async put<T>(url: string, body?: unknown, config?: HttpRequestConfig): Promise<T> {
    return (await send<T>({ ...config, method: 'put', url, data: body })).data;
  },
  async patch<T>(url: string, body?: unknown, config?: HttpRequestConfig): Promise<T> {
    return (await send<T>({ ...config, method: 'patch', url, data: body })).data;
  },
  async delete<T>(url: string, config?: HttpRequestConfig): Promise<T> {
    return (await send<T>({ ...config, method: 'delete', url })).data;
  },
  /** As `get`, keeping `meta` — for a list that pages. */
  getEnvelope<T>(url: string, config?: HttpRequestConfig): Promise<HttpEnvelope<T>> {
    return send<T>({ ...config, method: 'get', url });
  },
  /** As `post`, keeping `meta` — the backend's list endpoints are POSTs. */
  postEnvelope<T>(url: string, body?: unknown, config?: HttpRequestConfig): Promise<HttpEnvelope<T>> {
    return send<T>({ ...config, method: 'post', url, data: body });
  },
  /**
   * A `multipart/form-data` POST — a file upload (Phase 4B, `/uploads`).
   *
   * ⚠️ The header must be said here. The instance's default is JSON, and axios
   * turns a FormData sent under a JSON header into JSON — the file part would
   * arrive as text and never as a file. Under `multipart/form-data` axios hands
   * the form to React Native untouched, and the platform writes the boundary.
   * The file itself is a `{ uri, name, type }` part the platform reads from
   * disk: nothing here holds its bytes.
   */
  async postForm<T>(url: string, form: FormData, options: HttpFormOptions = {}): Promise<T> {
    const { onProgress } = options;
    return (
      await send<T>({
        method: 'post',
        url,
        data: form,
        headers: { 'Content-Type': 'multipart/form-data' },
        // A file takes longer than a JSON call; every other request keeps the 30 s.
        timeout: AppConfig.api.uploadTimeoutMs,
        ...(onProgress
          ? {
              onUploadProgress: (event: AxiosProgressEvent) => {
                const fraction = progressOf(event);
                if (fraction !== undefined) {
                  onProgress(fraction);
                }
              },
            }
          : {}),
      })
    ).data;
  },
};
