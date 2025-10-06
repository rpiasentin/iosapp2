import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Dimensions,
  GestureResponderEvent,
  LayoutChangeEvent,
  PanResponder,
  PanResponderInstance,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import Svg, { G, Line, Path, Rect, Text as SvgText } from 'react-native-svg';

import { formatNumber } from '../utils/format';

export interface ChartPoint {
  readonly ts: number;
  readonly value: number | null;
}

export interface ChartSeries {
  readonly id: string;
  readonly name: string;
  readonly color: string;
  readonly points: ReadonlyArray<ChartPoint>;
}

export interface LineChartProps {
  readonly series: ReadonlyArray<ChartSeries>;
  readonly height?: number;
  readonly interactive?: boolean;
}

function buildPath(
  points: ReadonlyArray<ChartPoint>,
  width: number,
  height: number,
  min: number,
  max: number,
): string {
  if (!points.length) {
    return '';
  }
  const range = max - min || 1;
  const step = points.length > 1 ? width / (points.length - 1) : width;
  let d = '';
  let move = true;
  points.forEach((point, index) => {
    if (point.value === null || Number.isNaN(point.value)) {
      move = true;
      return;
    }
    const x = index === points.length - 1 ? width : index * step;
    const ratio = (point.value - min) / range;
    const y = height - ratio * height;
    if (Number.isNaN(y)) {
      move = true;
      return;
    }
    if (move) {
      d += `M ${x.toFixed(2)} ${y.toFixed(2)} `;
      move = false;
    } else {
      d += `L ${x.toFixed(2)} ${y.toFixed(2)} `;
    }
  });
  return d.trim();
}

function formatTooltipTimestamp(value: number | null | undefined): string {
  if (typeof value !== 'number') {
    return '—';
  }
  const ts = new Date(value);
  if (Number.isNaN(ts.getTime())) {
    return '—';
  }
  return ts.toLocaleString(undefined, {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

export function LineChart({ series, height = 260, interactive = false }: LineChartProps) {
  const timeline = series.length ? series[0].points : [];
  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  const [tooltipWidth, setTooltipWidth] = useState(0);
  const [layoutWidth, setLayoutWidth] = useState<number | null>(null);

  useEffect(() => {
    if (!timeline.length) {
      setActiveIndex(null);
      return;
    }
    setActiveIndex((prev) => {
      if (prev === null) {
        return null;
      }
      return Math.min(prev, timeline.length - 1);
    });
  }, [timeline.length]);

  const info = useMemo(() => {
    const values: number[] = [];
    series.forEach((s) => {
      s.points.forEach((pt) => {
        if (pt.value !== null && !Number.isNaN(pt.value)) {
          values.push(pt.value);
        }
      });
    });
    const fallbackWidth = Math.max(220, Dimensions.get('window').width - 32);
    const width = Math.max(220, layoutWidth ?? fallbackWidth);
    if (!values.length || !timeline.length) {
      return {
        width,
        chartWidth: Math.max(width - 32, 160),
        chartHeight: Math.max(height - 56, 120),
        min: 0,
        max: 1,
        hasData: false,
      } as const;
    }
    const min = Math.min(...values);
    const max = Math.max(...values);
    return {
      width,
      chartWidth: Math.max(width - 32, 160),
      chartHeight: Math.max(height - 56, 120),
      min,
      max: min === max ? min + 1 : max,
      hasData: true,
    } as const;
  }, [height, layoutWidth, series, timeline]);

  const { width, chartWidth, chartHeight, min, max } = info;
  const timeValues = timeline
    .map((pt) => pt.ts)
    .filter((ts): ts is number => typeof ts === 'number' && !Number.isNaN(ts));
  const minTime = timeValues.length ? Math.min(...timeValues) : Date.now();
  const maxTime = timeValues.length ? Math.max(...timeValues) : Date.now();
  const midTime = minTime + (maxTime - minTime) / 2;
  const formatTimeLabel = (time: number) =>
    new Date(time).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });

  const marginX = (width - chartWidth) / 2;
  const marginY = (height - chartHeight) / 2;
  const timelineLength = timeline.length;
  const horizontalLines = 4;
  const stepY = chartHeight / horizontalLines;
  const yTicks = Array.from({ length: horizontalLines + 1 }, (_, idx) =>
    max - ((max - min) * idx) / horizontalLines,
  );
  const xTicks: Array<{ time: number; position: number }> = [
    { time: minTime, position: marginX },
    { time: midTime, position: marginX + chartWidth / 2 },
    { time: maxTime, position: marginX + chartWidth },
  ];
  const stepX = timelineLength > 1 ? chartWidth / (timelineLength - 1) : 0;

  const handleTouch = useCallback(
    (x: number) => {
      if (!interactive || !timelineLength) {
        return;
      }
      const lower = marginX;
      const upper = marginX + chartWidth;
      const clamped = Math.min(Math.max(x, lower), upper);
      const denominator = chartWidth <= 0 ? 1 : chartWidth;
      const ratio = (clamped - lower) / denominator;
      const index = timelineLength > 1 ? Math.round(ratio * (timelineLength - 1)) : 0;
      setActiveIndex(index);
    },
    [chartWidth, interactive, marginX, timelineLength],
  );

  const handleGesture = useCallback(
    (event: GestureResponderEvent) => {
      handleTouch(event.nativeEvent.locationX);
    },
    [handleTouch],
  );

  const panResponder = useMemo<PanResponderInstance | null>(() => {
    if (!interactive || !timelineLength) {
      return null;
    }
    return PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onStartShouldSetPanResponderCapture: () => true,
      onMoveShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponderCapture: () => true,
      onPanResponderGrant: handleGesture,
      onPanResponderMove: handleGesture,
      onPanResponderRelease: handleGesture,
      onPanResponderTerminationRequest: () => true,
      onPanResponderTerminate: () => undefined,
    });
  }, [handleGesture, interactive, timelineLength]);

  const activeData = useMemo(() => {
    if (activeIndex === null || !timelineLength) {
      return null;
    }
    const timePoint = timeline[activeIndex];
    if (!timePoint) {
      return null;
    }
    const values = series.map((s) => {
      const point = s.points[activeIndex];
      return {
        id: s.id,
        name: s.name,
        color: s.color,
        value: point?.value ?? null,
      };
    });
    return {
      time: typeof timePoint.ts === 'number' ? timePoint.ts : null,
      values,
    };
  }, [activeIndex, series, timeline, timelineLength]);

  const cursorX = useMemo(() => {
    if (activeIndex === null || !timelineLength) {
      return null;
    }
    if (timelineLength === 1) {
      return marginX + chartWidth / 2;
    }
    return marginX + activeIndex * stepX;
  }, [activeIndex, chartWidth, marginX, stepX, timelineLength]);

  const tooltipLeft = useMemo(() => {
    if (!activeData || cursorX === null) {
      return null;
    }
    if (!tooltipWidth) {
      return cursorX;
    }
    const raw = cursorX - tooltipWidth / 2;
    const minLeft = 8;
    const maxLeft = width - tooltipWidth - 8;
    return Math.min(Math.max(raw, minLeft), maxLeft);
  }, [activeData, cursorX, tooltipWidth, width]);

  const hasData = info.hasData;

  const handleLayout = useCallback((event: LayoutChangeEvent) => {
    const nextWidth = event.nativeEvent.layout.width;
    if (!nextWidth) {
      return;
    }
    setLayoutWidth((prev) => {
      if (prev === null || Math.abs(prev - nextWidth) > 1) {
        return nextWidth;
      }
      return prev;
    });
  }, []);

  return (
    <View
      style={[styles.container, { height }]}
      onLayout={handleLayout}
      {...(panResponder ? panResponder.panHandlers : undefined)}
    >
      {hasData ? (
        <Svg width={width} height={height}>
          <G translate={`0,0`}>
            <Rect
              x={marginX}
              y={marginY}
              width={chartWidth}
              height={chartHeight}
              fill="#f8fafc"
              stroke="#cbd5f5"
              strokeWidth={1}
              rx={12}
            />
            {Array.from({ length: horizontalLines + 1 }).map((_, idx) => (
              <Line
                key={`grid-${idx}`}
                x1={marginX}
                y1={marginY + idx * stepY}
                x2={marginX + chartWidth}
                y2={marginY + idx * stepY}
                stroke="#e2e8f0"
                strokeDasharray="4 4"
                strokeWidth={1}
              />
            ))}
            <Line
              x1={marginX}
              y1={marginY}
              x2={marginX}
              y2={marginY + chartHeight}
              stroke="#94a3b8"
              strokeWidth={1}
            />
            <Line
              x1={marginX}
              y1={marginY + chartHeight}
              x2={marginX + chartWidth}
              y2={marginY + chartHeight}
              stroke="#94a3b8"
              strokeWidth={1}
            />
            {yTicks.map((tick, idx) => (
              <SvgText
                key={`y-${idx}`}
                x={marginX - 8}
                y={marginY + idx * stepY + 4}
                fontSize={10}
                fill="#475569"
                textAnchor="end"
              >
                {tick.toFixed(2)}
              </SvgText>
            ))}
            {xTicks.map((tick, idx) => (
              <SvgText
                key={`x-${idx}`}
                x={tick.position}
                y={marginY + chartHeight + 16}
                fontSize={10}
                fill="#475569"
                textAnchor={idx === 0 ? 'start' : idx === xTicks.length - 1 ? 'end' : 'middle'}
              >
                {formatTimeLabel(tick.time)}
              </SvgText>
            ))}
            {series.map((s) => {
              const path = buildPath(s.points, chartWidth, chartHeight, min, max);
              if (!path) {
                return null;
              }
              return (
                <Path
                  key={s.id}
                  d={path}
                  stroke={s.color}
                  strokeWidth={2.5}
                  fill="transparent"
                  transform={`translate(${marginX}, ${marginY})`}
                />
              );
            })}
          </G>
        </Svg>
      ) : (
        <View style={styles.emptyState}>
          <Text style={styles.emptyText}>Select KPIs and tap Preview to render the graph.</Text>
        </View>
      )}
      {interactive && hasData && activeData && cursorX !== null ? (
        <>
          <View
            pointerEvents="none"
            style={[
              styles.cursorLine,
              {
                left: cursorX,
                top: marginY,
                height: chartHeight,
              },
            ]}
          />
          {tooltipLeft !== null ? (
            <View
              pointerEvents="none"
              style={[
                styles.tooltipContainer,
                {
                  left: tooltipLeft,
                  top: marginY + 12,
                },
              ]}
            >
              <View
                style={styles.tooltip}
                onLayout={(event) => {
                  const nextWidth = event.nativeEvent.layout.width;
                  if (nextWidth && Math.abs(nextWidth - tooltipWidth) > 1) {
                    setTooltipWidth(nextWidth);
                  }
                }}
              >
                <Text style={styles.tooltipTitle}>{formatTooltipTimestamp(activeData.time)}</Text>
                {activeData.values.map((item) => (
                  <View key={item.id} style={styles.tooltipRow}>
                    <View style={[styles.tooltipSwatch, { backgroundColor: item.color }]} />
                    <Text style={styles.tooltipSeries}>
                      {item.name}
                    </Text>
                    <Text style={styles.tooltipValue}>{formatNumber(item.value)}</Text>
                  </View>
                ))}
              </View>
            </View>
          ) : null}
        </>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
    borderRadius: 16,
    backgroundColor: '#ffffff',
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#e2e8f0',
  },
  emptyText: {
    color: '#64748b',
    textAlign: 'center',
    paddingHorizontal: 24,
    fontSize: 14,
  },
  emptyState: {
    flex: 1,
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  rangeRow: {
    position: 'absolute',
    bottom: 12,
    left: 24,
    right: 24,
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  rangeLabel: {
    color: '#475569',
    fontSize: 12,
    fontWeight: '600',
  },
  cursorLine: {
    position: 'absolute',
    width: StyleSheet.hairlineWidth * 1.5,
    backgroundColor: '#1e293b',
    opacity: 0.4,
  },
  tooltipContainer: {
    position: 'absolute',
  },
  tooltip: {
    backgroundColor: '#0f172a',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    shadowColor: '#0f172a',
    shadowOpacity: 0.2,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 4,
    gap: 6,
    alignSelf: 'flex-start',
  },
  tooltipTitle: {
    color: '#e2e8f0',
    fontSize: 12,
    fontWeight: '600',
  },
  tooltipRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  tooltipSwatch: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  tooltipSeries: {
    color: '#cbd5f5',
    fontSize: 12,
    flexGrow: 0,
    flexShrink: 0,
  },
  tooltipValue: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '600',
  },
});

export default LineChart;
