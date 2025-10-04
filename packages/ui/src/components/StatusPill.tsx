import React from 'react';
import { StyleProp, StyleSheet, Text, TextStyle, View, ViewStyle } from 'react-native';

export type PillTone = 'neutral' | 'success' | 'warning' | 'danger';

export interface StatusPillProps {
  readonly label: string;
  readonly tone?: PillTone;
  readonly style?: StyleProp<ViewStyle>;
  readonly textStyle?: StyleProp<TextStyle>;
}

const toneStyles: Record<PillTone, { background: string; text: string }> = {
  neutral: { background: '#e2e8f0', text: '#1e293b' },
  success: { background: '#dcfce7', text: '#166534' },
  warning: { background: '#fef3c7', text: '#92400e' },
  danger: { background: '#fee2e2', text: '#991b1b' },
};

export function StatusPill({ label, tone = 'neutral', style, textStyle }: StatusPillProps) {
  const colors = toneStyles[tone] ?? toneStyles.neutral;
  return (
    <View style={[styles.pill, { backgroundColor: colors.background }, style]}>
      <Text style={[styles.label, { color: colors.text }, textStyle]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  pill: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
  },
  label: {
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
});

export default StatusPill;
