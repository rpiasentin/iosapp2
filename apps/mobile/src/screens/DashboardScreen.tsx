import React, { useMemo } from 'react';
import {
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
  Pressable,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';

import { Card, KeyValueRow, Section, StatusPill, type PillTone } from '@inverter/ui';

import { useDashboardData } from '../hooks/useDashboardData';
import {
  formatDateTime,
  formatNumber,
  formatPercentage,
  formatPower,
  formatRelativeTime,
  formatShortTime,
  formatVoltage,
  toNumber,
} from '../utils/format';

export interface DashboardScreenProps {
  readonly baseUrl: string;
  readonly onBack?: () => void;
}

interface MetricProps {
  readonly label: string;
  readonly value: string;
  readonly helper?: string;
  readonly tone?: 'default' | 'success' | 'warning' | 'danger';
}

function Metric({ label, value, helper, tone = 'default' }: MetricProps) {
  return (
    <View style={styles.metric}>
      <Text style={styles.metricLabel}>{label}</Text>
      <Text
        style={[
          styles.metricValue,
          tone === 'success'
            ? styles.metricValueSuccess
            : tone === 'warning'
            ? styles.metricValueWarning
            : tone === 'danger'
            ? styles.metricValueDanger
            : null,
        ]}
      >
        {value}
      </Text>
      {helper ? <Text style={styles.metricHelper}>{helper}</Text> : null}
    </View>
  );
}

function statusTone(status?: string | null): PillTone {
  const normalized = (status ?? '').toLowerCase();
  if (normalized === 'ok' || normalized === 'success') {
    return 'success';
  }
  if (normalized === 'warning' || normalized === 'warn') {
    return 'warning';
  }
  if (normalized === 'error' || normalized === 'failed' || normalized === 'fail') {
    return 'danger';
  }
  return 'neutral';
}

function eventTone(level?: string | null): PillTone {
  const normalized = (level ?? '').toLowerCase();
  if (normalized === 'success') {
    return 'success';
  }
  if (normalized === 'warning') {
    return 'warning';
  }
  if (normalized === 'error') {
    return 'danger';
  }
  return 'neutral';
}

const REQUIRED_BASE_URL_MESSAGE =
  'Missing EXPO_PUBLIC_API_BASE_URL. Add it to app config or .env before running the app.';

export function DashboardScreen({ baseUrl, onBack }: DashboardScreenProps) {
  const resolvedBaseUrl = useMemo(() => {
    if (!baseUrl) {
      throw new Error(REQUIRED_BASE_URL_MESSAGE);
    }
    return baseUrl;
  }, [baseUrl]);

  const { status, data, error, refreshing, refresh } = useDashboardData(resolvedBaseUrl);
  const initialLoading = status === 'loading' && !data;

  const runtime = (data?.runtime ?? {}) as Record<string, unknown>;
  const energy = (data?.energy ?? {}) as Record<string, unknown>;
  const battery = (data?.battery ?? {}) as Record<string, unknown>;

  const pvPower = toNumber(runtime['ppv']);
  const loadPower = toNumber(runtime['pToUser']);
  const gridPower = toNumber(runtime['pToGrid']);
  const batteryPower = toNumber(runtime['pDisCharge']);
  const epsPower = toNumber(runtime['peps']);
  const soc = toNumber(runtime['soc'] ?? battery['soc']);
  const batteryVoltageText = toNumber(battery['totalVoltageText']);
  const batteryVoltageRaw = toNumber(battery['vBat']);
  const batteryVoltage = batteryVoltageText ?? (batteryVoltageRaw !== null ? batteryVoltageRaw / 10 : null);
  const batteryCurrent = toNumber(battery['currentText']);
  const inverterTemperature = toNumber(runtime['tradiator1']);
  const batteryTemperature = toNumber(runtime['tBat']);

  const pv1RawDisplay = formatNumber(toNumber(runtime['vpv1']), { precision: 0, fallback: '—' });
  const pv1Helper = pv1RawDisplay === '—' ? undefined : `pv1 ${pv1RawDisplay}`;

  const batteryCurrentDisplay = formatNumber(batteryCurrent, { unit: 'A', precision: 1 });
  const batteryCurrentHelper = batteryCurrentDisplay === '—' ? undefined : batteryCurrentDisplay;

  const inverterTempDisplay = formatNumber(inverterTemperature, { unit: '°C', precision: 0 });
  const batteryTempDisplay = formatNumber(batteryTemperature, { unit: '°C', precision: 0 });
  const temperatureHelper = batteryTempDisplay === '—' ? undefined : `${batteryTempDisplay} battery`;

  const todayYield = toNumber(energy['todayYieldingText']);
  const todayUsage = toNumber(energy['todayUsageText']);
  const todayCharge = toNumber(energy['todayChargingText']);
  const totalYield = toNumber(energy['totalYieldingText']);
  const totalUsage = toNumber(energy['totalUsageText']);
  const totalCharge = toNumber(energy['totalChargingText']);

  const alerts = data?.alerts;
  const alertItems = alerts
    ? [
        alerts.eg4_settings_failed
          ? {
              source: 'EG4',
              reason: alerts.eg4_reason ?? 'Settings apply failed',
            }
          : null,
        alerts.vrm_settings_failed
          ? {
              source: 'Victron',
              reason: alerts.vrm_reason ?? 'Victron integration error',
            }
          : null,
      ].filter(Boolean)
    : [];

  const schedulerEvents = data?.schedulerEvents?.events?.slice(0, 8) ?? [];
  const historyPoints = data?.pvHistory?.points ? [...data.pvHistory.points.slice(-8)].reverse() : [];

  return (
    <View style={styles.screen}>
      <StatusBar style="dark" />
      <ScrollView
        contentInsetAdjustmentBehavior="automatic"
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing && !initialLoading}
            onRefresh={refresh}
            tintColor="#0f172a"
          />
        }
      >
        <View style={styles.headerRow}>
          <Text style={styles.appTitle}>Inverter Overview</Text>
          {onBack ? (
            <Pressable style={styles.headerButton} onPress={onBack} accessibilityRole="button">
              <Text style={styles.headerButtonText}>Back</Text>
            </Pressable>
          ) : null}
        </View>
        {data?.fetchedAt ? (
          <Text style={styles.updatedAt}>
            Last updated {formatRelativeTime(data.fetchedAt.toISOString())}
          </Text>
        ) : null}

        {initialLoading ? (
          <View style={styles.loadingState}>
            <ActivityIndicator size="large" color="#0f172a" />
            <Text style={styles.loadingLabel}>Loading inverter data…</Text>
          </View>
        ) : null}

        {error ? (
          <Card style={styles.errorCard}>
            <Text style={styles.errorTitle}>Unable to refresh data</Text>
            <Text style={styles.errorMessage}>{error}</Text>
          </Card>
        ) : null}

        {data ? (
          <>
            <Section title="System Health">
              <Card>
                <View style={styles.cardHeaderRow}>
                  <Text style={styles.cardHeadline}>FastAPI Backend</Text>
                  <StatusPill
                    label={(data.health.status ?? 'unknown').toUpperCase()}
                    tone={statusTone(data.health.status)}
                  />
                </View>
                <KeyValueRow label="Serial" value={data.health.serial ?? '—'} />
                <KeyValueRow label="Base URL" value={data.health.base_url ?? '—'} wrap />
                <KeyValueRow
                  label="Samples"
                  value={formatNumber(data.health.samples.count)}
                />
                <KeyValueRow
                  label="Last Sample"
                  value={`${formatDateTime(data.health.samples.last_ts)} (${formatRelativeTime(
                    data.health.samples.last_ts,
                  )})`}
                  wrap
                />
                <KeyValueRow
                  label="Settings Read"
                  value={formatDateTime(data.health.settings.last_full_read)}
                  wrap
                />
              </Card>
            </Section>

            <Section title="Alerts">
              {alertItems.length === 0 ? (
                <Card>
                  <Text style={styles.mutedText}>All clear. No active alerts from the backend.</Text>
                </Card>
              ) : (
                alertItems.map((item, index) => (
                  <Card key={`${item!.source}-${index}`} style={styles.alertCard}>
                    <View style={styles.cardHeaderRow}>
                      <Text style={styles.cardHeadline}>{item!.source}</Text>
                      <StatusPill label="ACTIVE" tone="danger" />
                    </View>
                    <Text style={styles.alertBody}>{item!.reason}</Text>
                  </Card>
                ))
              )}
            </Section>

            <Section title="Power Snapshot">
              <Card>
                <View style={styles.metricGrid}>
                  <Metric label="PV Output" value={formatPower(pvPower)} helper={pv1Helper} />
                  <Metric label="Load" value={formatPower(loadPower)} />
                  <Metric label="Grid Export" value={formatPower(gridPower)} />
                  <Metric
                    label="Battery"
                    value={formatPower(batteryPower)}
                    helper={
                      batteryPower !== null
                        ? batteryPower > 0
                          ? 'Discharging'
                          : batteryPower < 0
                          ? 'Charging'
                          : 'Idle'
                        : undefined
                    }
                  />
                  <Metric
                    label="SOC"
                    value={formatPercentage(soc)}
                    tone={soc !== null && soc < 20 ? 'warning' : 'default'}
                  />
                  <Metric
                    label="Battery Voltage"
                    value={formatVoltage(batteryVoltage)}
                    helper={batteryCurrentHelper}
                  />
                  <Metric label="EPS" value={formatPower(epsPower)} />
                  <Metric label="Temps" value={inverterTempDisplay} helper={temperatureHelper} />
                </View>
              </Card>
            </Section>

            <Section title="Energy (kWh)" subtitle="Values reported by the inverter">
              <Card>
                <View style={styles.metricGrid}>
                  <Metric
                    label="Today – PV"
                    value={formatNumber(todayYield, { unit: 'kWh', precision: 1 })}
                  />
                  <Metric
                    label="Today – Usage"
                    value={formatNumber(todayUsage, { unit: 'kWh', precision: 1 })}
                  />
                  <Metric
                    label="Today – Charge"
                    value={formatNumber(todayCharge, { unit: 'kWh', precision: 1 })}
                  />
                  <Metric
                    label="Total – PV"
                    value={formatNumber(totalYield, { unit: 'kWh', precision: 1 })}
                  />
                  <Metric
                    label="Total – Usage"
                    value={formatNumber(totalUsage, { unit: 'kWh', precision: 1 })}
                  />
                  <Metric
                    label="Total – Charge"
                    value={formatNumber(totalCharge, { unit: 'kWh', precision: 1 })}
                  />
                </View>
              </Card>
            </Section>

            <Section title="Scheduler">
              <Card>
                <View style={styles.cardHeaderRow}>
                  <Text style={styles.cardHeadline}>Status</Text>
                  <StatusPill
                    label={(data.schedulerStatus.last_status ?? 'idle').toUpperCase()}
                    tone={statusTone(data.schedulerStatus.last_status)}
                  />
                </View>
                <KeyValueRow
                  label="Last Tick"
                  value={`${formatDateTime(data.schedulerStatus.last_tick)} (${formatRelativeTime(
                    data.schedulerStatus.last_tick,
                  )})`}
                  wrap
                />
                <KeyValueRow
                  label="Pending"
                  value={formatNumber(data.schedulerStatus.due_count)}
                />
                <KeyValueRow
                  label="Last Error"
                  value={data.schedulerStatus.last_error ?? 'None'}
                  wrap
                />
              </Card>

              <Card>
                <Text style={styles.cardHeadline}>Recent Events</Text>
                {schedulerEvents.length === 0 ? (
                  <Text style={styles.mutedText}>No scheduler activity captured yet.</Text>
                ) : (
                  schedulerEvents.map((event, index) => (
                    <View key={`${event.ts}-${index}`} style={styles.eventRow}>
                      <View style={styles.eventHeader}>
                        <Text style={styles.eventTime}>{formatShortTime(event.ts)}</Text>
                        <StatusPill label={event.level.toUpperCase()} tone={eventTone(event.level)} />
                      </View>
                      <Text style={styles.eventMessage}>{event.message}</Text>
                      {event.meta ? (
                        <Text style={styles.eventMeta}>{JSON.stringify(event.meta)}</Text>
                      ) : null}
                    </View>
                  ))
                )}
              </Card>
            </Section>

            <Section title="PV History" subtitle="Most recent samples (raw values)">
              <Card>
                {historyPoints.length === 0 ? (
                  <Text style={styles.mutedText}>No history available yet.</Text>
                ) : (
                  historyPoints.map((point, index) => {
                    const pvValues = [point.vpv1, point.vpv2, point.vpv3, point.vpv4]
                      .map((value) => toNumber(value))
                      .filter((value): value is number => value !== null);
                    const pvSum = pvValues.reduce((total, value) => total + value, 0);
                    const pointSoc = toNumber(point.soc);
                    return (
                      <View key={`${point.ts}-${index}`} style={styles.historyRow}>
                        <View style={styles.historyHeader}>
                          <Text style={styles.historyTime}>{formatShortTime(point.ts)}</Text>
                          {pointSoc !== null ? (
                            <StatusPill label={`SOC ${formatPercentage(pointSoc)}`} tone="neutral" />
                          ) : null}
                        </View>
                        <Text style={styles.historyValues}>
                          Sum: {formatNumber(pvSum, { fallback: '—' })} · pv1 {formatNumber(
                            toNumber(point.vpv1),
                            { fallback: '—' },
                          )}
                          , pv2 {formatNumber(toNumber(point.vpv2), { fallback: '—' })}
                        </Text>
                      </View>
                    );
                  })
                )}
              </Card>
            </Section>
          </>
        ) : null}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#f1f5f9',
  },
  scrollContent: {
    paddingVertical: 24,
    paddingHorizontal: 20,
    gap: 20,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  appTitle: {
    fontSize: 28,
    fontWeight: '700',
    color: '#0f172a',
    flexShrink: 1,
  },
  headerButton: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: '#0f172a',
  },
  headerButtonText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 13,
    letterSpacing: 0.5,
  },
  updatedAt: {
    color: '#64748b',
    marginTop: 4,
  },
  loadingState: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    paddingVertical: 40,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  loadingLabel: {
    fontSize: 16,
    color: '#475569',
  },
  errorCard: {
    borderWidth: 1,
    borderColor: '#fee2e2',
    backgroundColor: '#fef2f2',
  },
  errorTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#b91c1c',
    marginBottom: 4,
  },
  errorMessage: {
    color: '#7f1d1d',
    fontSize: 14,
    lineHeight: 18,
  },
  cardHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
    gap: 12,
  },
  cardHeadline: {
    fontSize: 18,
    fontWeight: '600',
    color: '#0f172a',
    flexShrink: 1,
  },
  mutedText: {
    color: '#64748b',
    fontSize: 14,
  },
  alertCard: {
    borderLeftWidth: 4,
    borderLeftColor: '#dc2626',
  },
  alertBody: {
    color: '#991b1b',
    fontSize: 14,
    marginTop: 4,
  },
  metricGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 16,
  },
  metric: {
    width: '48%',
    minWidth: 140,
    gap: 4,
  },
  metricLabel: {
    fontSize: 13,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    color: '#64748b',
    fontWeight: '600',
  },
  metricValue: {
    fontSize: 20,
    fontWeight: '700',
    color: '#0f172a',
  },
  metricValueSuccess: {
    color: '#166534',
  },
  metricValueWarning: {
    color: '#b45309',
  },
  metricValueDanger: {
    color: '#b91c1c',
  },
  metricHelper: {
    fontSize: 13,
    color: '#64748b',
  },
  eventRow: {
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#e2e8f0',
    gap: 4,
  },
  eventHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  eventTime: {
    fontSize: 13,
    color: '#475569',
  },
  eventMessage: {
    fontSize: 15,
    color: '#0f172a',
    fontWeight: '500',
  },
  eventMeta: {
    fontSize: 12,
    color: '#94a3b8',
    fontFamily: 'Menlo',
  },
  historyRow: {
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#e2e8f0',
    gap: 4,
  },
  historyHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  historyTime: {
    fontSize: 13,
    color: '#475569',
  },
  historyValues: {
    fontSize: 14,
    color: '#0f172a',
  },
});

export default DashboardScreen;
