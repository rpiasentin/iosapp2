import React, { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  Pressable,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';

import { Card, KeyValueRow, Section, StatusPill } from '@inverter/ui';
import {
  ApiError,
  SchedulerScheduleMode,
  SettingsCatalogItem,
  createApiClient,
} from '@inverter/api-client';

import { useSchedulerFeed } from '../hooks/useSchedulerFeed';
import { useSettingsCatalog } from '../hooks/useSettingsCatalog';
import {
  formatDateTime,
  formatNumber,
  formatRelativeTime,
} from '../utils/format';

export interface SchedulerScreenProps {
  readonly baseUrl: string;
  readonly onBack: () => void;
  readonly onOpenLink: (url: string) => void;
}

interface DayOption {
  readonly iso: string;
  readonly label: string;
}

interface SubmitState {
  readonly error: string | null;
  readonly success: string | null;
}

function statusTone(status?: string | null): 'neutral' | 'success' | 'warning' | 'danger' {
  const normalized = (status ?? '').toLowerCase();
  if (normalized === 'success' || normalized === 'ok' || normalized === 'ready') {
    return 'success';
  }
  if (normalized === 'warning') {
    return 'warning';
  }
  if (normalized === 'failed' || normalized === 'error') {
    return 'danger';
  }
  return 'neutral';
}

function buildDayOptions(count: number = 7): DayOption[] {
  const now = new Date();
  const base = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  const options: DayOption[] = [];
  for (let i = 0; i < Math.max(1, count); i += 1) {
    const ts = base + i * 24 * 60 * 60 * 1000;
    const date = new Date(ts);
    const iso = date.toISOString().slice(0, 10);
    const label = date.toLocaleDateString(undefined, {
      weekday: 'short',
      year: 'numeric',
      month: 'short',
      day: '2-digit',
    });
    options.push({ iso, label });
  }
  return options;
}

function getErrorMessage(error: unknown): string {
  if (error instanceof ApiError) {
    return error.message;
  }
  if (error instanceof Error) {
    return error.message;
  }
  return 'Unable to schedule change';
}

export function SchedulerScreen({ baseUrl, onBack, onOpenLink }: SchedulerScreenProps) {
  const api = useMemo(() => createApiClient({ baseUrl }), [baseUrl]);
  const { status, data, error, refreshing, refresh } = useSchedulerFeed(baseUrl);
  const {
    status: catalogStatus,
    items: catalogItems,
    error: catalogError,
    refreshing: catalogRefreshing,
    refresh: refreshCatalog,
  } = useSettingsCatalog(baseUrl);

  const [showCatalog, setShowCatalog] = useState(false);

  const initialLoading = status === 'loading' && !data;

  const [mode, setMode] = useState<SchedulerScheduleMode>('timer');
  const dayOptions = useMemo(() => buildDayOptions(7), []);
  const [selectedDay, setSelectedDay] = useState<string>(dayOptions[0]?.iso ?? '');
  const [hour, setHour] = useState('0');
  const [minute, setMinute] = useState('0');
  const [delayHours, setDelayHours] = useState('0');
  const [delayMinutes, setDelayMinutes] = useState('5');
  const [settingKey, setSettingKey] = useState('');
  const [settingValue, setSettingValue] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [{ error: formError, success: formSuccess }, setSubmitState] = useState<SubmitState>({
    error: null,
    success: null,
  });

  const rawKeyQuery = settingKey.trim();
  const normalizedKeyQuery = rawKeyQuery.toLowerCase();
  const suggestionLimit = showCatalog ? 20 : 8;
  const truncatedKeyQuery =
    rawKeyQuery.length > 40 ? `${rawKeyQuery.slice(0, 37)}...` : rawKeyQuery;

  const suggestions = useMemo(() => {
    if (catalogItems.length === 0) {
      return [] as SettingsCatalogItem[];
    }
    if (!normalizedKeyQuery) {
      const essentials = catalogItems.filter((item) => item.category === 'Essentials');
      const others = catalogItems.filter((item) => item.category !== 'Essentials');
      return [...essentials, ...others].slice(0, suggestionLimit);
    }
    const scored = catalogItems
      .map((item) => {
        const keyLower = item.key.toLowerCase();
        const categoryLower = (item.category ?? '').toLowerCase();
        const valueLower = (item.value ?? '').toLowerCase();
        let score = 0;
        if (keyLower.startsWith(normalizedKeyQuery)) {
          score += 4;
        } else if (keyLower.includes(normalizedKeyQuery)) {
          score += 3;
        }
        if (categoryLower.includes(normalizedKeyQuery)) {
          score += 1;
        }
        if (valueLower.includes(normalizedKeyQuery)) {
          score += 1;
        }
        if ((item.category ?? '') === 'Essentials') {
          score += 0.5;
        }
        return { item, score };
      })
      .filter(({ score }) => score > 0)
      .sort((a, b) => {
        if (b.score !== a.score) {
          return b.score - a.score;
        }
        return a.item.key.localeCompare(b.item.key);
      })
      .map(({ item }) => item);

    if (scored.length === 0 && showCatalog) {
      return catalogItems.slice(0, suggestionLimit);
    }

    return scored.slice(0, suggestionLimit);
  }, [catalogItems, normalizedKeyQuery, showCatalog, suggestionLimit]);

  const showCatalogPanel = showCatalog || rawKeyQuery.length >= 1;
  const isCatalogLoading = catalogStatus === 'loading' || catalogRefreshing;

  const handleCatalogToggle = useCallback(() => {
    setShowCatalog((prev) => {
      const next = !prev;
      if (!prev && catalogStatus === 'error') {
        refreshCatalog();
      }
      return next;
    });
  }, [catalogStatus, refreshCatalog]);

  const handleSelectSuggestion = useCallback(
    (item: SettingsCatalogItem) => {
      setSettingKey(item.key);
      if (item.value !== undefined && item.value !== null) {
        setSettingValue(item.value);
      }
      setShowCatalog(false);
    },
    [],
  );

  const schedulerStatus = data?.status;
  const schedulerEvents = data?.events?.events ?? [];

  const handleSubmit = useCallback(async () => {
    const trimmedKey = settingKey.trim();
    if (!trimmedKey) {
      setSubmitState({ error: 'Setting key is required.', success: null });
      return;
    }
    if (mode === 'absolute' && !selectedDay) {
      setSubmitState({ error: 'Select a target day for absolute scheduling.', success: null });
      return;
    }

    setSubmitting(true);
    setSubmitState({ error: null, success: null });

    const parseIntSafe = (value: string, fallback: number) => {
      const parsed = Number.parseInt(value, 10);
      return Number.isNaN(parsed) ? fallback : parsed;
    };

    try {
      await api.scheduleChange({
        mode,
        day: selectedDay,
        hour: parseIntSafe(hour, 0),
        minute: parseIntSafe(minute, 0),
        delayHours: parseIntSafe(delayHours, 0),
        delayMinutes: parseIntSafe(delayMinutes, 0),
        key: trimmedKey,
        value: settingValue,
      });
      setSubmitState({ error: null, success: 'Change queued successfully.' });
      setSettingKey('');
      setSettingValue('');
      refresh();
    } catch (err) {
      setSubmitState({ error: getErrorMessage(err), success: null });
    } finally {
      setSubmitting(false);
    }
  }, [api, mode, selectedDay, hour, minute, delayHours, delayMinutes, settingKey, settingValue, refresh]);

  const handleOpenConsole = useCallback(() => {
    onOpenLink('/schedule');
  }, [onOpenLink]);

  return (
    <View style={styles.screen}>
      <StatusBar style="dark" />
      <ScrollView
        contentInsetAdjustmentBehavior="automatic"
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl
            refreshing={refreshing && !initialLoading}
            onRefresh={refresh}
            tintColor="#0f172a"
          />
        }
      >
        <View style={styles.headerRow}>
          <View style={styles.headerText}>
            <Text style={styles.heading}>Scheduler</Text>
            <Text style={styles.subheading}>Monitor queue activity and stage new setting applies.</Text>
          </View>
          <Pressable style={styles.headerButton} onPress={onBack} accessibilityRole="button">
            <Text style={styles.headerButtonLabel}>Back</Text>
          </Pressable>
        </View>
        {data?.fetchedAt ? (
          <Text style={styles.metaText}>Last updated {formatRelativeTime(data.fetchedAt.toISOString())}</Text>
        ) : null}

        {initialLoading ? (
          <View style={styles.loadingState}>
            <ActivityIndicator size="large" color="#0f172a" />
            <Text style={styles.loadingLabel}>Loading scheduler data…</Text>
          </View>
        ) : null}

        {error ? (
          <Card style={styles.errorCard}>
            <Text style={styles.errorTitle}>Unable to refresh scheduler</Text>
            <Text style={styles.errorMessage}>{error}</Text>
          </Card>
        ) : null}

        {schedulerStatus ? (
          <Section title="Overview">
            <Card style={styles.overviewCard}>
              <View style={styles.overviewHeader}>
                <Text style={styles.overviewTitle}>Queue health</Text>
                <StatusPill
                  label={(schedulerStatus.last_status ?? 'idle').toUpperCase()}
                  tone={statusTone(schedulerStatus.last_status)}
                />
              </View>
              <KeyValueRow
                label="Last tick"
                value={
                  schedulerStatus.last_tick
                    ? `${formatDateTime(schedulerStatus.last_tick)} (${formatRelativeTime(
                        schedulerStatus.last_tick,
                      )})`
                    : 'Never'
                }
                wrap
              />
              <KeyValueRow
                label="Pending changes"
                value={formatNumber(schedulerStatus.due_count)}
              />
              <KeyValueRow
                label="Last error"
                value={schedulerStatus.last_error ?? 'None'}
                wrap
              />
              <Pressable
                style={styles.consoleButton}
                onPress={handleOpenConsole}
                accessibilityRole="button"
              >
                <Text style={styles.consoleButtonLabel}>Open full scheduler console</Text>
              </Pressable>
            </Card>
          </Section>
        ) : null}

        <Section title="Recent activity">
          <Card>
            {schedulerEvents.length === 0 ? (
              <Text style={styles.mutedText}>No scheduler events captured yet.</Text>
            ) : (
              schedulerEvents.map((event, index) => (
                <View key={`${event.ts}-${index}`} style={styles.eventRow}>
                  <View style={styles.eventHeader}>
                    <Text style={styles.eventTime}>{formatRelativeTime(event.ts)}</Text>
                    <StatusPill label={event.level.toUpperCase()} tone={statusTone(event.level)} />
                  </View>
                  <Text style={styles.eventSource}>{event.source}</Text>
                  <Text style={styles.eventMessage}>{event.message}</Text>
                  {event.meta ? (
                    <Text style={styles.eventMeta}>{JSON.stringify(event.meta)}</Text>
                  ) : null}
                </View>
              ))
            )}
          </Card>
        </Section>

        <Section
          title="Schedule change"
          subtitle="Times are evaluated on the server in UTC."
        >
          <Card style={styles.formCard}>
            <View style={styles.modeRow}>
              {(['timer', 'absolute'] as const).map((value) => {
                const active = mode === value;
                return (
                  <Pressable
                    key={value}
                    style={[styles.modeChip, active ? styles.modeChipActive : null]}
                    onPress={() => setMode(value)}
                    accessibilityRole="button"
                  >
                    <Text style={[styles.modeChipLabel, active ? styles.modeChipLabelActive : null]}>
                      {value === 'timer' ? 'Timer' : 'Absolute'}
                    </Text>
                  </Pressable>
                );
              })}
            </View>

            {mode === 'absolute' ? (
              <View style={styles.absoluteSection}>
                <Text style={styles.inputLabel}>Target day (UTC)</Text>
                <View style={styles.dayRow}>
                  {dayOptions.map((option) => {
                    const active = option.iso === selectedDay;
                    return (
                      <Pressable
                        key={option.iso}
                        style={[styles.dayChip, active ? styles.dayChipActive : null]}
                        onPress={() => setSelectedDay(option.iso)}
                        accessibilityRole="button"
                      >
                        <Text style={[styles.dayChipLabel, active ? styles.dayChipLabelActive : null]}>
                          {option.label}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
                <View style={styles.inlineFieldRow}>
                  <View style={styles.inlineField}>
                    <Text style={styles.inputLabel}>Hour (24h)</Text>
                    <TextInput
                      value={hour}
                      onChangeText={setHour}
                      keyboardType="number-pad"
                      style={styles.input}
                      accessibilityLabel="Hour"
                      maxLength={2}
                    />
                  </View>
                  <View style={styles.inlineField}>
                    <Text style={styles.inputLabel}>Minute</Text>
                    <TextInput
                      value={minute}
                      onChangeText={setMinute}
                      keyboardType="number-pad"
                      style={styles.input}
                      accessibilityLabel="Minute"
                      maxLength={2}
                    />
                  </View>
                </View>
              </View>
            ) : (
              <View style={styles.timerSection}>
                <Text style={styles.inputLabel}>Delay from now</Text>
                <View style={styles.inlineFieldRow}>
                  <View style={styles.inlineField}>
                    <Text style={styles.inlineFieldHint}>Hours</Text>
                    <TextInput
                      value={delayHours}
                      onChangeText={setDelayHours}
                      keyboardType="number-pad"
                      style={styles.input}
                      accessibilityLabel="Delay hours"
                      maxLength={2}
                    />
                  </View>
                  <View style={styles.inlineField}>
                    <Text style={styles.inlineFieldHint}>Minutes</Text>
                    <TextInput
                      value={delayMinutes}
                      onChangeText={setDelayMinutes}
                      keyboardType="number-pad"
                      style={styles.input}
                      accessibilityLabel="Delay minutes"
                      maxLength={2}
                    />
                  </View>
                </View>
              </View>
            )}

            <View style={styles.fieldGroup}>
              <View style={styles.fieldHeader}>
                <Text style={styles.inputLabel}>Setting key</Text>
                <Pressable
                  style={styles.catalogToggle}
                  onPress={handleCatalogToggle}
                  accessibilityRole="button"
                >
                  <Text style={styles.catalogToggleLabel}>
                    {showCatalog ? 'Hide catalog' : 'Browse catalog'}
                  </Text>
                </Pressable>
              </View>
              <TextInput
                value={settingKey}
                onChangeText={setSettingKey}
                placeholder="e.g. time-of-use"
                style={styles.input}
                accessibilityLabel="Setting key"
                autoCapitalize="none"
              />
              {showCatalogPanel ? (
                <View style={styles.catalogPanel}>
                  {isCatalogLoading ? (
                    <View style={styles.catalogMessageRow}>
                      <ActivityIndicator size="small" color="#0f172a" />
                      <Text style={styles.catalogMessageText}>Loading catalog...</Text>
                    </View>
                  ) : catalogStatus === 'error' ? (
                    <View style={styles.catalogMessageRow}>
                      <Text style={styles.catalogErrorText}>
                        {catalogError ?? 'Unable to load settings catalog.'}
                      </Text>
                      <Pressable
                        style={styles.catalogRetryButton}
                        onPress={refreshCatalog}
                        accessibilityRole="button"
                      >
                        <Text style={styles.catalogRetryLabel}>Retry</Text>
                      </Pressable>
                    </View>
                  ) : catalogItems.length === 0 ? (
                    <Text style={styles.catalogEmptyText}>
                      Scheduler suggestions appear after the backend records a settings snapshot.
                    </Text>
                  ) : suggestions.length === 0 ? (
                    <Text style={styles.catalogEmptyText}>
                      {`No matches for "${truncatedKeyQuery}".`}
                    </Text>
                  ) : (
                    <>
                      <Text style={styles.catalogHint}>Tap a suggestion to autofill key and value.</Text>
                      <View style={styles.catalogList}>
                        {suggestions.map((item) => {
                          const previewRaw = item.value ?? '';
                          const preview =
                            previewRaw.length > 48
                              ? `${previewRaw.slice(0, 45)}...`
                              : previewRaw;
                          return (
                            <Pressable
                              key={item.key}
                              style={styles.catalogItem}
                              onPress={() => handleSelectSuggestion(item)}
                              accessibilityRole="button"
                            >
                              <Text style={styles.catalogItemKey}>{item.key}</Text>
                              <Text style={styles.catalogItemMeta}>
                                {item.category ?? 'Uncategorized'}
                                {preview ? ` • ${preview}` : ''}
                              </Text>
                            </Pressable>
                          );
                        })}
                      </View>
                    </>
                  )}
                </View>
              ) : null}
            </View>
            <View style={styles.fieldGroup}>
              <Text style={styles.inputLabel}>Value</Text>
              <TextInput
                value={settingValue}
                onChangeText={setSettingValue}
                placeholder="Payload to apply"
                style={[styles.input, styles.valueInput]}
                accessibilityLabel="Setting value"
                autoCapitalize="none"
                multiline
                numberOfLines={3}
                textAlignVertical="top"
              />
            </View>

            {formError ? <Text style={styles.formError}>{formError}</Text> : null}
            {formSuccess ? <Text style={styles.formSuccess}>{formSuccess}</Text> : null}

            <Pressable
              style={[styles.submitButton, submitting ? styles.submitButtonDisabled : null]}
              onPress={handleSubmit}
              disabled={submitting}
              accessibilityRole="button"
            >
              <Text style={styles.submitButtonLabel}>
                {submitting ? 'Scheduling…' : 'Queue change'}
              </Text>
            </Pressable>
          </Card>
        </Section>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#f1f5f9',
  },
  content: {
    paddingVertical: 24,
    paddingHorizontal: 20,
    gap: 24,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 16,
  },
  headerText: {
    flexShrink: 1,
    flexGrow: 1,
    gap: 6,
  },
  heading: {
    fontSize: 24,
    fontWeight: '700',
    color: '#0f172a',
  },
  subheading: {
    color: '#334155',
    fontSize: 14,
  },
  headerButton: {
    alignSelf: 'flex-start',
    backgroundColor: '#0f172a',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 999,
  },
  headerButtonLabel: {
    color: '#ffffff',
    fontWeight: '600',
    letterSpacing: 0.4,
  },
  metaText: {
    color: '#64748b',
  },
  loadingState: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    paddingVertical: 40,
  },
  loadingLabel: {
    color: '#334155',
  },
  errorCard: {
    borderLeftWidth: 4,
    borderLeftColor: '#b91c1c',
    gap: 8,
  },
  errorTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#b91c1c',
  },
  errorMessage: {
    color: '#7f1d1d',
  },
  overviewCard: {
    gap: 12,
  },
  overviewHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  overviewTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#0f172a',
  },
  consoleButton: {
    marginTop: 4,
    paddingVertical: 10,
  },
  consoleButtonLabel: {
    color: '#1d4ed8',
    fontWeight: '600',
  },
  mutedText: {
    color: '#64748b',
  },
  eventRow: {
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
    gap: 6,
  },
  eventHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  eventTime: {
    fontSize: 13,
    color: '#475569',
  },
  eventSource: {
    fontSize: 12,
    fontWeight: '600',
    color: '#1e293b',
  },
  eventMessage: {
    color: '#0f172a',
  },
  eventMeta: {
    fontFamily: 'Courier',
    fontSize: 12,
    color: '#475569',
  },
  formCard: {
    gap: 16,
  },
  modeRow: {
    flexDirection: 'row',
    gap: 12,
  },
  modeChip: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#0f172a',
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: '#ffffff',
  },
  modeChipActive: {
    backgroundColor: '#0f172a',
  },
  modeChipLabel: {
    fontWeight: '600',
    color: '#0f172a',
  },
  modeChipLabelActive: {
    color: '#ffffff',
  },
  absoluteSection: {
    gap: 12,
  },
  timerSection: {
    gap: 12,
  },
  dayRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  dayChip: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#1e293b',
    paddingHorizontal: 14,
    paddingVertical: 6,
    backgroundColor: '#ffffff',
  },
  dayChipActive: {
    backgroundColor: '#1e293b',
  },
  dayChipLabel: {
    color: '#1e293b',
    fontWeight: '600',
  },
  dayChipLabelActive: {
    color: '#ffffff',
  },
  inlineFieldRow: {
    flexDirection: 'row',
    gap: 16,
  },
  inlineField: {
    flex: 1,
    gap: 6,
  },
  inputLabel: {
    fontWeight: '600',
    color: '#0f172a',
  },
  inlineFieldHint: {
    fontWeight: '600',
    color: '#0f172a',
  },
  fieldGroup: {
    gap: 6,
  },
  fieldHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  input: {
    borderWidth: 1,
    borderColor: '#cbd5f5',
    borderRadius: 10,
    backgroundColor: '#ffffff',
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 16,
    color: '#0f172a',
  },
  valueInput: {
    minHeight: 80,
  },
  catalogToggle: {
    backgroundColor: '#e2e8f0',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
  },
  catalogToggleLabel: {
    color: '#0f172a',
    fontWeight: '600',
  },
  catalogPanel: {
    marginTop: 8,
    borderWidth: 1,
    borderColor: '#cbd5f5',
    borderRadius: 10,
    backgroundColor: '#f8fafc',
    padding: 12,
    gap: 8,
  },
  catalogMessageRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  catalogMessageText: {
    color: '#334155',
    flexShrink: 1,
  },
  catalogErrorText: {
    color: '#b91c1c',
    fontWeight: '600',
    flex: 1,
  },
  catalogRetryButton: {
    backgroundColor: '#0f172a',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
  },
  catalogRetryLabel: {
    color: '#ffffff',
    fontWeight: '600',
  },
  catalogEmptyText: {
    color: '#475569',
  },
  catalogHint: {
    color: '#64748b',
    fontSize: 12,
    fontWeight: '600',
  },
  catalogList: {
    gap: 8,
  },
  catalogItem: {
    borderWidth: 1,
    borderColor: '#cbd5f5',
    borderRadius: 10,
    backgroundColor: '#ffffff',
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 4,
  },
  catalogItemKey: {
    color: '#0f172a',
    fontWeight: '600',
  },
  catalogItemMeta: {
    color: '#475569',
    fontSize: 12,
  },
  formError: {
    color: '#b91c1c',
    fontWeight: '600',
  },
  formSuccess: {
    color: '#15803d',
    fontWeight: '600',
  },
  submitButton: {
    backgroundColor: '#0f172a',
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  submitButtonDisabled: {
    opacity: 0.6,
  },
  submitButtonLabel: {
    color: '#ffffff',
    fontWeight: '700',
    letterSpacing: 0.4,
  },
});

export default SchedulerScreen;
