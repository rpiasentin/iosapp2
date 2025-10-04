import React, { ReactNode } from 'react';
import { StyleProp, StyleSheet, Text, TextStyle, View, ViewStyle } from 'react-native';

export interface SectionProps {
  readonly title?: string;
  readonly subtitle?: string;
  readonly children: ReactNode;
  readonly style?: StyleProp<ViewStyle>;
  readonly contentStyle?: StyleProp<ViewStyle>;
  readonly titleStyle?: StyleProp<TextStyle>;
  readonly subtitleStyle?: StyleProp<TextStyle>;
  readonly action?: ReactNode;
}

export function Section({
  title,
  subtitle,
  children,
  style,
  contentStyle,
  titleStyle,
  subtitleStyle,
  action,
}: SectionProps) {
  return (
    <View style={style}>
      {(title || subtitle || action) && (
        <View style={styles.header}>
          <View style={styles.headerText}>
            {title ? <Text style={[styles.title, titleStyle]}>{title}</Text> : null}
            {subtitle ? <Text style={[styles.subtitle, subtitleStyle]}>{subtitle}</Text> : null}
          </View>
          {action ? <View style={styles.action}>{action}</View> : null}
        </View>
      )}
      <View style={[styles.content, contentStyle]}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  headerText: {
    flexShrink: 1,
    flexGrow: 1,
  },
  title: {
    fontSize: 20,
    fontWeight: '600',
    color: '#0f172a',
  },
  subtitle: {
    marginTop: 4,
    fontSize: 14,
    color: '#6b7280',
  },
  action: {
    marginLeft: 12,
  },
  content: {
    gap: 12,
  },
});

export default Section;
