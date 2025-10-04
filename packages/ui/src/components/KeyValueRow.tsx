import React, { ReactNode } from 'react';
import { StyleProp, StyleSheet, Text, TextStyle, View, ViewStyle } from 'react-native';

export interface KeyValueRowProps {
  readonly label: string;
  readonly value: ReactNode;
  readonly style?: StyleProp<ViewStyle>;
  readonly labelStyle?: StyleProp<TextStyle>;
  readonly valueStyle?: StyleProp<TextStyle>;
  readonly wrap?: boolean;
}

export function KeyValueRow({
  label,
  value,
  style,
  labelStyle,
  valueStyle,
  wrap = false,
}: KeyValueRowProps) {
  const isTextValue = typeof value === 'string' || typeof value === 'number';
  const containerStyles = [styles.container, wrap ? styles.containerWrap : null, style];
  const labelStyles = [styles.label, labelStyle, wrap ? styles.labelWrap : null];
  const valueContainerStyles = [styles.valueContainer, wrap ? styles.valueContainerWrap : null];
  const valueTextStyles = [styles.valueText, valueStyle, wrap ? styles.valueTextWrap : null];

  return (
    <View style={containerStyles}>
      <Text style={labelStyles} numberOfLines={wrap ? undefined : 1}>
        {label}
      </Text>
      <View style={valueContainerStyles}>
        {isTextValue ? (
          <Text style={valueTextStyles} numberOfLines={wrap ? undefined : 1}>
            {value}
          </Text>
        ) : (
          value
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  containerWrap: {
    alignItems: 'flex-start',
  },
  label: {
    fontSize: 15,
    color: '#4b5563',
    minWidth: 96,
    fontWeight: '500',
  },
  labelWrap: {
    minWidth: 0,
  },
  valueContainer: {
    flexGrow: 1,
    flexShrink: 1,
    alignItems: 'flex-end',
  },
  valueContainerWrap: {
    alignItems: 'flex-start',
  },
  valueText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
    textAlign: 'right',
  },
  valueTextWrap: {
    textAlign: 'left',
  },
});

export default KeyValueRow;
