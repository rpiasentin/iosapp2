import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Keyboard,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  useWindowDimensions,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import {
  createApiClient,
  HistoryCustomResponse,
  HistoryKeysResponse,
  VrmCodesResponse,
  VrmInstanceItem,
  VrmInstancesResponse,
} from '@inverter/api-client';

import { Card, Section, StatusPill } from '@inverter/ui';

import LineChart, { ChartSeries } from '../components/LineChart';
import {
  formatNumber,
  formatRelativeTime,
} from '../utils/format';

import * as ScreenOrientation from 'expo-screen-orientation';

const COLUMN_COLORS = ['#1d4ed8', '#ec4899', '#22c55e', '#f97316'];
const SUM_COLOR = '#7c3aed';

export type SourceType = 'eg4' | 'vrm';

interface ColumnSelection {
  source: SourceType;
  instanceId?: number | null;
  kpi?: string;
  scale: string;
}

interface Option<T extends string | number> {
  label: string;
  value: T;
  description?: string;
}

interface CombinedMathScreenProps {
  readonly baseUrl: string;
  readonly onBack: () => void;
}

interface ModalState {
  column: number;
  title: string;
  options: Array<Option<string>>;
  onSelect: (value: string) => void;
}

interface FetchState {
  status: 'idle' | 'loading' | 'ready' | 'error';
  error?: string;
  series: ChartSeries[];
  refreshedAt?: Date;
}

const WINDOW_OPTIONS = [6, 12, 24, 48];

const DEFAULT_COLUMNS: ColumnSelection[] = [
  { source: 'eg4', kpi: 'ppv', scale: '1' },
  { source: 'eg4', kpi: 'pToUser', scale: '1' },
  { source: 'vrm', instanceId: undefined, kpi: undefined, scale: '1' },
  { source: 'vrm', instanceId: undefined, kpi: undefined, scale: '1' },
];

function OptionModal({ state, onClose }: { state: ModalState | null; onClose: () => void }) {
  if (!state) {
    return null;
  }
  return (
    <Modal transparent animationType="slide" visible>
      <View style={styles.modalBackdrop}>
        <View style={styles.modalSheet}>
          <Text style={styles.modalTitle}>{state.title}</Text>
          <ScrollView style={styles.modalList}>
            {state.options.map((option) => (
              <Pressable
                key={option.value}
                style={styles.modalOption}
                onPress={() => {
                  state.onSelect(String(option.value));
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

function ToggleChip({
  label,
  active,
  onPress,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={[styles.chip, active ? styles.chipActive : null]}
      accessibilityRole="button"
    >
      <Text style={[styles.chipText, active ? styles.chipTextActive : null]}>{label}</Text>
    </Pressable>
  );
}

function ColumnConfigurator({
  index,
  column,
  eg4Keys,
  vrmCodes,
  vrmInstances,
  onChange,
  onOpenKpi,
  onOpenInstance,
}: {
  index: number;
  column: ColumnSelection;
  eg4Keys: string[];
  vrmCodes: string[];
  vrmInstances: VrmInstanceItem[];
  onChange: (next: ColumnSelection) => void;
  onOpenKpi: () => void;
  onOpenInstance: () => void;
}) {
  const isVrm = column.source === 'vrm';
  const instanceLabel = useMemo(() => {
    if (!isVrm) {
      return 'N/A';
    }
    if (!column.instanceId && column.instanceId !== 0) {
      return 'Select instance';
    }
    const found = vrmInstances.find((item) => item.instance === column.instanceId);
    if (!found) {
      return `Instance ${column.instanceId}`;
    }
    const name = found.productName || found.name || `Instance ${found.instance}`;
    return `${found.instance} · ${name}`;
  }, [column.instanceId, isVrm, vrmInstances]);

  const kpiLabel = useMemo(() => {
    if (!column.kpi) {
      return 'Select KPI';
    }
    if (column.source === 'eg4') {
      return column.kpi;
    }
    return column.kpi;
  }, [column.kpi, column.source]);

  const handleScaleChange = (value: string) => {
    if (value === '' || /^-?\d*(\.\d*)?$/.test(value)) {
      onChange({ ...column, scale: value });
    }
  };

  return (
    <Card style={styles.columnCard}>
      <Text style={styles.columnTitle}>Column {index + 1}</Text>

      <View style={styles.rowBlock}>
        <Text style={styles.rowLabel}>Source</Text>
        <View style={styles.rowValueHorizontal}>
          <ToggleChip
            label="EG4"
            active={column.source === 'eg4'}
            onPress={() =>
              onChange({
                source: 'eg4',
                instanceId: undefined,
                kpi: eg4Keys[0] ?? undefined,
                scale: column.scale || '1',
              })
            }
          />
          <ToggleChip
            label="VRM"
            active={column.source === 'vrm'}
            onPress={() =>
              onChange({
                source: 'vrm',
                instanceId: vrmInstances[0]?.instance ?? undefined,
                kpi: vrmCodes[0] ?? undefined,
                scale: column.scale || '1',
              })
            }
          />
        </View>
      </View>

      <View style={styles.rowBlock}>
        <Text style={styles.rowLabel}>Entity</Text>
        <Pressable
          style={[styles.selectorButton, !isVrm ? styles.selectorButtonDisabled : null]}
          onPress={isVrm ? onOpenInstance : undefined}
          accessibilityRole="button"
        >
          <Text style={styles.selectorText}>{instanceLabel}</Text>
        </Pressable>
      </View>

      <View style={styles.rowBlock}>
        <Text style={styles.rowLabel}>KPI</Text>
        <Pressable style={styles.selectorButton} onPress={onOpenKpi} accessibilityRole="button">
          <Text style={styles.selectorText}>{kpiLabel}</Text>
        </Pressable>
      </View>

      <View style={styles.rowBlock}>
        <Text style={styles.rowLabel}>Scale</Text>
        <TextInput
          style={styles.scaleInput}
          value={column.scale}
          keyboardType="decimal-pad"
          onChangeText={handleScaleChange}
          placeholder="1"
        />
      </View>
    </Card>
  );
}

function CalculatedColumn({
  includes,
  onToggle,
}: {
  includes: boolean[];
  onToggle: (index: number) => void;
}) {
  return (
    <Card style={styles.columnCard}>
      <Text style={styles.columnTitle}>Calculated</Text>
      <View style={styles.rowBlock}>
        <Text style={styles.rowLabel}>Include Columns</Text>
        <View style={styles.calcRow}>
          <ToggleChip label="Col 1" active={includes[0]} onPress={() => onToggle(0)} />
          <ToggleChip label="Col 2" active={includes[1]} onPress={() => onToggle(1)} />
        </View>
        <View style={styles.calcRow}>
          <ToggleChip label="Col 3" active={includes[2]} onPress={() => onToggle(2)} />
          <ToggleChip label="Col 4" active={includes[3]} onPress={() => onToggle(3)} />
        </View>
      </View>
      <Text style={styles.calcHint}>Sum includes checked columns.</Text>
    </Card>
  );
}

export function CombinedMathScreen({ baseUrl, onBack }: CombinedMathScreenProps) {
  const api = useMemo(() => createApiClient({ baseUrl }), [baseUrl]);
  const [columns, setColumns] = useState<ColumnSelection[]>(DEFAULT_COLUMNS);
  const [calcIncludes, setCalcIncludes] = useState<boolean[]>([true, true, false, false]);
  const [windowHours, setWindowHours] = useState<number>(24);
  const [windowHoursInput, setWindowHoursInput] = useState<string>('24');
  const [eg4Keys, setEg4Keys] = useState<string[]>([]);
  const [vrmCodes, setVrmCodes] = useState<string[]>([]);
  const [vrmInstances, setVrmInstances] = useState<VrmInstanceItem[]>([]);
  const [modalState, setModalState] = useState<ModalState | null>(null);
  const [fetchState, setFetchState] = useState<FetchState>({ status: 'idle', series: [] });
  const [fullscreenVisible, setFullscreenVisible] = useState(false);
  const windowDimensions = useWindowDimensions();

  const loadOptions = useCallback(async () => {
    try {
      const [eg4Res, vrmCodesRes, vrmInstancesRes]: [HistoryKeysResponse, VrmCodesResponse, VrmInstancesResponse] =
        await Promise.all([
          api.getHistoryKeys(),
          api.getVrmHistoryCodes(),
          api.getVrmInstances(),
        ]);
      setEg4Keys(Array.from(eg4Res.keys ?? []));
      setVrmCodes(Array.from(vrmCodesRes.codes ?? []));
      setVrmInstances(Array.from(vrmInstancesRes.items ?? []));
      setColumns((prev) =>
        prev.map((col, idx) => {
          if (col.source === 'eg4' && !col.kpi && eg4Res.keys.length) {
            return { ...col, kpi: eg4Res.keys[0] };
          }
          if (col.source === 'vrm') {
            const inst = col.instanceId ?? vrmInstancesRes.items[0]?.instance;
            const kpi = col.kpi ?? vrmCodesRes.codes[0];
            return { ...col, instanceId: inst, kpi };
          }
          return col;
        })
      );
    } catch (error) {
      setFetchState({ status: 'error', series: [], error: error instanceof Error ? error.message : String(error) });
    }
  }, [api]);

  useEffect(() => {
    loadOptions();
  }, [loadOptions]);

  useEffect(() => {
    setWindowHoursInput(String(windowHours));
  }, [windowHours]);

  const handleChangeColumn = useCallback(
    (index: number, next: ColumnSelection) => {
      setColumns((prev) => prev.map((col, idx) => (idx === index ? next : col)));
    },
    []
  );

  const handleToggleCalc = useCallback((idx: number) => {
    setCalcIncludes((prev) => prev.map((value, index) => (index === idx ? !value : value)));
  }, []);

  const hasSeries = fetchState.series.length > 0;
  const fullscreenChartHeight = Math.max(320, windowDimensions.height - 200);
  const insets = useSafeAreaInsets();

  const lockOrientation = useCallback(async (lock: ScreenOrientation.OrientationLock) => {
    try {
      await ScreenOrientation.lockAsync(lock);
    } catch (error) {
      console.warn('[orientation] lock failed', error);
    }
  }, []);

  const openFullscreen = useCallback(() => {
    if (!hasSeries) {
      return;
    }
    setFullscreenVisible(true);
  }, [hasSeries]);

  const closeFullscreen = useCallback(() => {
    setFullscreenVisible(false);
    lockOrientation(ScreenOrientation.OrientationLock.PORTRAIT_UP);
  }, [lockOrientation]);

  const handlePortrait = useCallback(() => {
    lockOrientation(ScreenOrientation.OrientationLock.PORTRAIT_UP);
  }, [lockOrientation]);

  const handleLandscape = useCallback(() => {
    lockOrientation(ScreenOrientation.OrientationLock.LANDSCAPE_RIGHT);
  }, [lockOrientation]);

  useEffect(() => {
    return () => {
      ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.PORTRAIT_UP).catch(() => undefined);
    };
  }, []);

  const openKpiModal = useCallback(
    (columnIndex: number) => {
      const column = columns[columnIndex];
      const options = (column.source === 'eg4' ? eg4Keys : vrmCodes).map((value) => ({
        label: value,
        value,
      }));
      if (!options.length) {
        return;
      }
      setModalState({
        column: columnIndex,
        title: column.source === 'eg4' ? 'Select EG4 KPI' : 'Select VRM KPI',
        options,
        onSelect: (value) =>
          handleChangeColumn(columnIndex, {
            ...column,
            kpi: value,
          }),
      });
    },
    [columns, eg4Keys, handleChangeColumn, vrmCodes]
  );

  const openInstanceModal = useCallback(
    async (columnIndex: number) => {
      if (!vrmInstances.length) {
        return;
      }
      const options = vrmInstances.map((item) => ({
        label: `${item.instance} · ${item.productName || item.name || 'Device'}`,
        value: String(item.instance),
      }));
      setModalState({
        column: columnIndex,
        title: 'Select VRM Instance',
        options,
        onSelect: async (value) => {
          const instance = Number.parseInt(value, 10);
          try {
            const codesRes = await api.getVrmInstanceCodes(instance);
            const codes = (codesRes.codes ?? []).length ? codesRes.codes : vrmCodes;
            if (codes.length) {
              setVrmCodes((prev) => {
                const merged = Array.from(new Set([...prev, ...codes]));
                return merged;
              });
            }
            handleChangeColumn(columnIndex, {
              ...columns[columnIndex],
              instanceId: instance,
              kpi: codes[0] ?? columns[columnIndex].kpi,
            });
          } catch (error) {
            handleChangeColumn(columnIndex, {
              ...columns[columnIndex],
              instanceId: instance,
            });
          }
        },
      });
    },
    [api, columns, handleChangeColumn, vrmCodes, vrmInstances]
  );

  const canPreview = useMemo(
    () => columns.some((col) => Boolean(col.kpi)),
    [columns]
  );

  const previewGraph = useCallback(async () => {
    if (!canPreview) {
      return;
    }
    setFetchState((prev) => ({ ...prev, status: 'loading', error: undefined }));
    try {
      const requests = columns.map((column) => {
        if (!column.kpi) {
          return Promise.resolve<HistoryCustomResponse | null>(null);
        }
        if (column.source === 'eg4') {
          return api.getHistoryCustom({
            left: column.kpi,
            right: column.kpi,
            windowHours,
          });
        }
        return api.getVrmHistoryByCode({
          left: column.kpi,
          right: column.kpi,
          windowHours,
          leftInstance: column.instanceId ?? undefined,
          rightInstance: column.instanceId ?? undefined,
        });
      });

      const responses = await Promise.all(requests);
      const pointMap = new Map<string, { ts: string; time: number; values: Array<number | null> }>();

      responses.forEach((response, index) => {
        if (!response) {
          return;
        }
        const scale = Number.parseFloat(columns[index].scale || '1');
        const factor = Number.isFinite(scale) ? scale : 1;
        response.points.forEach((point) => {
          if (!point.ts) {
            return;
          }
          const time = Date.parse(point.ts);
          if (Number.isNaN(time)) {
            return;
          }
          const key = point.ts;
          if (!pointMap.has(key)) {
            pointMap.set(key, { ts: point.ts, time, values: [null, null, null, null] });
          }
          const entry = pointMap.get(key)!;
          const raw = point.left ?? point.right ?? null;
          entry.values[index] = raw === null || Number.isNaN(raw) ? null : raw * factor;
        });
      });

      const sorted = Array.from(pointMap.values()).sort((a, b) => a.time - b.time);

      const lastValues = columns.map<null | number>(() => null);
      sorted.forEach((entry) => {
        const filled = entry.values.map((value, idx) => {
          if (value === null || Number.isNaN(value)) {
            const fallback = lastValues[idx];
            return fallback ?? null;
          }
          lastValues[idx] = value;
          return value;
        });
        entry.values = filled;
      });

      const chartSeries: ChartSeries[] = columns.map((column, index) => ({
        id: `column-${index}`,
        name: column.kpi ?? `Column ${index + 1}`,
        color: COLUMN_COLORS[index],
        points: sorted.map((entry) => ({
          ts: entry.time,
          value: entry.values[index],
        })),
      }));

      const sumSeries: ChartSeries = {
        id: 'calculated-sum',
        name: 'Calculated Sum',
        color: SUM_COLOR,
        points: sorted.map((entry) => {
          let total: number | null = null;
          calcIncludes.forEach((include, idx) => {
            if (!include) {
              return;
            }
            const value = entry.values[idx];
            if (value === null || Number.isNaN(value)) {
              return;
            }
            total = total === null ? value : total + value;
          });
          return { ts: entry.time, value: total };
        }),
      };

      setFetchState({
        status: 'ready',
        series: [...chartSeries, sumSeries],
        refreshedAt: new Date(),
      });
    } catch (error) {
      setFetchState({
        status: 'error',
        series: [],
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }, [api, calcIncludes, canPreview, columns, windowHours]);

  const legendItems = useMemo(() => {
    return fetchState.series.map((s) => ({ id: s.id, name: s.name, color: s.color }));
  }, [fetchState.series]);

  const handleWindowInputChange = useCallback((value: string) => {
    const normalized = value.replace(/[^0-9]/g, '');
    setWindowHoursInput(normalized);
  }, []);

  const parsedWindowInput = useMemo(() => {
    if (!windowHoursInput) {
      return null;
    }
    const parsed = Number.parseInt(windowHoursInput, 10);
    if (!Number.isFinite(parsed) || parsed <= 0) {
      return null;
    }
    return parsed;
  }, [windowHoursInput]);

  const applyCustomWindow = useCallback(() => {
    if (!parsedWindowInput) {
      setWindowHoursInput(String(windowHours));
      Keyboard.dismiss();
      return;
    }
    if (parsedWindowInput === windowHours) {
      Keyboard.dismiss();
      return;
    }
    setWindowHours(parsedWindowInput);
    Keyboard.dismiss();
  }, [parsedWindowInput, windowHours]);

  return (
    <View style={styles.screen}>
      <ScrollView contentInsetAdjustmentBehavior="automatic" contentContainerStyle={styles.content}>
        <View style={styles.headerRow}>
          <View>
            <Text style={styles.heading}>Combined Dashboard Math</Text>
            <Text style={styles.subheading}>
              Choose KPIs from EG4 and VRM, apply scaling, and preview a calculated sum.
            </Text>
          </View>
          <Pressable style={styles.headerButton} onPress={onBack} accessibilityRole="button">
            <Text style={styles.headerButtonText}>Back</Text>
          </Pressable>
        </View>

        <ScrollView horizontal contentContainerStyle={styles.gridScroll}>
          <View style={styles.columnGrid}>
            {columns.map((column, idx) => (
              <ColumnConfigurator
                key={idx}
                index={idx}
                column={column}
                eg4Keys={eg4Keys}
                vrmCodes={vrmCodes}
                vrmInstances={vrmInstances}
                onChange={(next) => handleChangeColumn(idx, next)}
                onOpenKpi={() => openKpiModal(idx)}
                onOpenInstance={() => openInstanceModal(idx)}
              />
            ))}
            <CalculatedColumn includes={calcIncludes} onToggle={handleToggleCalc} />
          </View>
        </ScrollView>

        <Section title="Window" subtitle="Select the time window for the preview graph.">
          <Card>
            <View style={styles.windowControls}>
              <View style={styles.windowRow}>
                {WINDOW_OPTIONS.map((option) => (
                  <ToggleChip
                    key={option}
                    label={`${option}h`}
                    active={windowHours === option}
                    onPress={() => setWindowHours(option)}
                  />
                ))}
              </View>
              <View style={styles.windowCustomRow}>
                <Text style={styles.windowCustomLabel}>Custom hours</Text>
                <TextInput
                  style={styles.windowInput}
                  value={windowHoursInput}
                  onChangeText={handleWindowInputChange}
                  keyboardType="number-pad"
                  returnKeyType="done"
                  onSubmitEditing={applyCustomWindow}
                  onBlur={applyCustomWindow}
                  accessibilityLabel="Custom hours window"
                  placeholder="e.g. 36"
                />
                <Pressable
                  style={[
                    styles.windowApplyButton,
                    (!parsedWindowInput || parsedWindowInput === windowHours) && styles.windowApplyButtonDisabled,
                  ]}
                  onPress={applyCustomWindow}
                  disabled={!parsedWindowInput || parsedWindowInput === windowHours}
                  accessibilityRole="button"
                >
                  <Text style={styles.windowApplyButtonText}>Apply</Text>
                </Pressable>
              </View>
            </View>
            <Text style={styles.windowMeta}>Preview uses data from the selected window with 1-minute samples when available.</Text>
          </Card>
        </Section>

        <Section title="Preview" subtitle="Tap preview to fetch data and update the graph.">
          <Card>
            <Pressable
              style={[styles.previewButton, !canPreview ? styles.previewButtonDisabled : null]}
              onPress={canPreview ? previewGraph : undefined}
              disabled={!canPreview || fetchState.status === 'loading'}
              accessibilityRole="button"
            >
              {fetchState.status === 'loading' ? (
                <ActivityIndicator color="#ffffff" />
              ) : (
                <Text style={styles.previewButtonText}>Preview graph</Text>
              )}
            </Pressable>
            {fetchState.refreshedAt ? (
              <Text style={styles.previewMeta}>
                Updated {formatRelativeTime(fetchState.refreshedAt.toISOString())}
              </Text>
            ) : null}
            {fetchState.status === 'error' && fetchState.error ? (
              <View style={styles.errorBanner}>
                <Text style={styles.errorBannerText}>{fetchState.error}</Text>
              </View>
            ) : null}
          </Card>
        </Section>

        <Section title="Graph">
          <Pressable
            style={[styles.chartPressable, !hasSeries ? styles.chartPressableDisabled : null]}
            onPress={openFullscreen}
            disabled={!hasSeries}
            accessibilityRole="button"
          >
            <LineChart series={fetchState.series} />
            {hasSeries ? (
              <View style={styles.chartHint} pointerEvents="none">
                <Text style={styles.chartHintText}>Tap to expand</Text>
              </View>
            ) : null}
          </Pressable>
          {legendItems.length ? (
            <View style={styles.legendRow}>
              {legendItems.map((item) => (
                <View key={item.id} style={styles.legendItem}>
                  <View style={[styles.legendSwatch, { backgroundColor: item.color }]} />
                  <Text style={styles.legendText}>{item.name}</Text>
                </View>
              ))}
            </View>
          ) : null}
        </Section>

        <Section title="Summary">
          <Card>
            <Text style={styles.summaryText}>
              Columns with VRM sources require a configured VRM integration. Use the Combined Dashboard to manage aliases for
              easier discovery. Scaling values let you convert raw units (for example, watts to kilowatts by entering 0.001).
            </Text>
          </Card>
          <Card>
            <View style={styles.statusRow}>
              <View style={styles.statusBlock}>
                <Text style={styles.statusLabel}>EG4 keys loaded</Text>
                <StatusPill label={formatNumber(eg4Keys.length)} tone={eg4Keys.length ? 'success' : 'warning'} />
              </View>
              <View style={styles.statusBlock}>
                <Text style={styles.statusLabel}>VRM instances</Text>
                <StatusPill label={formatNumber(vrmInstances.length)} tone={vrmInstances.length ? 'success' : 'warning'} />
              </View>
              <View style={styles.statusBlock}>
                <Text style={styles.statusLabel}>VRM codes</Text>
                <StatusPill label={formatNumber(vrmCodes.length)} tone={vrmCodes.length ? 'success' : 'warning'} />
              </View>
            </View>
          </Card>
        </Section>
      </ScrollView>
      <Modal
        visible={fullscreenVisible}
        animationType="slide"
        presentationStyle="fullScreen"
        onRequestClose={closeFullscreen}
      >
        <SafeAreaView
          style={[
            styles.fullscreenContainer,
            { paddingTop: (insets.top || 16), paddingBottom: (insets.bottom || 24) },
          ]}
          edges={['right', 'left']}
        >
          <View style={styles.fullscreenHeader}>
            <Pressable
              style={[styles.fullscreenButton, styles.fullscreenClose]}
              onPress={closeFullscreen}
              accessibilityRole="button"
            >
              <Text style={styles.fullscreenButtonText}>Close</Text>
            </Pressable>
            <View style={styles.fullscreenActions}>
              <Pressable
                style={styles.fullscreenButton}
                onPress={handlePortrait}
                accessibilityRole="button"
              >
                <Text style={styles.fullscreenButtonText}>Portrait</Text>
              </Pressable>
              <Pressable
                style={styles.fullscreenButton}
                onPress={handleLandscape}
                accessibilityRole="button"
              >
                <Text style={styles.fullscreenButtonText}>Landscape</Text>
              </Pressable>
            </View>
          </View>
          <View style={styles.fullscreenBody}>
            <LineChart
              series={fetchState.series}
              height={fullscreenChartHeight}
              interactive
            />
          </View>
        </SafeAreaView>
      </Modal>
      <OptionModal state={modalState} onClose={() => setModalState(null)} />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  content: {
    paddingVertical: 24,
    paddingHorizontal: 20,
    gap: 20,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 16,
  },
  heading: {
    fontSize: 28,
    fontWeight: '700',
    color: '#0f172a',
  },
  subheading: {
    marginTop: 4,
    color: '#64748b',
  },
  headerButton: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 999,
    backgroundColor: '#0f172a',
  },
  headerButtonText: {
    color: '#ffffff',
    fontWeight: '600',
    letterSpacing: 0.6,
  },
  gridScroll: {
    paddingBottom: 4,
  },
  columnGrid: {
    flexDirection: 'row',
    gap: 16,
  },
  columnCard: {
    width: 220,
    gap: 12,
  },
  columnTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#0f172a',
  },
  calcHint: {
    color: '#64748b',
    fontSize: 12,
  },
  calcRow: {
    flexDirection: 'row',
    gap: 8,
  },
  rowBlock: {
    gap: 6,
  },
  rowLabel: {
    fontSize: 13,
    color: '#64748b',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  rowValueHorizontal: {
    flexDirection: 'row',
    gap: 8,
  },
  selectorButton: {
    borderWidth: 1,
    borderColor: '#cbd5f5',
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 12,
    backgroundColor: '#f8fafc',
  },
  selectorButtonDisabled: {
    opacity: 0.5,
  },
  selectorText: {
    color: '#0f172a',
  },
  scaleInput: {
    borderWidth: 1,
    borderColor: '#cbd5f5',
    borderRadius: 12,
    paddingVertical: 8,
    paddingHorizontal: 12,
    color: '#0f172a',
  },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#cbd5f5',
    backgroundColor: '#ffffff',
  },
  chipActive: {
    backgroundColor: '#0f172a',
    borderColor: '#0f172a',
  },
  chipText: {
    color: '#0f172a',
    fontWeight: '600',
  },
  chipTextActive: {
    color: '#ffffff',
  },
  windowControls: {
    gap: 16,
  },
  windowRow: {
    flexDirection: 'row',
    gap: 12,
    flexWrap: 'wrap',
  },
  windowCustomRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  windowCustomLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#0f172a',
  },
  windowInput: {
    flexGrow: 1,
    minWidth: 80,
    borderWidth: 1,
    borderColor: '#cbd5f5',
    borderRadius: 12,
    paddingVertical: 8,
    paddingHorizontal: 12,
    color: '#0f172a',
    backgroundColor: '#ffffff',
  },
  windowApplyButton: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: '#0f172a',
  },
  windowApplyButtonDisabled: {
    backgroundColor: '#94a3b8',
  },
  windowApplyButtonText: {
    color: '#ffffff',
    fontWeight: '600',
  },
  windowMeta: {
    marginTop: 8,
    fontSize: 12,
    color: '#64748b',
  },
  previewButton: {
    backgroundColor: '#0f172a',
    borderRadius: 999,
    paddingVertical: 14,
    alignItems: 'center',
  },
  previewButtonDisabled: {
    opacity: 0.4,
  },
  previewButtonText: {
    color: '#ffffff',
    fontWeight: '600',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },
  previewMeta: {
    marginTop: 8,
    color: '#64748b',
  },
  errorBanner: {
    marginTop: 12,
    padding: 12,
    borderRadius: 12,
    backgroundColor: '#fee2e2',
  },
  errorBannerText: {
    color: '#991b1b',
    fontWeight: '600',
  },
  legendRow: {
    marginTop: 12,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  legendSwatch: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  legendText: {
    color: '#475569',
  },
  summaryText: {
    color: '#475569',
    lineHeight: 20,
  },
  statusRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 16,
  },
  statusBlock: {
    gap: 4,
  },
  statusLabel: {
    fontSize: 13,
    color: '#64748b',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(15,23,42,0.45)',
    justifyContent: 'flex-end',
  },
  modalSheet: {
    backgroundColor: '#ffffff',
    paddingTop: 20,
    paddingBottom: 32,
    paddingHorizontal: 20,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '70%',
    gap: 16,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#0f172a',
  },
  modalList: {
    maxHeight: 360,
  },
  modalOption: {
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#e2e8f0',
    gap: 4,
  },
  modalOptionLabel: {
    fontSize: 16,
    color: '#0f172a',
  },
  modalOptionDescription: {
    color: '#64748b',
    fontSize: 13,
  },
  modalCancel: {
    alignSelf: 'center',
    marginTop: 4,
  },
  modalCancelText: {
    color: '#0f172a',
    fontWeight: '600',
  },
  chartPressable: {
    position: 'relative',
  },
  chartPressableDisabled: {
    opacity: 0.5,
  },
  chartHint: {
    position: 'absolute',
    top: 12,
    right: 12,
    backgroundColor: 'rgba(15,23,42,0.75)',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
  },
  chartHintText: {
    color: '#ffffff',
    fontSize: 11,
    letterSpacing: 0.5,
  },
  fullscreenContainer: {
    flex: 1,
    backgroundColor: '#0f172a',
  },
  fullscreenHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 12,
    paddingTop: 8,
  },
  fullscreenActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  fullscreenButton: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 999,
    backgroundColor: 'rgba(15,23,42,0.65)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.3)',
  },
  fullscreenClose: {
    backgroundColor: '#f87171',
    borderColor: '#7f1d1d',
  },
  fullscreenButtonText: {
    color: '#ffffff',
    fontWeight: '600',
    letterSpacing: 0.6,
  },
  fullscreenBody: {
    flex: 1,
    paddingHorizontal: 16,
    paddingBottom: 24,
    justifyContent: 'center',
  },
});

export default CombinedMathScreen;
