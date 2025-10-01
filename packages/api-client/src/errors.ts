export interface ApiErrorOptions {
  readonly status: number;
  readonly data?: unknown;
  readonly headers?: Record<string, string>;
}

/**
 * Raised when the API responds with a non-2xx status code.
 */
export class ApiError extends Error {
  public readonly status: number;
  public readonly data?: unknown;
  public readonly headers?: Record<string, string>;

  constructor(message: string, { status, data, headers }: ApiErrorOptions) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.data = data;
    this.headers = headers;
  }
}
