import { httpRequest, FetchFunction, RequestOptions } from "./http";
import { ApiError } from "./errors";
import {
  AlertsResponse,
  HealthResponse,
  InverterSample,
  PvHistoryResponse,
  SchedulerEventsResponse,
  SchedulerStatusResponse,
  ScheduleChangeRequest,
  VrmHealthResponse,
  HistoryKeysResponse,
  HistoryCustomResponse,
  VrmCodesResponse,
  VrmInstancesResponse,
  VrmDefaultsResponse,
  VrmDescriptionsResponse,
  VrmSamplesMetaResponse,
  VrmOverrideDefaultResponse,
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

export interface HistoryCustomParams {
  readonly left: string;
  readonly right?: string;
  readonly limit?: number;
  readonly windowHours?: number;
}

export interface VrmHistoryParams {
  readonly left: string;
  readonly right?: string;
  readonly limit?: number;
  readonly windowHours?: number;
  readonly leftInstance?: number;
  readonly rightInstance?: number;
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

  /** POST /schedule */
  public async scheduleChange(
    input: ScheduleChangeRequest,
    options?: RequestOverrides
  ): Promise<void> {
    const {
      source = "eg4",
      mode,
      day,
      hour,
      minute,
      delayHours,
      delayMinutes,
      key,
      value,
    } = input;

    const clampInt = (val: number, min: number, max: number) =>
      Math.min(max, Math.max(min, Math.round(val)));

    const toSafeInt = (val: number | undefined, fallback: number) =>
      typeof val === "number" && Number.isFinite(val) ? val : fallback;

    const form = new URLSearchParams();
    form.set("source", source);
    form.set("mode", mode);
    form.set("key", key ?? "");
    form.set("value", value ?? "");

    const safeDelayHours = clampInt(toSafeInt(delayHours, 0), 0, 48);
    const safeDelayMinutes = clampInt(toSafeInt(delayMinutes, 0), 0, 59);

    form.set("delay_hours", String(safeDelayHours));
    form.set("delay_minutes", String(safeDelayMinutes));

    if (mode === "absolute") {
      const todayIso = new Date().toISOString().slice(0, 10);
      const safeDay = (day ?? todayIso).trim() || todayIso;
      const safeHour = clampInt(toSafeInt(hour, 0), 0, 23);
      const safeMinute = clampInt(toSafeInt(minute, 0), 0, 59);
      form.set("day", safeDay);
      form.set("hour", String(safeHour));
      form.set("minute", String(safeMinute));
    } else {
      // Timer mode ignores absolute fields but we keep them present for compatibility.
      form.set("day", (day ?? "").trim());
      form.set("hour", String(clampInt(toSafeInt(hour, 0), 0, 23)));
      form.set("minute", String(clampInt(toSafeInt(minute, 0), 0, 59)));
    }

    const { headers, ...rest } = options ?? {};
    const merged = mergeHeaders(this.defaultHeaders, headers);
    const requestHeaders = {
      ...(merged ?? {}),
      Accept: "text/html,application/json",
      "Content-Type": "application/x-www-form-urlencoded",
    };

    await httpRequest<string>(this.baseUrl, "/schedule", this.fetchFn, {
      ...rest,
      method: "POST",
      body: form.toString(),
      headers: requestHeaders,
    });
  }

  /** GET /api/victron/health */
  public getVrmHealth(options?: RequestOverrides): Promise<VrmHealthResponse> {
    return this.request<VrmHealthResponse>("/api/victron/health", options);
  }

  /** GET /api/history/keys */
  public getHistoryKeys(options?: RequestOverrides): Promise<HistoryKeysResponse> {
    return this.request<HistoryKeysResponse>("/api/history/keys", options);
  }

  /** GET /api/history/custom */
  public getHistoryCustom(
    params: HistoryCustomParams,
    options?: RequestOverrides
  ): Promise<HistoryCustomResponse> {
    const { left, right, limit, windowHours } = params;
    return this.request<HistoryCustomResponse>("/api/history/custom", {
      ...options,
      query: {
        ...(options?.query ?? {}),
        left,
        right: right ?? left,
        ...(typeof limit === "number" ? { limit } : {}),
        ...(typeof windowHours === "number" ? { window_hours: windowHours } : {}),
      },
    });
  }

  /** GET /api/victron/history/codes */
  public getVrmHistoryCodes(options?: RequestOverrides): Promise<VrmCodesResponse> {
    return this.request<VrmCodesResponse>("/api/victron/history/codes", options);
  }

  /** GET /api/victron/devices/instances */
  public getVrmInstances(options?: RequestOverrides): Promise<VrmInstancesResponse> {
    return this.request<VrmInstancesResponse>("/api/victron/devices/instances", options);
  }

  /** GET /api/victron/devices/instance-codes */
  public getVrmInstanceCodes(
    instance: number,
    options?: RequestOverrides
  ): Promise<VrmCodesResponse> {
    return this.request<VrmCodesResponse>("/api/victron/devices/instance-codes", {
      ...options,
      query: {
        ...(options?.query ?? {}),
        instance,
      },
    });
  }

  /** GET /api/victron/history/custom-by-code */
  public getVrmHistoryByCode(
    params: VrmHistoryParams,
    options?: RequestOverrides
  ): Promise<HistoryCustomResponse> {
    const { left, right, limit, windowHours, leftInstance, rightInstance } = params;
    return this.request<HistoryCustomResponse>("/api/victron/history/custom-by-code", {
      ...options,
      query: {
        ...(options?.query ?? {}),
        left,
        right: right ?? left,
        ...(typeof limit === "number" ? { limit } : {}),
        ...(typeof windowHours === "number" ? { window_hours: windowHours } : {}),
        ...(typeof leftInstance === "number" ? { linst: leftInstance } : {}),
        ...(typeof rightInstance === "number" ? { rinst: rightInstance } : {}),
      },
    });
  }

  /** GET /api/victron/history/defaults */
  public getVrmHistoryDefaults(
    options?: RequestOverrides
  ): Promise<VrmDefaultsResponse> {
    return this.request<VrmDefaultsResponse>(
      "/api/victron/history/defaults",
      options
    );
  }

  /** GET /api/victron/history/descriptions */
  public getVrmHistoryDescriptions(
    options?: RequestOverrides
  ): Promise<VrmDescriptionsResponse> {
    return this.request<VrmDescriptionsResponse>(
      "/api/victron/history/descriptions",
      options
    );
  }

  /** GET /api/victron/samples/meta */
  public getVrmSamplesMeta(
    options?: RequestOverrides
  ): Promise<VrmSamplesMetaResponse> {
    return this.request<VrmSamplesMetaResponse>(
      "/api/victron/samples/meta",
      options
    );
  }

  /** POST /api/victron/history/override-default */
  public overrideVrmHistoryDefault(
    side: "left" | "right",
    code: string,
    options: RequestOverrides & { instance?: number } = {}
  ): Promise<VrmOverrideDefaultResponse> {
    const { instance, headers, ...rest } = options;
    return httpRequest<VrmOverrideDefaultResponse>(
      this.baseUrl,
      "/api/victron/history/override-default",
      this.fetchFn,
      {
        ...rest,
        method: "POST",
        body: {
          side,
          code,
          ...(typeof instance === "number" ? { inst: instance } : {}),
        },
        headers: mergeHeaders(this.defaultHeaders, headers),
      }
    );
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
