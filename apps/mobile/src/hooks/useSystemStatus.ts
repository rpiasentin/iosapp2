import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertsResponse,
  createApiClient,
  HealthResponse,
  SchedulerStatusResponse,
  VrmHealthResponse,
} from '@inverter/api-client';

export interface SystemStatusData {
  readonly health: HealthResponse;
  readonly alerts: AlertsResponse;
  readonly vrm: VrmHealthResponse;
  readonly scheduler: SchedulerStatusResponse;
  readonly fetchedAt: Date;
}

export type SystemStatusState =
  | { status: 'idle' | 'loading'; data: null; error: null }
  | { status: 'ready'; data: SystemStatusData; error: null }
  | { status: 'error'; data: SystemStatusData | null; error: string };

export function useSystemStatus(baseUrl: string): { state: SystemStatusState; refresh: () => void } {
  const api = useMemo(() => createApiClient({ baseUrl }), [baseUrl]);
  const [state, setState] = useState<SystemStatusState>({ status: 'idle', data: null, error: null });
  const mountedRef = useRef(true);

  useEffect(() => {
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const fetchStatus = useCallback(async () => {
    if (!mountedRef.current) {
      return;
    }
    setState((prev) => {
      if (prev.status === 'ready') {
        return prev;
      }
      return { status: 'loading', data: null, error: null };
    });

    try {
      const [health, alerts, vrm, scheduler] = await Promise.all([
        api.getHealth({ timeoutMs: 4000 }),
        api.getAlerts({ timeoutMs: 4000 }),
        api.getVrmHealth({ timeoutMs: 4000 }),
        api.getSchedulerStatus({ timeoutMs: 4000 }),
      ]);

      if (!mountedRef.current) {
        return;
      }
      setState({
        status: 'ready',
        data: { health, alerts, vrm, scheduler, fetchedAt: new Date() },
        error: null,
      });
    } catch (error) {
      if (!mountedRef.current) {
        return;
      }
      const message = error instanceof Error ? error.message : 'Unable to refresh system status';
      setState((prev) => {
        if (prev.status === 'ready') {
          return { status: 'error', data: prev.data, error: message };
        }
        return { status: 'error', data: null, error: message };
      });
    }
  }, [api]);

  useEffect(() => {
    fetchStatus();
  }, [fetchStatus]);

  useEffect(() => {
    const id = setInterval(() => {
      fetchStatus();
    }, 20000);
    return () => clearInterval(id);
  }, [fetchStatus]);

  return {
    state,
    refresh: fetchStatus,
  };
}
