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
 * The client exists from day one even though the UI-first phase runs entirely on
 * mock services — building ApiService abstractions around its real shape now
 * avoids a migration later.
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

/**
 * Converts an axios failure into the application's single error type. Response
 * bodies are only trusted for field-level validation detail; the user-facing
 * message always comes from AppError so the backend cannot inject copy.
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
  const body = (data ?? {}) as { message?: string; errors?: Record<string, string> };

  const appError = new AppError({
    kind: AppError.kindFromStatus(status),
    message: body.message ?? error.message,
    statusCode: status,
    fieldErrors: body.errors,
    cause: error,
  });

  if (appError.kind === 'unauthorized') {
    onUnauthorized();
  }

  log.error('response failed', { status, url: error.config?.url, kind: appError.kind });
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
};
