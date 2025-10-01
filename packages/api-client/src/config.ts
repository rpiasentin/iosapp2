declare const process: { env?: Record<string, string | undefined> } | undefined;

export interface BaseUrlOptions {
  /** Optional override when you want to ignore the environment variables. */
  readonly baseUrl?: string;
  /** When true, trailing slashes are preserved instead of stripped. */
  readonly preserveTrailingSlash?: boolean;
}

const ENV_KEYS = [
  "EXPO_PUBLIC_API_BASE_URL",
  "API_BASE_URL",
  "REACT_NATIVE_API_BASE_URL",
];

function readEnvBaseUrl(): string | undefined {
  const env: Record<string, string | undefined> | undefined =
    typeof process !== "undefined" && process?.env
      ? (process.env as Record<string, string | undefined>)
      : undefined;

  if (!env) {
    return undefined;
  }

  for (const key of ENV_KEYS) {
    const value = env[key];
    if (value && value.trim().length > 0) {
      return value;
    }
  }
  return undefined;
}

function normalizeBaseUrl(input: string, preserveTrailingSlash = false): string {
  const trimmed = input.trim();
  if (!trimmed) {
    throw new Error("API base URL is empty");
  }
  const withoutTrailingSlash = trimmed.endsWith("/") && !preserveTrailingSlash
    ? trimmed.slice(0, -1)
    : trimmed;
  return withoutTrailingSlash;
}

/**
 * Resolve the base URL for API calls. When no override is provided, the function
 * falls back to well-known environment variables.
 */
export function resolveBaseUrl(options: BaseUrlOptions = {}): string {
  const candidate = options.baseUrl ?? readEnvBaseUrl();
  if (!candidate) {
    throw new Error(
      "Missing API base URL. Set EXPO_PUBLIC_API_BASE_URL (recommended) or pass baseUrl explicitly."
    );
  }
  return normalizeBaseUrl(candidate, options.preserveTrailingSlash ?? false);
}
