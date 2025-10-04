export interface HealthResponse {
  readonly status: string;
  readonly base_url?: string | null;
  readonly serial?: string | null;
  readonly samples: {
    readonly count: number;
    readonly last_ts: string | null;
    readonly age_seconds: number | null;
  };
  readonly settings: {
    readonly last_full_read: string | null;
    readonly age_seconds: number | null;
  };
}

export type InverterSample = Record<string, unknown>;

export interface PvHistoryPoint {
  readonly ts: string | null;
  readonly vpv1?: number | null;
  readonly vpv2?: number | null;
  readonly vpv3?: number | null;
  readonly vpv4?: number | null;
  readonly soc?: number | null;
}

export interface PvHistoryResponse {
  readonly points: ReadonlyArray<PvHistoryPoint>;
}

export interface AlertsResponse {
  readonly eg4_settings_failed: boolean;
  readonly vrm_settings_failed: boolean;
  readonly eg4_reason: string | null;
  readonly vrm_reason: string | null;
}

export interface SchedulerStatusResponse {
  readonly last_tick: string | null;
  readonly last_status: string | null;
  readonly last_error: string | null;
  readonly due_count: number;
}

export interface SchedulerEvent {
  readonly ts: string;
  readonly level: string;
  readonly source: string;
  readonly message: string;
  readonly meta?: Record<string, unknown>;
}

export interface SchedulerEventsResponse {
  readonly events: ReadonlyArray<SchedulerEvent>;
}

export interface VrmHealthResponse {
  readonly configured: boolean;
  readonly system_id?: string | null;
  readonly samples: {
    readonly count: number;
    readonly last_ts: string | null;
  };
}

export interface HistoryKeysResponse {
  readonly keys: ReadonlyArray<string>;
}

export interface HistoryPoint {
  readonly ts: string | null;
  readonly left: number | null;
  readonly right: number | null;
}

export interface HistoryCustomResponse {
  readonly points: ReadonlyArray<HistoryPoint>;
}

export interface VrmCodesResponse {
  readonly codes: ReadonlyArray<string>;
}

export interface VrmInstanceItem {
  readonly instance: number;
  readonly idDeviceType?: number | string | null;
  readonly name?: string | null;
  readonly productName?: string | null;
  readonly productCode?: string | null;
}

export interface VrmInstancesResponse {
  readonly items: ReadonlyArray<VrmInstanceItem>;
}

export interface ChangeLogEntry {
  readonly id?: number;
  readonly ts?: string;
  readonly source?: string;
  readonly key?: string | null;
  readonly status?: string;
  readonly message?: string | null;
  readonly old_value?: unknown;
  readonly new_value?: unknown;
}

export interface ChangeLogResponse {
  readonly entries: ReadonlyArray<ChangeLogEntry>;
}

export interface ApiListResponse<TItem> {
  readonly items: ReadonlyArray<TItem>;
}
