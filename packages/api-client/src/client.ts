import { httpRequest, FetchFunction, RequestOptions } from "./http";
import { ApiError } from "./errors";
import {
  AlertsResponse,
  HealthResponse,
  InverterSample,
  PvHistoryResponse,
  SchedulerEventsResponse,
  SchedulerStatusResponse,
} from "./types";
import { resolveBaseUrl, BaseUrlOptions } from "./config";

export interface ApiClientOptions extends BaseUrlOptions {
  /** Custom fetch implementation (defaults to global fetch). */
  readonly fetchFn?: FetchFunction;
  /** Default timeout applied to each request in milliseconds. */
  readonly timeoutMs?: number;
  /** Headers merged into every request (can be overridden per-call). */
  readonly defaultHeaders?: Record<string, string>;
}

export interface RequestOverrides extends Omit<RequestOptions, "method"> {
  readonly headers?: Record<string, string>;
  readonly timeoutMs?: number;
}

function ensureFetch(fetchFn?: FetchFunction): FetchFunction {
  if (fetchFn) {
    return fetchFn;
  }
  if (typeof fetch === "function") {
    return fetch.bind(globalThis);
  }
  throw new Error(
    "No fetch implementation available. Provide fetchFn when creating the API client."
  );
}

function mergeHeaders(
  base: Record<string, string> | undefined,
  overrides: Record<string, string> | undefined
): Record<string, string> | undefined {
  if (!base && !overrides) {
    return undefined;
  }
  return {
    ...(base ?? {}),
    ...(overrides ?? {}),
  };
}

export class ApiClient {
  private readonly baseUrl: string;
  private readonly fetchFn: FetchFunction;
  private readonly timeoutMs?: number;
  private readonly defaultHeaders?: Record<string, string>;

  constructor(options: ApiClientOptions = {}) {
    this.baseUrl = resolveBaseUrl(options);
    this.fetchFn = ensureFetch(options.fetchFn);
    this.timeoutMs = options.timeoutMs;
    this.defaultHeaders = options.defaultHeaders;
  }

  private request<T>(
    path: string,
    options: RequestOverrides = {}
  ): Promise<T> {
    const { headers, timeoutMs, ...rest } = options;
    return httpRequest<T>(this.baseUrl, path, this.fetchFn, {
      ...rest,
      headers: mergeHeaders(this.defaultHeaders, headers),
      timeoutMs: timeoutMs ?? this.timeoutMs,
    });
  }

  /** GET /api/health */
  public getHealth(options?: RequestOverrides): Promise<HealthResponse> {
    return this.request<HealthResponse>("/api/health", options);
  }

  /** GET /api/runtime */
  public getRuntime(options?: RequestOverrides): Promise<InverterSample> {
    return this.request<InverterSample>("/api/runtime", options);
  }

  /** GET /api/energy */
  public getEnergy(options?: RequestOverrides): Promise<InverterSample> {
    return this.request<InverterSample>("/api/energy", options);
  }

  /** GET /api/battery */
  public getBattery(options?: RequestOverrides): Promise<InverterSample> {
    return this.request<InverterSample>("/api/battery", options);
  }

  /** GET /api/history/pv */
  public getPvHistory(
    limit: number = 60,
    options?: RequestOverrides
  ): Promise<PvHistoryResponse> {
    return this.request<PvHistoryResponse>("/api/history/pv", {
      ...options,
      query: {
        ...(options?.query ?? {}),
        limit,
      },
    });
  }

  /** GET /api/alerts */
  public getAlerts(options?: RequestOverrides): Promise<AlertsResponse> {
    return this.request<AlertsResponse>("/api/alerts", options);
  }

  /** GET /api/scheduler/status */
  public getSchedulerStatus(
    options?: RequestOverrides
  ): Promise<SchedulerStatusResponse> {
    return this.request<SchedulerStatusResponse>(
      "/api/scheduler/status",
      options
    );
  }

  /** GET /api/scheduler/events */
  public getSchedulerEvents(
    limit: number = 50,
    options?: RequestOverrides
  ): Promise<SchedulerEventsResponse> {
    return this.request<SchedulerEventsResponse>("/api/scheduler/events", {
      ...options,
      query: {
        ...(options?.query ?? {}),
        limit,
      },
    });
  }

  /** Basic helper to validate connectivity; throws if the endpoint is unreachable. */
  public async ping(): Promise<HealthResponse> {
    try {
      return await this.getHealth();
    } catch (error) {
      if (error instanceof ApiError) {
        throw error;
      }
      throw new ApiError("Failed to reach inverter API", {
        status: 0,
        data: error,
      });
    }
  }
}

export function createApiClient(options?: ApiClientOptions): ApiClient {
  return new ApiClient(options);
}
