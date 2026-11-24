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
 */

import axios, {
  type AxiosError,
  type AxiosInstance,
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

/** Invoked when the server rejects the current session. */
type UnauthorizedHandler = () => void;

let onUnauthorized: UnauthorizedHandler = () => {};

export function setTokenProvider(provider: TokenProvider): void {
  tokenProvider = provider;
}

export function setUnauthorizedHandler(handler: UnauthorizedHandler): void {
  onUnauthorized = handler;
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

interface ApiErrorBody {
  message?: string;
  code?: string;
  errors?: Array<{ field?: string; message?: string }> | Record<string, string> | null;
}

function toFieldErrors(errors: ApiErrorBody['errors']): Record<string, string> | undefined {
  if (!errors) {
    return undefined;
  }
  if (Array.isArray(errors)) {
    const result: Record<string, string> = {};
    errors.forEach(entry => {
      if (entry?.field && entry.message && !result[entry.field]) {
        result[entry.field] = entry.message;
      }
    });
    return Object.keys(result).length ? result : undefined;
  }
  return errors;
}

/** Client errors carry curated, user-safe copy from our own API; 5xx never does. */
const SERVER_COPY_STATUSES = new Set([400, 401, 403, 404, 409, 422, 429]);

/**
 * Converts an axios failure into the application's single error type. Raw axios
 * and server internals never reach the UI: 5xx and transport failures always use
 * AppError's own copy, while 4xx use the API's curated business message.
 */
function normalizeAxiosError(error: AxiosError): AppError {
  if (axios.isCancel(error)) {
    return new AppError({ kind: 'cancelled', message: 'Request cancelled', cause: error });
  }

  if (error.code === 'ECONNABORTED' || error.code === 'ETIMEDOUT') {
    return new AppError({ kind: 'timeout', message: error.message, cause: error });
  }

  if (!error.response) {
    return new AppError({ kind: 'network', message: error.message, cause: error });
  }

  const { status, data } = error.response;
  const body = (data ?? {}) as ApiErrorBody;
  const isSessionCall = String(error.config?.url ?? '').startsWith('/auth/login');

  const appError = new AppError({
    kind: AppError.kindFromStatus(status),
    message: body.message ?? error.message,
    userMessage:
      SERVER_COPY_STATUSES.has(status) && typeof body.message === 'string' ? body.message : undefined,
    statusCode: status,
    fieldErrors: toFieldErrors(body.errors),
    code: body.code,
    cause: error,
  });

  if (appError.kind === 'unauthorized' && !isSessionCall) {
    onUnauthorized();
  }

  log.warn('response failed', { status, url: error.config?.url, code: body.code });
  return appError;
}

export const httpClient = createInstance();

/** Thin typed wrappers so ApiService implementations stay free of axios generics. */
export const Http = {
  async get<T>(url: string, config?: AxiosRequestConfig): Promise<T> {
    const response = await httpClient.get<T>(url, config);
    return response.data;
  },
  async post<T>(url: string, body?: unknown, config?: AxiosRequestConfig): Promise<T> {
    const response = await httpClient.post<T>(url, body, config);
    return response.data;
  },
  async put<T>(url: string, body?: unknown, config?: AxiosRequestConfig): Promise<T> {
    const response = await httpClient.put<T>(url, body, config);
    return response.data;
  },
  async patch<T>(url: string, body?: unknown, config?: AxiosRequestConfig): Promise<T> {
    const response = await httpClient.patch<T>(url, body, config);
    return response.data;
  },
  async delete<T>(url: string, config?: AxiosRequestConfig): Promise<T> {
    const response = await httpClient.delete<T>(url, config);
    return response.data;
  },
  /** multipart/form-data upload. The boundary header is set by the platform. */
  async upload<T>(url: string, form: FormData, config?: AxiosRequestConfig): Promise<T> {
    const response = await httpClient.post<T>(url, form, {
      ...config,
      headers: { 'Content-Type': 'multipart/form-data' },
      transformRequest: payload => payload,
      timeout: AppConfig.api.timeoutMs * 2,
    });
    return response.data;
  },
};
