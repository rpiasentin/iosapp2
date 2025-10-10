import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';

import {
  createApiClient,
  HistoryCustomResponse,
  VrmDescriptionsResponse,
  VrmHealthResponse,
  VrmSamplesMetaResponse,
} from '@inverter/api-client';

import { Card, Section, StatusPill, KeyValueRow } from '@inverter/ui';

import LineChart, { ChartSeries } from '../components/LineChart';
import { formatNumber, formatRelativeTime, toNumber } from '../utils/format';

const LEFT_COLOR = '#1f77b4';
const RIGHT_COLOR = '#d62728';
const WINDOW_OPTIONS = [1, 3, 6, 12, 24, 48, 168];

interface SelectionState {
  readonly code: string | null;
  readonly instance?: number | null;
}

interface SelectionModalState {
  readonly target: 'left' | 'right';
}

interface VrmDashboardScreenProps {
  readonly baseUrl: string;
  readonly onBack: () => void;
}

interface SeriesState {
  readonly status: 'idle' | 'loading' | 'ready' | 'error';
  readonly error?: string;
  readonly series: ReadonlyArray<ChartSeries>;
  readonly updatedAt?: Date;
}

function SelectionModal({
  visible,
  title,
  options,
  onSelect,
  onClose,
}: {
  visible: boolean;
  title: string;
  options: ReadonlyArray<{ label: string; description?: string; value: string }>;
  onSelect: (value: string) => void;
  onClose: () => void;
}) {
  if (!visible) {
    return null;
  }

  return (
    <Modal transparent animationType="slide" visible>
      <View style={styles.modalBackdrop}>
        <View style={styles.modalSheet}>
          <Text style={styles.modalTitle}>{title}</Text>
          <ScrollView style={styles.modalList}>
            {options.map((option) => (
              <Pressable
                key={option.value}
                style={styles.modalOption}
                onPress={() => {
                  onSelect(option.value);
                  onClose();
                }}
              >
                <Text style={styles.modalOptionLabel}>{option.label}</Text>
                {option.description ? (
                  <Text style={styles.modalOptionDescription}>{option.description}</Text>
                ) : null}
              </Pressable>
            ))}
          </ScrollView>
          <Pressable style={styles.modalCancel} onPress={onClose} accessibilityRole="button">
            <Text style={styles.modalCancelText}>Cancel</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

export function VrmDashboardScreen({ baseUrl, onBack }: VrmDashboardScreenProps) {
  const api = useMemo(() => createApiClient({ baseUrl }), [baseUrl]);
  const [codes, setCodes] = useState<ReadonlyArray<string>>([]);
  const [descriptions, setDescriptions] = useState<Record<string, string>>({});
  const [leftSelection, setLeftSelection] = useState<SelectionState>({ code: null });
  const [rightSelection, setRightSelection] = useState<SelectionState>({ code: null });
  const [windowHours, setWindowHours] = useState<number>(24);
  const [health, setHealth] = useState<VrmHealthResponse | null>(null);
  const [meta, setMeta] = useState<VrmSamplesMetaResponse | null>(null);
  const lastMetaIdRef = useRef<number | null>(null);
  const [seriesState, setSeriesState] = useState<SeriesState>({ status: 'idle', series: [] });
  const [initialLoading, setInitialLoading] = useState<boolean>(true);
  const [initialError, setInitialError] = useState<string | null>(null);
  const [modalState, setModalState] = useState<SelectionModalState | null>(null);

  const combinedCodeSet = useMemo(() => {
    const values = new Set<string>();
    codes.forEach((code) => values.add(code));
    if (leftSelection.code) {
      values.add(leftSelection.code);
    }
    if (rightSelection.code) {
      values.add(rightSelection.code);
    }
    return Array.from(values).sort();
  }, [codes, leftSelection.code, rightSelection.code]);

  const codeOptions = useMemo(() => {
    return combinedCodeSet.map((code) => {
      const desc = descriptions?.[code];
      const label = desc && desc.trim().length > 0 ? desc : code;
      const description = label === code ? undefined : code;
      return { value: code, label, description };
    });
  }, [combinedCodeSet, descriptions]);

  const leftLabel = useMemo(() => {
    if (!leftSelection.code) {
      return 'Left';
    }
    const desc = descriptions?.[leftSelection.code];
    return desc && desc.trim().length > 0 ? desc : leftSelection.code;
  }, [descriptions, leftSelection.code]);

  const rightLabel = useMemo(() => {
    if (!rightSelection.code) {
      return 'Right';
    }
    const desc = descriptions?.[rightSelection.code];
    return desc && desc.trim().length > 0 ? desc : rightSelection.code;
  }, [descriptions, rightSelection.code]);

  const fetchAuxiliaryData = useCallback(async () => {
    setInitialLoading(true);
    setInitialError(null);
    try {
      const [codesResponse, defaultsResponse, healthResponse] = await Promise.all([
        api.getVrmHistoryCodes({ timeoutMs: 5000 }),
        api.getVrmHistoryDefaults({ timeoutMs: 5000 }),
        api.getVrmHealth({ timeoutMs: 5000 }),
      ]);

      let descriptionsResponse: VrmDescriptionsResponse = {};
      try {
        descriptionsResponse = await api.getVrmHistoryDescriptions({ timeoutMs: 5000 });
      } catch (_error) {
        descriptionsResponse = {};
      }

      let metaResponse: VrmSamplesMetaResponse | null = null;
      try {
        metaResponse = await api.getVrmSamplesMeta({ timeoutMs: 4000 });
      } catch (_error) {
        metaResponse = null;
      }

      const defaults = defaultsResponse ?? {};
      const uniqueCodes = new Set<string>(codesResponse?.codes ?? []);
      if (defaults.left?.code) {
        uniqueCodes.add(defaults.left.code);
      }
      if (defaults.right?.code) {
        uniqueCodes.add(defaults.right.code);
      }
      const sorted = Array.from(uniqueCodes).sort();
      setCodes(sorted);
      const mergedDescriptions: Record<string, string> = {
        ...(descriptionsResponse ?? {}),
      };
      if (defaults.left?.code && defaults.left.label) {
        mergedDescriptions[defaults.left.code] = defaults.left.label;
      }
      if (defaults.right?.code && defaults.right.label) {
        mergedDescriptions[defaults.right.code] = defaults.right.label;
      }
      setDescriptions(mergedDescriptions);
      setHealth(healthResponse ?? null);
      if (metaResponse) {
        setMeta(metaResponse);
        lastMetaIdRef.current = metaResponse.last_id ?? null;
      }

      setLeftSelection((prev) => {
        const preferred = defaults.left?.code ?? prev.code ?? (sorted.length > 0 ? sorted[0] : null);
        const instance = defaults.left?.instance ?? (prev.code === preferred ? prev.instance : null);
        if (prev.code === preferred && prev.instance === instance) {
          return prev;
        }
        return { code: preferred, instance };
      });

      setRightSelection((prev) => {
        const preferred = defaults.right?.code ?? prev.code ?? (sorted.length > 1 ? sorted[1] : sorted[0] ?? null);
        const instance = defaults.right?.instance ?? (prev.code === preferred ? prev.instance : null);
        if (prev.code === preferred && prev.instance === instance) {
          return prev;
        }
        return { code: preferred, instance };
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to load VRM metadata';
      setInitialError(message);
    } finally {
      setInitialLoading(false);
    }
  }, [api]);

  const loadSeries = useCallback(async () => {
    if (!leftSelection.code || !rightSelection.code) {
      setSeriesState((prev) => ({ ...prev, series: [], status: 'idle', error: undefined }));
      return;
    }

    setSeriesState((prev) => ({ ...prev, status: 'loading', error: undefined }));

    try {
      const response: HistoryCustomResponse = await api.getVrmHistoryByCode(
        {
          left: leftSelection.code,
          right: rightSelection.code,
          windowHours,
          limit: 120,
          leftInstance:
            typeof leftSelection.instance === 'number' ? leftSelection.instance : undefined,
          rightInstance:
            typeof rightSelection.instance === 'number' ? rightSelection.instance : undefined,
        },
        { timeoutMs: 8000 },
      );

      const points = (response?.points ?? []).filter((point) => {
        if (!point.ts) {
          return false;
        }
        const ts = new Date(point.ts);
        return !Number.isNaN(ts.getTime());
      });

      const makeSeries = (side: 'left' | 'right', label: string, color: string): ChartSeries => ({
        id: side,
        name: label,
        color,
        points: points.map((point) => {
          const ts = new Date(point.ts as string).getTime();
          const raw = side === 'left' ? point.left : point.right;
          const value = toNumber(raw);
          return {
            ts,
            value,
          };
        }),
      });

      const nextSeries: ChartSeries[] = [
        makeSeries('left', leftLabel, LEFT_COLOR),
        makeSeries('right', rightLabel, RIGHT_COLOR),
      ];

      setSeriesState({
        status: 'ready',
        series: nextSeries,
        updatedAt: new Date(),
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to load VRM history';
      setSeriesState({ status: 'error', series: [], error: message });
    }
  }, [api, leftLabel, leftSelection.code, leftSelection.instance, rightLabel, rightSelection.code, rightSelection.instance, windowHours]);

  const refreshDefaults = useCallback(async () => {
    try {
      const defaults = await api.getVrmHistoryDefaults({ timeoutMs: 5000 });
      const sorted = new Set<string>(codes);
      if (defaults.left?.code) {
        sorted.add(defaults.left.code);
      }
      if (defaults.right?.code) {
        sorted.add(defaults.right.code);
      }
      setCodes(Array.from(sorted).sort());
      setDescriptions((prev) => {
        const next: Record<string, string> = { ...prev };
        if (defaults.left?.code && defaults.left.label) {
          next[defaults.left.code] = defaults.left.label;
        }
        if (defaults.right?.code && defaults.right.label) {
          next[defaults.right.code] = defaults.right.label;
        }
        return next;
      });

      setLeftSelection((prev) => {
        if (!defaults.left?.code) {
          return prev;
        }
        const preferred = defaults.left.code;
        const instance = defaults.left.instance ?? null;
        if (prev.code === preferred && prev.instance === instance) {
          return prev;
        }
        return { code: preferred, instance };
      });

      setRightSelection((prev) => {
        if (!defaults.right?.code) {
          return prev;
        }
        const preferred = defaults.right.code;
        const instance = defaults.right.instance ?? null;
        if (prev.code === preferred && prev.instance === instance) {
          return prev;
        }
        return { code: preferred, instance };
      });
    } catch (_error) {
      // ignore refresh failures
    }
  }, [api, codes]);

  useEffect(() => {
    fetchAuxiliaryData();
  }, [fetchAuxiliaryData]);

  useEffect(() => {
    if (initialLoading) {
      return;
    }
    if (!leftSelection.code || !rightSelection.code) {
      return;
    }
    loadSeries();
  }, [initialLoading, leftSelection.code, rightSelection.code, leftSelection.instance, rightSelection.instance, windowHours, loadSeries]);

  const updateMeta = useCallback(async () => {
    try {
      const metaResponse = await api.getVrmSamplesMeta({ timeoutMs: 4000 });
      setMeta(metaResponse);
      const lastId = metaResponse.last_id ?? null;
      if (lastMetaIdRef.current !== null && lastId !== lastMetaIdRef.current) {
        lastMetaIdRef.current = lastId;
        await loadSeries();
      } else {
        lastMetaIdRef.current = lastId;
      }
    } catch (_error) {
      // ignore polling errors
    }
  }, [api, loadSeries]);

  useEffect(() => {
    updateMeta();
    const interval = setInterval(() => {
      updateMeta();
    }, 15000);
    return () => clearInterval(interval);
  }, [updateMeta]);

  const handleOverride = useCallback(
    async (side: 'left' | 'right', code: string) => {
      try {
        await api.overrideVrmHistoryDefault(side, code, { timeoutMs: 5000 });
      } catch (_error) {
        // ignore errors – UI still updates locally
      }
      await refreshDefaults();
    },
    [api, refreshDefaults],
  );

  const handleSelectLeft = useCallback(
    (code: string) => {
      setLeftSelection({ code, instance: null });
      handleOverride('left', code);
    },
    [handleOverride],
  );

  const handleSelectRight = useCallback(
    (code: string) => {
      setRightSelection({ code, instance: null });
      handleOverride('right', code);
    },
    [handleOverride],
  );

  const handleRefresh = useCallback(async () => {
    await fetchAuxiliaryData();
  }, [fetchAuxiliaryData]);

  const configuredTone = useMemo(() => {
    if (!health) {
      return { label: 'Unknown', tone: 'neutral' as const };
    }
    if (!health.configured) {
      return { label: 'Not Linked', tone: 'warning' as const };
    }
    if ((health.samples?.count ?? 0) > 0) {
      return { label: 'Streaming', tone: 'success' as const };
    }
    return { label: 'Linked', tone: 'warning' as const };
  }, [health]);

  const lastSampleRelative = useMemo(() => {
    const ts = meta?.last_ts ?? health?.samples?.last_ts ?? null;
    return ts ? formatRelativeTime(ts) : 'Never';
  }, [health, meta]);

  const lastUpdatedRelative = useMemo(() => {
    if (!seriesState.updatedAt) {
      return null;
    }
    return formatRelativeTime(seriesState.updatedAt.toISOString());
  }, [seriesState.updatedAt]);

  const chartEmpty = useMemo(() => {
    if (seriesState.status !== 'ready') {
      return false;
    }
    return !seriesState.series.some((s) => s.points.some((pt) => pt.value !== null));
  }, [seriesState.series, seriesState.status]);

  const loadingIndicatorVisible = initialLoading || seriesState.status === 'loading';

  return (
    <View style={styles.screen}>
      <StatusBar style="dark" />
      <ScrollView contentInsetAdjustmentBehavior="automatic" contentContainerStyle={styles.content}>
        <View style={styles.headerRow}>
          <View style={styles.headerText}>
            <Text style={styles.heading}>VRM Dashboard</Text>
            <Text style={styles.subheading}>Compare Victron metrics and watch realtime collector health.</Text>
          </View>
          <View style={styles.headerActions}>
            <Pressable style={styles.headerButton} onPress={onBack} accessibilityRole="button">
              <Text style={styles.headerButtonLabel}>Back</Text>
            </Pressable>
            <Pressable style={styles.headerButtonDark} onPress={handleRefresh} accessibilityRole="button">
              <Text style={styles.headerButtonDarkLabel}>Refresh</Text>
            </Pressable>
          </View>
        </View>

        {initialError ? (
          <Card style={styles.errorCard}>
            <Text style={styles.errorTitle}>Unable to load data</Text>
            <Text style={styles.errorMessage}>{initialError}</Text>
          </Card>
        ) : null}

        <Section title="Status">
          <Card style={styles.statusCard}>
            <View style={styles.statusHeader}>
              <Text style={styles.statusTitle}>Victron Link</Text>
              <StatusPill label={configuredTone.label} tone={configuredTone.tone} />
            </View>
            <View style={styles.statusRows}>
              <KeyValueRow label="System ID" value={health?.system_id ?? '—'} />
              <KeyValueRow label="Samples" value={formatNumber(meta?.count ?? health?.samples?.count ?? 0)} />
              <KeyValueRow label="Last sample" value={lastSampleRelative} />
              <KeyValueRow label="Chart updated" value={lastUpdatedRelative ?? '—'} />
            </View>
          </Card>
        </Section>

        <Section title="Configuration">
          <Card style={styles.configCard}>
            <View style={styles.selectionRow}>
              <Text style={styles.selectionLabel}>Left metric</Text>
              <Pressable
                style={styles.selectionButton}
                onPress={() => setModalState({ target: 'left' })}
                accessibilityRole="button"
              >
                <Text style={styles.selectionButtonLabel}>{leftLabel}</Text>
                <Text style={styles.selectionButtonSub}>{leftSelection.code ?? 'Choose metric'}</Text>
              </Pressable>
            </View>
            <View style={styles.selectionRow}>
              <Text style={styles.selectionLabel}>Right metric</Text>
              <Pressable
                style={styles.selectionButton}
                onPress={() => setModalState({ target: 'right' })}
                accessibilityRole="button"
              >
                <Text style={styles.selectionButtonLabel}>{rightLabel}</Text>
                <Text style={styles.selectionButtonSub}>{rightSelection.code ?? 'Choose metric'}</Text>
              </Pressable>
            </View>
            <View style={styles.windowSection}>
              <Text style={styles.windowTitle}>Time window</Text>
              <View style={styles.chipRow}>
                {WINDOW_OPTIONS.map((option) => {
                  const active = windowHours === option;
                  return (
                    <Pressable
                      key={option}
                      style={[styles.chip, active ? styles.chipActive : null]}
                      onPress={() => setWindowHours(option)}
                      accessibilityRole="button"
                    >
                      <Text style={[styles.chipLabel, active ? styles.chipLabelActive : null]}>
                        {option >= 24 ? `${option / 24}d` : `${option}h`}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>
          </Card>
        </Section>

        <Section
          title="VRM History"
          subtitle="Touch the chart to inspect individual timestamps."
          contentStyle={styles.chartSection}
        >
          <Card>
            {loadingIndicatorVisible ? (
              <View style={styles.loadingState}>
                <ActivityIndicator size="large" color="#0f172a" />
                <Text style={styles.loadingLabel}>Loading VRM series…</Text>
              </View>
            ) : seriesState.status === 'error' ? (
              <View style={styles.loadingState}>
                <Text style={styles.errorTitle}>Unable to load VRM history</Text>
                <Text style={styles.errorMessage}>{seriesState.error}</Text>
              </View>
            ) : chartEmpty ? (
              <View style={styles.loadingState}>
                <Text style={styles.emptyLabel}>No data points returned for this window.</Text>
              </View>
            ) : (
              <View style={styles.chartContainer}>
                <LineChart series={seriesState.series} interactive height={280} />
                <View style={styles.legend}>
                  <View style={styles.legendItem}>
                    <View style={[styles.legendSwatch, { backgroundColor: LEFT_COLOR }]} />
                    <Text style={styles.legendLabel}>{leftLabel}</Text>
                  </View>
                  <View style={styles.legendItem}>
                    <View style={[styles.legendSwatch, { backgroundColor: RIGHT_COLOR }]} />
                    <Text style={styles.legendLabel}>{rightLabel}</Text>
                  </View>
                </View>
              </View>
            )}
          </Card>
        </Section>
      </ScrollView>

      <SelectionModal
        visible={modalState !== null}
        title={modalState?.target === 'right' ? 'Select right metric' : 'Select left metric'}
        options={codeOptions}
        onSelect={(value) => {
          if (modalState?.target === 'right') {
            handleSelectRight(value);
          } else {
            handleSelectLeft(value);
          }
        }}
        onClose={() => setModalState(null)}
      />
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
    fontSize: 28,
    fontWeight: '700',
    color: '#0f172a',
  },
  subheading: {
    color: '#475569',
    fontSize: 16,
  },
  headerActions: {
    flexDirection: 'row',
    gap: 12,
  },
  headerButton: {
    backgroundColor: '#e2e8f0',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 999,
  },
  headerButtonLabel: {
    color: '#0f172a',
    fontWeight: '600',
    letterSpacing: 0.5,
  },
  headerButtonDark: {
    backgroundColor: '#0f172a',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 999,
  },
  headerButtonDarkLabel: {
    color: '#ffffff',
    fontWeight: '600',
    letterSpacing: 0.5,
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
  statusCard: {
    gap: 16,
  },
  statusHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  statusTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#0f172a',
  },
  statusRows: {
    gap: 12,
  },
  configCard: {
    gap: 20,
  },
  selectionRow: {
    gap: 8,
  },
  selectionLabel: {
    fontSize: 15,
    fontWeight: '600',
    color: '#1e293b',
  },
  selectionButton: {
    backgroundColor: '#111827',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 12,
    gap: 4,
  },
  selectionButtonLabel: {
    color: '#ffffff',
    fontWeight: '600',
    fontSize: 16,
  },
  selectionButtonSub: {
    color: '#cbd5f5',
    fontSize: 13,
  },
  windowSection: {
    gap: 12,
  },
  windowTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#1e293b',
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  chip: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#1e293b',
    paddingVertical: 6,
    paddingHorizontal: 14,
    backgroundColor: '#ffffff',
  },
  chipActive: {
    backgroundColor: '#1e293b',
  },
  chipLabel: {
    color: '#1e293b',
    fontWeight: '600',
    letterSpacing: 0.4,
  },
  chipLabelActive: {
    color: '#ffffff',
  },
  chartSection: {
    gap: 12,
  },
  chartContainer: {
    gap: 16,
  },
  legend: {
    flexDirection: 'row',
    gap: 16,
    flexWrap: 'wrap',
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  legendSwatch: {
    width: 12,
    height: 12,
    borderRadius: 2,
  },
  legendLabel: {
    color: '#334155',
    fontWeight: '600',
  },
  loadingState: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    paddingVertical: 40,
  },
  loadingLabel: {
    color: '#475569',
    fontSize: 16,
  },
  emptyLabel: {
    color: '#475569',
    fontSize: 15,
    textAlign: 'center',
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.55)',
    justifyContent: 'flex-end',
  },
  modalSheet: {
    backgroundColor: '#ffffff',
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    paddingBottom: 24,
    maxHeight: '70%',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#0f172a',
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 12,
  },
  modalList: {
    paddingHorizontal: 20,
  },
  modalOption: {
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#e2e8f0',
    gap: 4,
  },
  modalOptionLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#0f172a',
  },
  modalOptionDescription: {
    color: '#64748b',
    fontSize: 13,
  },
  modalCancel: {
    marginTop: 16,
    marginHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#0f172a',
    alignItems: 'center',
  },
  modalCancelText: {
    color: '#0f172a',
    fontWeight: '600',
    letterSpacing: 0.5,
  },
});

export default VrmDashboardScreen;
