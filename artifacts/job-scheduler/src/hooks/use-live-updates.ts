import { useState, useEffect, useCallback, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { 
  getGetDashboardStatsQueryKey,
  getGetDashboardMetricsQueryKey,
  getGetDashboardActivityQueryKey,
  getGetDashboardQueueSummaryQueryKey,
  getListAllJobsQueryKey,
  getListWorkersQueryKey,
  getListQueuesQueryKey
} from '@workspace/api-client-react';

export function useLiveUpdates() {
  const queryClient = useQueryClient();
  const [status, setStatus] = useState<'connecting' | 'connected' | 'disconnected'>('connecting');
  const ws = useRef<WebSocket | null>(null);

  const connect = useCallback(() => {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}/ws`;
    
    ws.current = new WebSocket(wsUrl);

    ws.current.onopen = () => {
      setStatus('connected');
    };

    ws.current.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        // data.type or event_type might exist
        
        // Broadly invalidate dashboard and relevant queries to pull fresh data
        // For a dense devtool, we'd ideally patch the cache, but invalidation is safer
        // unless we know the exact WS payload shape.
        queryClient.invalidateQueries({ queryKey: getGetDashboardStatsQueryKey() });
        queryClient.invalidateQueries({ queryKey: getGetDashboardMetricsQueryKey() });
        queryClient.invalidateQueries({ queryKey: getGetDashboardActivityQueryKey() });
        queryClient.invalidateQueries({ queryKey: getGetDashboardQueueSummaryQueryKey() });
        queryClient.invalidateQueries({ queryKey: getListWorkersQueryKey() });
        queryClient.invalidateQueries({ queryKey: getListAllJobsQueryKey() });
      } catch (e) {
        console.error('Failed to parse WS message', e);
      }
    };

    ws.current.onclose = () => {
      setStatus('disconnected');
      // Reconnect after 3 seconds
      setTimeout(connect, 3000);
    };

    ws.current.onerror = () => {
      ws.current?.close();
    };
  }, [queryClient]);

  useEffect(() => {
    connect();
    return () => {
      if (ws.current) {
        ws.current.close();
      }
    };
  }, [connect]);

  return { status };
}
