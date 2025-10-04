import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';

export interface PlaceholderScreenProps {
  readonly title: string;
  readonly description?: string;
  readonly link?: string;
  readonly onBack: () => void;
  readonly onOpenLink?: (url: string) => void;
}

export function PlaceholderScreen({ title, description, link, onBack, onOpenLink }: PlaceholderScreenProps) {
  return (
    <View style={styles.screen}>
      <StatusBar style="dark" />
      <ScrollView contentInsetAdjustmentBehavior="automatic" contentContainerStyle={styles.content}>
        <Text style={styles.title}>{title}</Text>
        {description ? <Text style={styles.description}>{description}</Text> : null}
        <Pressable style={styles.primaryButton} onPress={onBack} accessibilityRole="button">
          <Text style={styles.primaryButtonText}>Back to Navigation</Text>
        </Pressable>
        {link && onOpenLink ? (
          <Pressable
            style={styles.secondaryButton}
            onPress={() => onOpenLink(link)}
            accessibilityRole="button"
          >
            <Text style={styles.secondaryButtonText}>Open in Browser</Text>
          </Pressable>
        ) : null}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  content: {
    paddingVertical: 48,
    paddingHorizontal: 24,
    gap: 20,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: '#0f172a',
  },
  description: {
    fontSize: 16,
    color: '#475569',
    lineHeight: 22,
  },
  primaryButton: {
    backgroundColor: '#0f172a',
    paddingVertical: 14,
    borderRadius: 999,
    alignItems: 'center',
  },
  primaryButtonText: {
    color: '#ffffff',
    fontWeight: '600',
    letterSpacing: 0.6,
  },
  secondaryButton: {
    borderWidth: 1,
    borderColor: '#0f172a',
    paddingVertical: 14,
    borderRadius: 999,
    alignItems: 'center',
  },
  secondaryButtonText: {
    color: '#0f172a',
    fontWeight: '600',
    letterSpacing: 0.6,
  },
});

export default PlaceholderScreen;
