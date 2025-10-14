import React, { useCallback, useMemo } from 'react';
import {
  Linking,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { Card, Section, StatusPill } from '@inverter/ui';

import { useSystemStatus } from '../hooks/useSystemStatus';
import { formatNumber, formatRelativeTime } from '../utils/format';

export interface NavigationScreenProps {
  readonly baseUrl: string;
  readonly onOpenDashboard: () => void;
  readonly onOpenCombinedMath: () => void;
  readonly onOpenSetup: () => void;
  readonly onOpenVrmDashboard: () => void;
  readonly onOpenScheduler: () => void;
  readonly onShowPlaceholder: (options: { title: string; description?: string; link?: string }) => void;
}

function healthTone(ageSeconds: number | null | undefined): 'neutral' | 'success' | 'warning' | 'danger' {
  if (ageSeconds === null || ageSeconds === undefined) {
    return 'neutral';
  }
  if (ageSeconds <= 150) {
    return 'success';
  }
  if (ageSeconds <= 600) {
    return 'warning';
  }
  return 'danger';
}

export function NavigationScreen({
  baseUrl,
  onOpenDashboard,
  onOpenCombinedMath,
  onOpenSetup,
  onOpenVrmDashboard,
  onOpenScheduler,
  onShowPlaceholder,
}: NavigationScreenProps) {
  const { state, refresh } = useSystemStatus(baseUrl);
  const statusData = state.status === 'ready' || (state.status === 'error' && state.data) ? state.data : null;

  const vrmTone: 'neutral' | 'success' | 'warning' | 'danger' = useMemo(() => {
    if (!statusData) {
      return 'neutral';
    }
    if (statusData.alerts.vrm_settings_failed) {
      return 'danger';
    }
    if (statusData.vrm.configured) {
      if ((statusData.vrm.samples?.count ?? 0) > 0) {
        return 'success';
      }
      return 'warning';
    }
    return 'neutral';
  }, [statusData]);

  const setupStatus = useMemo(() => {
    if (!statusData) {
      return { label: 'Review', tone: 'neutral' as const };
    }
    const credentials = Boolean(statusData.health.base_url);
    const serial = Boolean(statusData.health.serial);
    const hasSamples = (statusData.health.samples?.count ?? 0) > 0;
    if (statusData.alerts.eg4_settings_failed) {
      return { label: 'Attention', tone: 'danger' as const };
    }
    if (credentials && serial && hasSamples) {
      return { label: 'Ready', tone: 'success' as const };
    }
    if (credentials || serial || hasSamples) {
      return { label: 'In Progress', tone: 'warning' as const };
    }
    return { label: 'Start', tone: 'warning' as const };
  }, [statusData]);

  const vrmStatus = useMemo(() => {
    if (!statusData) {
      return { label: 'Review', tone: 'neutral' as const };
    }
    if (statusData.alerts.vrm_settings_failed) {
      return { label: 'Attention', tone: 'danger' as const };
    }
    if (!statusData.vrm.configured) {
      return { label: 'Link', tone: 'warning' as const };
    }
    if ((statusData.vrm.samples?.count ?? 0) > 0) {
      return { label: 'Ready', tone: 'success' as const };
    }
    return { label: 'Waiting', tone: 'warning' as const };
  }, [statusData]);

  const openExternal = useCallback(
    async (path: string) => {
      try {
        const url = path.startsWith('http') ? path : `${baseUrl}${path.startsWith('/') ? '' : '/'}${path}`;
        const supported = await Linking.canOpenURL(url);
        if (supported) {
          await Linking.openURL(url);
        } else {
          onShowPlaceholder({
            title: 'External Link',
            description: `Cannot open ${url} on this device.`,
          });
        }
      } catch (error) {
        onShowPlaceholder({
          title: 'External Link',
          description: error instanceof Error ? error.message : 'Unable to open link',
        });
      }
    },
    [baseUrl, onShowPlaceholder],
  );

  const statusMessage = state.status === 'error' && state.error ? state.error : null;

  return (
    <ScrollView
      contentInsetAdjustmentBehavior="automatic"
      contentContainerStyle={styles.container}
    >
      <View style={styles.headerRow}>
        <View>
          <Text style={styles.heading}>Navigation</Text>
          <Text style={styles.subheading}>Quick access to dashboards, diagnostics, and data tools.</Text>
        </View>
        <Pressable style={styles.refreshButton} onPress={refresh} accessibilityRole="button">
          <Text style={styles.refreshLabel}>Refresh</Text>
        </Pressable>
      </View>

      {statusMessage ? (
        <Card>
          <Text style={styles.errorText}>{statusMessage}</Text>
        </Card>
      ) : null}

      <Section title="Status">
        <Card>
          <View style={styles.statusRow}>
            <View style={styles.statusEntry}>
              <Text style={styles.statusLabel}>EG4 Backend</Text>
              <StatusPill
                label={statusData ? statusData.health.status.toUpperCase() : 'UNKNOWN'}
                tone={healthTone(statusData?.health.samples?.age_seconds ?? null)}
              />
              <Text style={styles.statusMeta}>
                {statusData?.health.samples.last_ts
                  ? formatRelativeTime(statusData.health.samples.last_ts)
                  : 'No samples yet'}
              </Text>
            </View>
            <View style={styles.statusEntry}>
              <Text style={styles.statusLabel}>Victron VRM</Text>
              <StatusPill
                label={statusData?.vrm.configured ? 'CONFIGURED' : 'OFF'}
                tone={vrmTone}
              />
              <Text style={styles.statusMeta}>
                {statusData?.vrm.samples.last_ts
                  ? formatRelativeTime(statusData.vrm.samples.last_ts)
                  : statusData?.vrm.configured
                  ? 'Waiting for data'
                  : 'Connect from Victron Login'}
              </Text>
            </View>
            <View style={styles.statusEntry}>
              <Text style={styles.statusLabel}>Scheduler</Text>
              <StatusPill
                label={(statusData?.scheduler.last_status ?? 'idle').toUpperCase()}
                tone={healthTone(statusData?.scheduler.last_status === 'failed' ? 1000 : 0)}
              />
              <Text style={styles.statusMeta}>
                {statusData?.scheduler.last_tick
                  ? formatRelativeTime(statusData.scheduler.last_tick)
                  : 'No ticks yet'}
              </Text>
            </View>
          </View>
        </Card>
      </Section>

      <Section title="Dashboards">
        <Card>
          <Pressable style={styles.navItem} onPress={onOpenDashboard} accessibilityRole="button">
            <Text style={styles.navItemTitle}>EG4 Dashboard</Text>
            <Text style={styles.navItemSubtitle}>Realtime inverter metrics and alerts.</Text>
          </Pressable>
          <Pressable
            style={styles.navItem}
            onPress={onOpenVrmDashboard}
            accessibilityRole="button"
          >
            <View style={styles.navItemHeader}>
              <Text style={styles.navItemTitle}>VRM Dashboard</Text>
              <StatusPill label={vrmStatus.label} tone={vrmStatus.tone} />
            </View>
            <Text style={styles.navItemSubtitle}>Historical Victron data and alias views.</Text>
          </Pressable>
          <Pressable
            style={styles.navItem}
            onPress={onOpenCombinedMath}
            accessibilityRole="button"
          >
            <Text style={styles.navItemTitle}>Combined Dashboard Math</Text>
            <Text style={styles.navItemSubtitle}>Configure integrated metrics across EG4 and VRM.</Text>
          </Pressable>
          <Pressable
            style={styles.navItem}
            onPress={() =>
              onShowPlaceholder({
                title: 'Combined Dashboard',
                description: 'Unified EG4 + VRM charts will be surfaced in an upcoming milestone.',
              })
            }
            accessibilityRole="button"
          >
            <Text style={styles.navItemTitle}>Combined Dashboard</Text>
            <Text style={styles.navItemSubtitle}>Compare PV, load, and storage across systems.</Text>
          </Pressable>
        </Card>
      </Section>

      <Section title="EG4">
        <Card>
          <Pressable
            style={styles.navItem}
            onPress={onOpenSetup}
            accessibilityRole="button"
          >
            <View style={styles.navItemHeader}>
              <Text style={styles.navItemTitle}>Setup</Text>
              <StatusPill label={setupStatus.label} tone={setupStatus.tone} />
            </View>
            <Text style={styles.navItemSubtitle}>Manage EG4 credentials and defaults.</Text>
          </Pressable>
          <Pressable
            style={styles.navItem}
            onPress={() =>
              onShowPlaceholder({
                title: 'Inverters',
                description: 'Select or review inverter metadata. Mobile UI coming soon.',
              })
            }
            accessibilityRole="button"
          >
            <Text style={styles.navItemTitle}>Inverters</Text>
            <Text style={styles.navItemSubtitle}>Pick the active inverter for data collection.</Text>
          </Pressable>
          <Pressable
            style={styles.navItem}
            onPress={() =>
              onShowPlaceholder({
                title: 'Diagnostics',
                description: 'The diagnostics dashboard is being ported to mobile.',
              })
            }
            accessibilityRole="button"
          >
            <Text style={styles.navItemTitle}>Diagnostics</Text>
            <Text style={styles.navItemSubtitle}>Inspect samples, settings history, and change coverage.</Text>
          </Pressable>
          <Pressable
            style={styles.navItem}
            onPress={() =>
              onShowPlaceholder({
                title: 'Settings',
                description: 'Settings editor will follow once scheduler management is available.',
              })
            }
            accessibilityRole="button"
          >
            <Text style={styles.navItemTitle}>Settings</Text>
            <Text style={styles.navItemSubtitle}>Stage and apply inverter configuration changes.</Text>
          </Pressable>
          <Pressable
            style={styles.navItem}
            onPress={() =>
              onShowPlaceholder({
                title: 'Change Log',
                description: 'Review the apply history from within the web app for now.',
              })
            }
            accessibilityRole="button"
          >
            <Text style={styles.navItemTitle}>Change Log</Text>
            <Text style={styles.navItemSubtitle}>Track EG4 and VRM configuration changes.</Text>
          </Pressable>
        </Card>
      </Section>

      <Section title="Scheduler">
        <Card>
          <View style={styles.schedulerRow}>
            <View style={styles.schedulerMetric}>
              <Text style={styles.schedulerLabel}>Next Actions</Text>
              <Text style={styles.schedulerValue}>{formatNumber(statusData?.scheduler.due_count ?? 0)}</Text>
            </View>
            <View style={styles.schedulerMetric}>
              <Text style={styles.schedulerLabel}>Last Tick</Text>
              <Text style={styles.schedulerMeta}>
                {statusData?.scheduler.last_tick
                  ? formatRelativeTime(statusData.scheduler.last_tick)
                  : 'No ticks yet'}
              </Text>
            </View>
            <View style={styles.schedulerMetric}>
              <Text style={styles.schedulerLabel}>Last Error</Text>
              <Text style={styles.schedulerMeta} numberOfLines={2}>
                {statusData?.scheduler.last_error ?? 'None'}
              </Text>
            </View>
          </View>
          <Pressable
            style={styles.navItem}
            onPress={onOpenScheduler}
            accessibilityRole="button"
          >
            <Text style={styles.navItemTitle}>Scheduler Console</Text>
            <Text style={styles.navItemSubtitle}>Queue upcoming applies and inspect recent events.</Text>
          </Pressable>
        </Card>
      </Section>

      <Section title="Victron VRM">
        <Card>
          <Pressable
            style={styles.navItem}
            onPress={() =>
              onShowPlaceholder({
                title: 'Victron Login',
                description: 'Log in from the backend web app while the mobile auth flow is under construction.',
              })
            }
            accessibilityRole="button"
          >
            <Text style={styles.navItemTitle}>Login</Text>
            <Text style={styles.navItemSubtitle}>Authenticate the VRM integration.</Text>
          </Pressable>
          <Pressable
            style={styles.navItem}
            onPress={() =>
              onShowPlaceholder({
                title: 'Installations',
                description: 'Pick VRM systems to monitor. Coming soon to mobile.',
              })
            }
            accessibilityRole="button"
          >
            <Text style={styles.navItemTitle}>Installations</Text>
            <Text style={styles.navItemSubtitle}>Select the VRM site for combined dashboards.</Text>
          </Pressable>
          <Pressable
            style={styles.navItem}
            onPress={() =>
              onShowPlaceholder({
                title: 'Devices',
                description: 'Device explorer UI is planned; use the web app meanwhile.',
              })
            }
            accessibilityRole="button"
          >
            <Text style={styles.navItemTitle}>Devices</Text>
            <Text style={styles.navItemSubtitle}>Browse VRM device telemetry and aliases.</Text>
          </Pressable>
          <Pressable
            style={styles.navItem}
            onPress={() => openExternal('/api/victron/samples/last')}
            accessibilityRole="button"
          >
            <Text style={styles.navItemTitle}>Last Sample (JSON)</Text>
            <Text style={styles.navItemSubtitle}>Open the latest VRM payload in your browser.</Text>
          </Pressable>
          <Pressable
            style={styles.navItem}
            onPress={() => openExternal('/api/victron/debug/diagnostics')}
            accessibilityRole="button"
          >
            <Text style={styles.navItemTitle}>Diagnostics Logs (JSON)</Text>
            <Text style={styles.navItemSubtitle}>Raw VRM diagnostics feed.</Text>
          </Pressable>
          <Pressable
            style={styles.navItem}
            onPress={() => openExternal('/api/victron/debug/overview')}
            accessibilityRole="button"
          >
            <Text style={styles.navItemTitle}>System Overview (JSON)</Text>
            <Text style={styles.navItemSubtitle}>Device list with product metadata.</Text>
          </Pressable>
          <Pressable
            style={styles.navItem}
            onPress={() => openExternal('/api/victron/health')}
            accessibilityRole="button"
          >
            <Text style={styles.navItemTitle}>Health (JSON)</Text>
            <Text style={styles.navItemSubtitle}>VRM collector status endpoint.</Text>
          </Pressable>
        </Card>
      </Section>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingVertical: 24,
    paddingHorizontal: 20,
    gap: 20,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
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
  refreshButton: {
    backgroundColor: '#0f172a',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 999,
  },
  refreshLabel: {
    color: '#ffffff',
    fontWeight: '600',
    letterSpacing: 0.5,
  },
  errorText: {
    color: '#b91c1c',
    fontWeight: '600',
  },
  statusRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 16,
  },
  statusEntry: {
    flexBasis: '30%',
    minWidth: 160,
    gap: 6,
  },
  statusLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#0f172a',
  },
  statusMeta: {
    color: '#64748b',
    fontSize: 13,
  },
  navItem: {
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#e2e8f0',
    gap: 4,
  },
  navItemHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  navItemTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#0f172a',
  },
  navItemSubtitle: {
    marginTop: 4,
    color: '#64748b',
  },
  schedulerRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 16,
    marginBottom: 12,
  },
  schedulerMetric: {
    minWidth: 140,
    flexGrow: 1,
    gap: 4,
  },
  schedulerLabel: {
    fontSize: 13,
    color: '#64748b',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  schedulerValue: {
    fontSize: 24,
    fontWeight: '700',
    color: '#0f172a',
  },
  schedulerMeta: {
    color: '#475569',
    fontSize: 14,
  },
});

export default NavigationScreen;
