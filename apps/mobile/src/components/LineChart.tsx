import React, { useMemo } from 'react';
import { Dimensions, StyleSheet, Text, View } from 'react-native';
import Svg, { G, Line, Path, Rect } from 'react-native-svg';

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
}

function buildPath(points: ReadonlyArray<ChartPoint>, width: number, height: number, min: number, max: number): string {
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

export function LineChart({ series, height = 260 }: LineChartProps) {
  const timeline = series.length ? series[0].points : [];
  const info = useMemo(() => {
    const values: number[] = [];
    series.forEach((s) => {
      s.points.forEach((pt) => {
        if (pt.value !== null && !Number.isNaN(pt.value)) {
          values.push(pt.value);
        }
      });
    });
    const defaultWidth = Dimensions.get('window').width - 48;
    const width = Math.max(220, defaultWidth);
    if (!values.length || !timeline.length) {
      return {
        width,
        chartWidth: width - 32,
        chartHeight: height - 56,
        min: 0,
        max: 1,
        hasData: false,
      } as const;
    }
    const min = Math.min(...values);
    const max = Math.max(...values);
    return {
      width,
      chartWidth: width - 32,
      chartHeight: height - 56,
      min,
      max: min === max ? min + 1 : max,
      hasData: true,
    } as const;
  }, [height, series, timeline]);

  if (!info.hasData) {
    return (
      <View style={[styles.container, { height }]}> 
        <Text style={styles.emptyText}>Select KPIs and tap Preview to render the graph.</Text>
      </View>
    );
  }

  const { width, chartWidth, chartHeight, min, max } = info;
  const marginX = (width - chartWidth) / 2;
  const marginY = (height - chartHeight) / 2;
  const horizontalLines = 4;
  const stepY = chartHeight / horizontalLines;
  const labels = [max, min];

  return (
    <View style={[styles.container, { height }]}> 
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
              key={idx}
              x1={marginX}
              y1={marginY + idx * stepY}
              x2={marginX + chartWidth}
              y2={marginY + idx * stepY}
              stroke="#e2e8f0"
              strokeDasharray="4 4"
              strokeWidth={1}
            />
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
      <View style={styles.rangeRow}>
        <Text style={styles.rangeLabel}>Max {max.toFixed(2)}</Text>
        <Text style={styles.rangeLabel}>Min {min.toFixed(2)}</Text>
      </View>
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
});

export default LineChart;
