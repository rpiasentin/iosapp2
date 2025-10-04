export function toNumber(value: unknown): number | null {
  if (value === null || value === undefined) {
    return null;
  }
  if (typeof value === 'number') {
    return Number.isNaN(value) ? null : value;
  }
  if (typeof value === 'string' && value.trim().length > 0) {
    const parsed = Number(value);
    return Number.isNaN(parsed) ? null : parsed;
  }
  return null;
}

export interface FormatNumberOptions {
  readonly unit?: string;
  readonly precision?: number;
  readonly fallback?: string;
}

export function formatNumber(value: number | null, options: FormatNumberOptions = {}): string {
  const { unit, precision, fallback = '—' } = options;
  if (value === null) {
    return fallback;
  }
  const suffix = unit ? ` ${unit}` : '';
  if (typeof precision === 'number') {
    return `${value.toFixed(precision)}${suffix}`;
  }
  return `${value.toLocaleString(undefined, {
    maximumFractionDigits: 2,
  })}${suffix}`;
}

export interface FormatPowerOptions {
  readonly decimals?: number;
  readonly fallback?: string;
}

export function formatPower(value: number | null, options: FormatPowerOptions = {}): string {
  const { decimals = 1, fallback = '—' } = options;
  if (value === null) {
    return fallback;
  }
  const abs = Math.abs(value);
  if (abs >= 1000) {
    const scaled = value / 1000;
    const fixed = Math.abs(scaled) >= 10 ? scaled.toFixed(1) : scaled.toFixed(decimals);
    return `${fixed} kW`;
  }
  const useDecimals = Math.abs(value) > 0 && Math.abs(value) < 10;
  return `${value.toFixed(useDecimals ? Math.max(decimals, 1) : 0)} W`;
}

export interface FormatPercentageOptions {
  readonly precision?: number;
  readonly fallback?: string;
}

export function formatPercentage(value: number | null, options: FormatPercentageOptions = {}): string {
  const { precision = 0, fallback = '—' } = options;
  if (value === null) {
    return fallback;
  }
  return `${value.toFixed(precision)}%`;
}

export interface FormatVoltageOptions {
  readonly precision?: number;
  readonly fallback?: string;
}

export function formatVoltage(value: number | null, options: FormatVoltageOptions = {}): string {
  const { precision = 1, fallback = '—' } = options;
  if (value === null) {
    return fallback;
  }
  return `${value.toFixed(precision)} V`;
}

export function formatRelativeTime(iso: string | null | undefined, fallback = '—'): string {
  if (!iso) {
    return fallback;
  }
  const ts = new Date(iso);
  if (Number.isNaN(ts.getTime())) {
    return fallback;
  }
  const diffMs = Date.now() - ts.getTime();
  const diffSec = Math.round(diffMs / 1000);
  const absSec = Math.abs(diffSec);
  if (absSec < 60) {
    return `${diffSec <= 0 ? 'now' : `${diffSec}s ago`}`;
  }
  const diffMin = Math.round(diffSec / 60);
  if (Math.abs(diffMin) < 60) {
    return diffMin <= 0 ? 'in <1m' : `${diffMin}m ago`;
  }
  const diffHr = Math.round(diffSec / 3600);
  if (Math.abs(diffHr) < 48) {
    return diffHr <= 0 ? `in ${Math.abs(diffHr)}h` : `${diffHr}h ago`;
  }
  const diffDay = Math.round(diffSec / 86400);
  return diffDay <= 0 ? `in ${Math.abs(diffDay)}d` : `${diffDay}d ago`;
}

export function formatDateTime(iso: string | null | undefined, fallback = '—'): string {
  if (!iso) {
    return fallback;
  }
  const ts = new Date(iso);
  if (Number.isNaN(ts.getTime())) {
    return fallback;
  }
  return ts.toLocaleString();
}

export function formatShortTime(iso: string | null | undefined, fallback = '—'): string {
  if (!iso) {
    return fallback;
  }
  const ts = new Date(iso);
  if (Number.isNaN(ts.getTime())) {
    return fallback;
  }
  return ts.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
}
