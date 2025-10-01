import { ApiError } from "./errors";

export type QueryValue = string | number | boolean | null | undefined;
export type QueryParam = QueryValue | QueryValue[];

export type FetchFunction = (
  input: RequestInfo | URL,
  init?: RequestInit
) => Promise<Response>;

export type HttpMethod = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";

export interface RequestOptions {
  readonly method?: HttpMethod;
  readonly query?: Record<string, QueryParam>;
  readonly body?: unknown;
  readonly headers?: Record<string, string>;
  readonly timeoutMs?: number;
}

interface PreparedRequest {
  readonly url: URL;
  readonly init: RequestInit;
}

function encodeQuery(query: Record<string, QueryParam>): string {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value === undefined || value === null) {
      continue;
    }
    if (Array.isArray(value)) {
      value.forEach((item) => {
        if (item === undefined || item === null) {
          return;
        }
        params.append(key, String(item));
      });
    } else {
      params.append(key, String(value));
    }
  }
  return params.toString();
}

function prepareRequest(
  baseUrl: string,
  path: string,
  { method = "GET", query, body, headers }: RequestOptions
): PreparedRequest {
  const sanitizedBase = baseUrl.endsWith("/") ? baseUrl : `${baseUrl}/`;
  const trimmedPath = path.startsWith("/") ? path.slice(1) : path;
  const url = new URL(trimmedPath, sanitizedBase);

  if (query) {
    const queryString = encodeQuery(query);
    if (queryString) {
      url.search = queryString;
    }
  }

  const finalHeaders: Record<string, string> = {
    Accept: "application/json",
    ...headers,
  };

  const init: RequestInit = {
    method,
    headers: finalHeaders,
  };

  if (body !== undefined && body !== null) {
    init.body = typeof body === "string" ? body : JSON.stringify(body);
    if (!finalHeaders["Content-Type"]) {
      finalHeaders["Content-Type"] = "application/json";
    }
  }

  return { url, init };
}

async function parseBody(response: Response): Promise<unknown> {
  const text = await response.text();
  if (!text) {
    return null;
  }
  try {
    return JSON.parse(text);
  } catch (_error) {
    return text;
  }
}

export async function httpRequest<T = unknown>(
  baseUrl: string,
  path: string,
  fetchFn: FetchFunction,
  options: RequestOptions = {}
): Promise<T> {
  const { timeoutMs, ...rest } = options;
  const { url, init } = prepareRequest(baseUrl, path, rest);

  const controller = typeof AbortController !== "undefined" ? new AbortController() : null;
  if (controller) {
    init.signal = controller.signal;
  }

  let timeoutHandle: ReturnType<typeof setTimeout> | undefined;
  if (controller && typeof timeoutMs === "number" && timeoutMs > 0) {
    timeoutHandle = setTimeout(() => controller.abort(), timeoutMs);
  }

  try {
    const response = await fetchFn(url, init);
    if (!response.ok) {
      const errorBody = await parseBody(response);
      const headerEntries: Array<[string, string]> = [];
      response.headers.forEach((value, key) => {
        headerEntries.push([key, value]);
      });
      throw new ApiError(`Request to ${url.pathname} failed with ${response.status}`, {
        status: response.status,
        data: errorBody,
        headers: Object.fromEntries(headerEntries),
      });
    }

    if (response.status === 204) {
      return null as T;
    }

    const data = (await parseBody(response)) as T;
    return data;
  } catch (error) {
    if (
      controller &&
      typeof DOMException !== "undefined" &&
      error instanceof DOMException &&
      error.name === "AbortError"
    ) {
      throw new ApiError(`Request to ${path} timed out`, {
        status: 408,
      });
    }
    throw error;
  } finally {
    if (timeoutHandle) {
      clearTimeout(timeoutHandle);
    }
  }
}
