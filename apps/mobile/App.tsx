import { StatusBar } from 'expo-status-bar';
import { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { createApiClient, HealthResponse } from '@inverter/api-client';

type HealthState =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'success'; data: HealthResponse }
  | { status: 'error'; error: string };

function useHealthCheck() {
  const [state, setState] = useState<HealthState>({ status: 'idle' });

  const api = useMemo(() => {
    const baseUrl = process.env.EXPO_PUBLIC_API_BASE_URL;
    if (!baseUrl) {
      throw new Error(
        'Missing EXPO_PUBLIC_API_BASE_URL. Add it to app config or .env before running the app.'
      );
    }
    return createApiClient({ baseUrl });
  }, []);

  const fetchHealth = () => {
    setState({ status: 'loading' });
    api
      .getHealth()
      .then((data) => {
        setState({ status: 'success', data });
      })
      .catch((error: unknown) => {
        const message =
          error instanceof Error ? error.message : 'Unknown error during health check';
        setState({ status: 'error', error: message });
      });
  };

  useEffect(() => {
    fetchHealth();
  }, []);

  return {
    state,
    refresh: fetchHealth,
  };
}

export default function App() {
  const { state, refresh } = useHealthCheck();

  return (
    <View style={styles.container}>
      <StatusBar style="auto" />
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={state.status === 'loading'} onRefresh={refresh} />}
      >
        <Text style={styles.title}>API Connectivity</Text>
        {state.status === 'loading' && <ActivityIndicator size="large" />}
        {state.status === 'error' && (
          <View style={styles.cardError}>
            <Text style={styles.cardTitle}>Health check failed</Text>
            <Text style={styles.cardBody}>{state.error}</Text>
          </View>
        )}
        {state.status === 'success' && (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Status: {state.data.status.toUpperCase()}</Text>
            <View style={styles.cardRow}>
              <Text style={styles.label}>Serial</Text>
              <Text style={styles.value}>{state.data.serial ?? '—'}</Text>
            </View>
            <View style={styles.cardRow}>
              <Text style={styles.label}>Samples</Text>
              <Text style={styles.value}>{state.data.samples.count}</Text>
            </View>
            <View style={styles.cardRow}>
              <Text style={styles.label}>Last Sample</Text>
              <Text style={styles.value}>{state.data.samples.last_ts ?? '—'}</Text>
            </View>
            <View style={styles.cardRow}>
              <Text style={styles.label}>Sample Age (s)</Text>
              <Text style={styles.value}>
                {state.data.samples.age_seconds != null
                  ? Math.round(state.data.samples.age_seconds)
                  : '—'}
              </Text>
            </View>
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f4f6f8',
  },
  content: {
    padding: 24,
    alignItems: 'stretch',
    gap: 16,
  },
  title: {
    fontSize: 24,
    fontWeight: '600',
    textAlign: 'center',
    marginBottom: 8,
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowOffset: { width: 0, height: 3 },
    shadowRadius: 8,
    elevation: 2,
  },
  cardError: {
    backgroundColor: '#fff4f4',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#f2b6b6',
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 12,
  },
  cardRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  label: {
    fontSize: 16,
    color: '#505154',
  },
  value: {
    fontSize: 16,
    fontWeight: '500',
    color: '#1f1f21',
  },
  cardBody: {
    fontSize: 16,
    color: '#1f1f21',
  },
});
