import React, { useCallback, useMemo } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';

import { Card, Section, StatusPill, type PillTone } from '@inverter/ui';

import { useSystemStatus } from '../hooks/useSystemStatus';
import { formatNumber, formatRelativeTime } from '../utils/format';

export interface SetupScreenProps {
  readonly baseUrl: string;
  readonly onBack: () => void;
  readonly onOpenLink: (url: string) => void;
}

interface SetupStepAction {
  readonly label: string;
  readonly onPress: () => void;
  readonly tone?: 'primary' | 'secondary';
}

interface SetupStepCardProps {
  readonly title: string;
  readonly description: string;
  readonly pillLabel: string;
  readonly pillTone: PillTone;
  readonly meta?: ReadonlyArray<string>;
  readonly actions?: ReadonlyArray<SetupStepAction>;
}

const README_SETUP_URL =
  'https://github.com/rpiasentin/iosapp2/blob/main/iosapp2/README.md#setup-checklist';
const WORKSTATION_SETUP_URL =
  'https://github.com/rpiasentin/iosapp2/blob/main/iosapp2/vscodetestreadme.md#backend-setup-checklist';

function SetupStepCard({ title, description, pillLabel, pillTone, meta, actions }: SetupStepCardProps) {
  return (
    <Card>
      <View style={styles.stepHeader}>
        <View style={styles.stepHeaderText}>
          <Text style={styles.stepTitle}>{title}</Text>
          <Text style={styles.stepDescription}>{description}</Text>
        </View>
        <StatusPill label={pillLabel} tone={pillTone} style={styles.stepPill} />
      </View>
      {meta && meta.length > 0 ? (
        <View style={styles.stepMetaColumn}>
          {meta.map((line, index) => (
            <Text key={`${line}-${index}`} style={styles.stepMeta}>
              {line}
            </Text>
          ))}
        </View>
      ) : null}
      {actions && actions.length > 0 ? (
        <View style={styles.stepActions}>
          {actions.map((action) => (
            <Pressable
              key={action.label}
              onPress={action.onPress}
              style={[styles.actionButton, action.tone === 'secondary' ? styles.actionButtonSecondary : null]}
              accessibilityRole="button"
            >
              <Text
                style={[
                  styles.actionButtonLabel,
                  action.tone === 'secondary' ? styles.actionButtonLabelSecondary : null,
                ]}
              >
                {action.label}
              </Text>
            </Pressable>
          ))}
        </View>
      ) : null}
    </Card>
  );
}

export function SetupScreen({ baseUrl, onBack, onOpenLink }: SetupScreenProps) {
  const { state, refresh } = useSystemStatus(baseUrl);
  const statusData =
    state.status === 'ready' || (state.status === 'error' && state.data) ? state.data : null;
  const initialLoading = state.status === 'loading' && !statusData;
  const errorMessage = state.status === 'error' ? state.error : null;

  const handleOpen = useCallback(
    (target: string) => {
      onOpenLink(target);
    },
    [onOpenLink],
  );

  const setupSteps = useMemo((): ReadonlyArray<SetupStepCardProps> => {
    if (!statusData) {
      return [
        {
          title: 'Connect EG4 Account',
          description: 'Save EG4 credentials so the collector can log in and read inverter data.',
          pillLabel: 'Pending',
          pillTone: 'neutral',
          actions: [
            { label: 'Open Setup Form', onPress: () => handleOpen('/setup') },
            { label: 'Setup Guide', onPress: () => handleOpen(README_SETUP_URL), tone: 'secondary' },
          ],
        },
      ];
    }

    const { health, vrm, scheduler, alerts } = statusData;

    const hasCredentials = Boolean(health.base_url);
    const effectiveBaseUrl = health.base_url ?? '—';

    const hasSerial = Boolean(health.serial);

    const sampleCount = health.samples?.count ?? 0;
    const sampleAge = health.samples?.age_seconds ?? null;
    const sampleFresh = sampleCount > 0 && (sampleAge === null || sampleAge <= 900);
    const sampleTone: PillTone = sampleCount === 0 ? 'warning' : sampleFresh ? 'success' : 'warning';
    const sampleLabel = sampleCount === 0 ? 'Waiting' : sampleFresh ? 'Active' : 'Stale';

    const lastSampleTs = health.samples?.last_ts ?? null;

    const vrmConfigured = Boolean(vrm.configured);
    const vrmTone: PillTone = alerts.vrm_settings_failed ? 'danger' : vrmConfigured ? 'success' : 'warning';
    const vrmLabel = alerts.vrm_settings_failed ? 'Error' : vrmConfigured ? 'Configured' : 'Optional';

    const schedulerStatus = (scheduler.last_status ?? '').toLowerCase();
    const schedulerErrored = schedulerStatus === 'failed' || Boolean(scheduler.last_error);
    const schedulerTone: PillTone = schedulerErrored ? 'danger' : scheduler.due_count > 0 ? 'warning' : 'success';
    const schedulerLabel = schedulerErrored ? 'Error' : scheduler.due_count > 0 ? 'Queued' : 'Ready';

    return [
      {
        title: 'Connect EG4 Account',
        description: 'Save EG4 credentials so the collector can log in and read inverter data.',
        pillLabel: hasCredentials ? 'Complete' : 'Missing',
        pillTone: hasCredentials ? 'success' : 'danger',
        meta: hasCredentials
          ? [`Base URL ${effectiveBaseUrl}`]
          : ['Open the backend setup form to add your username, password, and base URL.'],
        actions: [
          { label: hasCredentials ? 'Review Credentials' : 'Open Setup Form', onPress: () => handleOpen('/setup') },
          { label: 'Setup Guide', onPress: () => handleOpen(README_SETUP_URL), tone: 'secondary' },
        ],
      },
      {
        title: 'Select Primary Inverter',
        description: 'Pick the inverter serial number to monitor after credentials are validated.',
        pillLabel: hasSerial ? 'Complete' : 'Action Needed',
        pillTone: hasSerial ? 'success' : 'warning',
        meta: hasSerial
          ? [`Active serial ${health.serial}`]
          : ['No inverter selected yet. Use the web selector after logging in.'],
        actions: [
          { label: 'Open Inverter Selector', onPress: () => handleOpen('/inverters') },
          { label: 'Workstation Checklist', onPress: () => handleOpen(WORKSTATION_SETUP_URL), tone: 'secondary' },
        ],
      },
      {
        title: 'Verify Data Ingestion',
        description: 'Confirm the collector is streaming runtime samples into the database.',
        pillLabel: sampleLabel,
        pillTone: sampleTone,
        meta: [
          `Samples ingested ${formatNumber(sampleCount)}`,
          `Last sample ${formatRelativeTime(lastSampleTs, 'never')}`,
        ],
        actions: [
          { label: 'Open Diagnostics', onPress: () => handleOpen('/diagnostics') },
        ],
      },
      {
        title: 'Link Victron VRM (Optional)',
        description: 'Connect a Victron system to include VRM data in dashboards and combined metrics.',
        pillLabel: vrmLabel,
        pillTone: vrmTone,
        meta: vrmConfigured
          ? [
              vrm.system_id ? `System ID ${vrm.system_id}` : 'VRM token stored',
              `VRM samples ${formatNumber(vrm.samples?.count ?? 0)}`,
            ]
          : ['Log in with your Victron credentials and select the installation to monitor.'],
        actions: [
          { label: vrmConfigured ? 'Review VRM Session' : 'Open Victron Login', onPress: () => handleOpen('/victron/login') },
          { label: 'Manage Installations', onPress: () => handleOpen('/victron/installations'), tone: 'secondary' },
        ],
      },
      {
        title: 'Scheduler Status',
        description: 'Ensure scheduled applies and background jobs are running as expected.',
        pillLabel: schedulerLabel,
        pillTone: schedulerTone,
        meta: [
          `Last status ${(scheduler.last_status ?? 'unknown').toUpperCase()}`,
          `Next actions queued ${formatNumber(scheduler.due_count)}`,
          scheduler.last_tick ? `Last tick ${formatRelativeTime(scheduler.last_tick, 'never')}` : 'Last tick never',
          scheduler.last_error ? `Last error ${scheduler.last_error}` : 'No errors reported',
        ],
        actions: [
          { label: 'View Scheduler Snapshot', onPress: () => handleOpen('/nav') },
        ],
      },
    ];
  }, [handleOpen, statusData]);

  const alertItems = useMemo(() => {
    if (!statusData) {
      return [] as Array<{ source: string; message: string }>;
    }
    const { alerts } = statusData;
    const items: Array<{ source: string; message: string }> = [];
    if (alerts.eg4_settings_failed) {
      items.push({ source: 'EG4', message: alerts.eg4_reason ?? 'Settings apply failed on the collector.' });
    }
    if (alerts.vrm_settings_failed) {
      items.push({ source: 'Victron', message: alerts.vrm_reason ?? 'Victron automation reported a failure.' });
    }
    return items;
  }, [statusData]);

  return (
    <View style={styles.screen}>
      <StatusBar style="dark" />
      <ScrollView contentInsetAdjustmentBehavior="automatic" contentContainerStyle={styles.content}>
        <View style={styles.headerRow}>
          <View style={styles.headerText}>
            <Text style={styles.heading}>Setup Checklist</Text>
            <Text style={styles.subheading}>
              Work through each item to finish onboarding this inverter environment.
            </Text>
          </View>
          <View style={styles.headerActions}>
            <Pressable style={styles.headerButton} onPress={onBack} accessibilityRole="button">
              <Text style={styles.headerButtonLabel}>Back</Text>
            </Pressable>
            <Pressable style={styles.headerButtonDark} onPress={refresh} accessibilityRole="button">
              <Text style={styles.headerButtonDarkLabel}>Refresh</Text>
            </Pressable>
          </View>
        </View>

        {statusData?.fetchedAt ? (
          <Text style={styles.timestamp}>Synced {formatRelativeTime(statusData.fetchedAt.toISOString())}</Text>
        ) : null}

        {initialLoading ? (
          <View style={styles.loading}>
            <ActivityIndicator size="large" color="#0f172a" />
            <Text style={styles.loadingLabel}>Loading setup status…</Text>
          </View>
        ) : null}

        {errorMessage ? (
          <Card style={styles.errorCard}>
            <Text style={styles.errorTitle}>Unable to refresh setup state</Text>
            <Text style={styles.errorMessage}>{errorMessage}</Text>
          </Card>
        ) : null}

        <Section title="Core Steps" contentStyle={styles.stepList}>
          {setupSteps.map((step) => (
            <SetupStepCard key={step.title} {...step} />
          ))}
        </Section>

        {alertItems.length > 0 ? (
          <Section title="Active Alerts" subtitle="Resolve these before applying additional settings.">
            <Card>
              <View style={styles.alertList}>
                {alertItems.map((alert) => (
                  <View key={alert.source} style={styles.alertItem}>
                    <StatusPill label={alert.source} tone="danger" />
                    <Text style={styles.alertMessage}>{alert.message}</Text>
                  </View>
                ))}
              </View>
            </Card>
          </Section>
        ) : null}

        <Section
          title="Need a refresher?"
          subtitle="The guides cover workstation prep, backend bootstrapping, and simulator tips."
        >
          <Card style={styles.helpCard}>
            <Text style={styles.helpText}>
              Review the written setup guides if you are pairing a new device or rebuilding a workstation. They include
              screenshots of the `/setup` and `/inverters` flows plus troubleshooting tips for Expo and the FastAPI
              backend.
            </Text>
            <View style={styles.helpActions}>
              <Pressable
                style={styles.actionButton}
                onPress={() => handleOpen(README_SETUP_URL)}
                accessibilityRole="button"
              >
                <Text style={styles.actionButtonLabel}>Project README</Text>
              </Pressable>
              <Pressable
                style={[styles.actionButton, styles.actionButtonSecondary]}
                onPress={() => handleOpen(WORKSTATION_SETUP_URL)}
                accessibilityRole="button"
              >
                <Text style={[styles.actionButtonLabel, styles.actionButtonLabelSecondary]}>
                  VS Code Test Guide
                </Text>
              </Pressable>
            </View>
          </Card>
        </Section>
      </ScrollView>
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
    gap: 4,
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
  timestamp: {
    color: '#64748b',
  },
  loading: {
    paddingVertical: 24,
    alignItems: 'center',
    gap: 12,
  },
  loadingLabel: {
    color: '#475569',
    fontSize: 16,
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
  stepList: {
    gap: 16,
  },
  stepHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
  },
  stepHeaderText: {
    flexShrink: 1,
    flexGrow: 1,
    gap: 6,
  },
  stepTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#0f172a',
  },
  stepDescription: {
    marginTop: 4,
    fontSize: 14,
    color: '#475569',
  },
  stepPill: {
    alignSelf: 'flex-start',
  },
  stepMetaColumn: {
    marginTop: 12,
    gap: 6,
  },
  stepMeta: {
    color: '#1e293b',
  },
  stepActions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginTop: 16,
  },
  actionButton: {
    backgroundColor: '#0f172a',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 999,
  },
  actionButtonSecondary: {
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#0f172a',
  },
  actionButtonLabel: {
    color: '#ffffff',
    fontWeight: '600',
    letterSpacing: 0.5,
  },
  actionButtonLabelSecondary: {
    color: '#0f172a',
  },
  alertList: {
    gap: 16,
  },
  alertItem: {
    flexDirection: 'row',
    gap: 12,
    alignItems: 'flex-start',
  },
  alertMessage: {
    flexShrink: 1,
    flexGrow: 1,
    color: '#7f1d1d',
  },
  helpCard: {
    gap: 12,
  },
  helpText: {
    color: '#475569',
    fontSize: 14,
    lineHeight: 20,
  },
  helpActions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
});

export default SetupScreen;
