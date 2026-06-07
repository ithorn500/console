import { useEffect, useMemo, useState } from 'react';
import { StatusChip } from '../components/StatusChip';

interface SourceSummaryEvent {
  source_total?: number;
  deferred_sources?: number;
  blocked_sources?: number;
  cache_entries?: number;
  generated_at?: string;
}

interface StreamProofState {
  status: 'connecting' | 'open' | 'reconnecting' | 'closed';
  openCount: number;
  eventCount: number;
  lastEventId: string;
  lastHeartbeat: string;
  summary: SourceSummaryEvent | null;
}

function parseEvent<T>(event: MessageEvent<string>): T | null {
  try {
    return JSON.parse(event.data) as T;
  } catch {
    return null;
  }
}

export function ConsoleStreamProofPanel() {
  const [state, setState] = useState<StreamProofState>({
    status: 'connecting',
    openCount: 0,
    eventCount: 0,
    lastEventId: '--',
    lastHeartbeat: '--',
    summary: null
  });

  useEffect(() => {
    const source = new EventSource('/api/console/events');

    source.onopen = () => {
      setState(current => ({
        ...current,
        status: 'open',
        openCount: current.openCount + 1
      }));
    };

    source.addEventListener('console.heartbeat', event => {
      const payload = parseEvent<{ generated_at?: string }>(event as MessageEvent<string>);
      setState(current => ({
        ...current,
        eventCount: current.eventCount + 1,
        lastEventId: (event as MessageEvent<string>).lastEventId || current.lastEventId,
        lastHeartbeat: payload?.generated_at || current.lastHeartbeat
      }));
    });

    source.addEventListener('console.source_summary', event => {
      const payload = parseEvent<SourceSummaryEvent>(event as MessageEvent<string>);
      setState(current => ({
        ...current,
        eventCount: current.eventCount + 1,
        lastEventId: (event as MessageEvent<string>).lastEventId || current.lastEventId,
        summary: payload || current.summary
      }));
    });

    source.addEventListener('console.close', event => {
      setState(current => ({
        ...current,
        eventCount: current.eventCount + 1,
        lastEventId: (event as MessageEvent<string>).lastEventId || current.lastEventId,
        status: 'reconnecting'
      }));
    });

    source.onerror = () => {
      setState(current => ({
        ...current,
        status: source.readyState === EventSource.CLOSED ? 'closed' : 'reconnecting'
      }));
    };

    return () => source.close();
  }, []);

  const reconnects = Math.max(0, state.openCount - 1);
  const statusTone = state.status === 'open' || reconnects > 0 ? 'ok' : 'degraded';
  const summary = state.summary;
  const lastSeen = useMemo(() => {
    if (!state.lastHeartbeat || state.lastHeartbeat === '--') return '--';
    const parsed = Date.parse(state.lastHeartbeat);
    if (Number.isNaN(parsed)) return state.lastHeartbeat;
    return new Date(parsed).toLocaleTimeString();
  }, [state.lastHeartbeat]);

  return (
    <article
      className="panel wide stream-proof-panel"
      data-stream-events={state.eventCount}
      data-stream-reconnects={reconnects}
    >
      <div className="panel-head">
        <div>
          <p className="eyebrow">L6 Stream Proof</p>
          <h2>Console EventSource Reconnect</h2>
        </div>
        <StatusChip state={statusTone} label={reconnects > 0 ? 'reconnect proven' : state.status} />
      </div>

      <div className="stream-proof-grid">
        <section>
          <strong>{state.openCount}</strong>
          <span>opens</span>
          <small>bounded native SSE responses</small>
        </section>
        <section>
          <strong>{reconnects}</strong>
          <span>reconnects</span>
          <small>browser EventSource automatic retry</small>
        </section>
        <section>
          <strong>{state.eventCount}</strong>
          <span>events</span>
          <small>heartbeat, summary, close</small>
        </section>
        <section>
          <strong>{summary?.source_total ?? '--'}</strong>
          <span>sources</span>
          <small>Amber Bus contracts only</small>
        </section>
      </div>

      <div className="stream-proof-strip">
        <span><b>last event</b>{state.lastEventId}</span>
        <span><b>heartbeat</b>{lastSeen}</span>
        <span><b>deferred</b>{summary?.deferred_sources ?? '--'}</span>
        <span><b>blocked</b>{summary?.blocked_sources ?? '--'}</span>
        <span><b>cache</b>{summary?.cache_entries ?? '--'}</span>
      </div>
    </article>
  );
}
