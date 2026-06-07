import { useEffect, useMemo, useState } from 'react';
import { fetchSource } from '../api/consoleApi';
import { StatusChip } from '../components/StatusChip';
import type { SourceDetail } from '../types';

interface GuardianC2SnapshotPanelProps {
  onOpen: (target: string) => void;
}

type GuardianNode = {
  id?: string;
  label?: string;
  state?: string;
  facts?: Record<string, unknown>;
};

type GuardianEvent = {
  plane?: string;
  stage?: string;
  function?: string;
  at?: string;
  hook_level?: number;
};

type GuardianC2Payload = {
  schema?: string;
  generated_at_utc?: string;
  nodes?: Record<string, GuardianNode>;
  chain?: {
    state?: string;
    first_fault_node?: string;
    summary?: string;
    order?: string[];
    hints?: {
      structural_errors?: string[];
      merged_structural_errors?: string[];
      neo4j_last_action?: string;
      neo4j_last_error?: string;
    };
  };
  graph?: {
    nodes?: GuardianNode[];
    edges?: Array<{ from?: string; to?: string; type?: string }>;
  };
  live?: {
    active_plane?: string;
    events?: GuardianEvent[];
    heartbeat?: {
      cadence_sec?: number;
      signals?: Record<string, unknown>;
    };
    ha_control_plane_status?: {
      mode?: string;
      actuation_mode?: string;
      summary?: string;
      decision_summary?: string;
      actuation_attempt?: {
        dry_run?: boolean;
        applied?: unknown[];
        skipped?: unknown[];
      };
    };
  };
  drilldown?: {
    apply_gate?: {
      apply_would_block?: boolean;
      apply_block_reason?: string;
      critical_errors?: string[];
    };
  };
};

function objectPayload(payload: unknown): GuardianC2Payload | null {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) return null;
  return payload as GuardianC2Payload;
}

function text(value: unknown, fallback = 'unavailable') {
  if (value === null || value === undefined || value === '') return fallback;
  return String(value);
}

function short(value: unknown, fallback = 'unavailable') {
  const rendered = text(value, fallback);
  return rendered.length > 96 ? `${rendered.slice(0, 93)}...` : rendered;
}

function nodeTone(state?: string) {
  if (state === 'ok') return 'ok';
  if (state === 'alert' || state === 'fault') return 'hot';
  return 'warn';
}

export function GuardianC2SnapshotPanel({ onOpen }: GuardianC2SnapshotPanelProps) {
  const [detail, setDetail] = useState<SourceDetail<GuardianC2Payload | string> | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      const next = await fetchSource<GuardianC2Payload | string>('guardian_c2_snapshot', { loggerEvidence: false });
      if (!cancelled) setDetail(next);
    }
    load().catch(() => undefined);
    const timer = window.setInterval(() => load().catch(() => undefined), 60000);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, []);

  const payload = objectPayload(detail?.payload);
  const graphNodes = useMemo(() => {
    const fromGraph = payload?.graph?.nodes || [];
    if (fromGraph.length) return fromGraph.slice(0, 12);
    return Object.entries(payload?.nodes || {}).slice(0, 12).map(([id, node]) => ({ id, ...node }));
  }, [payload]);
  const nodeStateById = useMemo(() => {
    const entries = new Map<string, GuardianNode>();
    Object.entries(payload?.nodes || {}).forEach(([id, node]) => entries.set(id, { id, ...node }));
    (payload?.graph?.nodes || []).forEach(node => {
      if (node.id) entries.set(node.id, node);
    });
    return entries;
  }, [payload]);
  const faultRoute = (payload?.chain?.order || []).slice(0, 10).map((id, index) => ({
    id,
    index,
    node: nodeStateById.get(id),
    firstFault: id === payload?.chain?.first_fault_node
  }));
  const chainHints = [
    ...(payload?.chain?.hints?.merged_structural_errors || []),
    ...(payload?.chain?.hints?.structural_errors || []),
    payload?.chain?.hints?.neo4j_last_error,
    payload?.chain?.hints?.neo4j_last_action ? `Neo4j last action: ${payload.chain.hints.neo4j_last_action}` : ''
  ].filter(Boolean).slice(0, 4);
  const events = payload?.live?.events?.slice(0, 6) || [];
  const applyGate = payload?.drilldown?.apply_gate;
  const ha = payload?.live?.ha_control_plane_status;
  const applied = ha?.actuation_attempt?.applied?.length || 0;
  const skipped = ha?.actuation_attempt?.skipped?.length || 0;
  const state = detail?.ok && payload ? payload.chain?.state || 'ok' : detail ? 'degraded' : 'unavailable';

  return (
    <article className="ops-panel guardian-c2-panel">
      <div className="ops-title">
        <div>
          <p className="eyebrow">Guardian C2</p>
          <h2>Control Chain and Apply Gate</h2>
        </div>
        <button type="button" onClick={() => onOpen('guardian_c2_snapshot')}>Snapshot</button>
      </div>

      <div className="guardian-c2-headline">
        <div>
          <StatusChip state={state} />
          <h3>{payload?.chain?.summary || 'Waiting for Guardian C2 snapshot'}</h3>
          <p>{ha?.summary || payload?.generated_at_utc || detail?.error || 'owner-backed state unavailable'}</p>
        </div>
        <div className="guardian-c2-gate" onClick={() => onOpen('guardian_c2_snapshot')}>
          <span className={`router-chip ${applyGate?.apply_would_block ? 'hot' : 'ok'}`}>
            apply {applyGate?.apply_would_block ? 'blocked' : 'clear'}
          </span>
          <strong>{text(payload?.live?.active_plane, 'no active plane')}</strong>
          <small>{applyGate?.apply_block_reason || ha?.decision_summary || 'no apply gate reason returned'}</small>
        </div>
      </div>

      <div className="guardian-c2-metrics">
        <button type="button" onClick={() => onOpen('guardian_c2_snapshot')}>
          <strong>{graphNodes.length || '--'}</strong>
          <span>C2 nodes</span>
        </button>
        <button type="button" onClick={() => onOpen('guardian_c2_snapshot')}>
          <strong>{payload?.graph?.edges?.length ?? '--'}</strong>
          <span>evidence edges</span>
        </button>
        <button type="button" onClick={() => onOpen('guardian_c2_snapshot')}>
          <strong>{applied}/{skipped}</strong>
          <span>applied/skipped</span>
        </button>
        <button type="button" onClick={() => onOpen('guardian_c2_snapshot')}>
          <strong>{text(ha?.actuation_mode, '--')}</strong>
          <span>actuation mode</span>
        </button>
      </div>

      <div className="guardian-c2-graph">
        {graphNodes.map((node, index) => (
          <button
            className={`guardian-node ${nodeTone(node.state)}`}
            key={`${node.id || node.label}-${index}`}
            type="button"
            onClick={() => onOpen('guardian_c2_snapshot')}
          >
            <span>{node.id || node.label || `node ${index + 1}`}</span>
            <strong>{node.label || node.id || 'Guardian node'}</strong>
            <small>{text(node.state, 'unknown')}</small>
          </button>
        ))}
      </div>

      <div
        className="guardian-fault-chain"
        data-guardian-fault-state={text(payload?.chain?.state, 'missing')}
        data-guardian-first-fault={text(payload?.chain?.first_fault_node, 'none')}
        data-guardian-fault-route-count={faultRoute.length}
        data-guardian-fault-hints={chainHints.length}
      >
        <div className="panel-head">
          <div>
            <p className="eyebrow">Fault Chain</p>
            <h3>Owner-reported break route</h3>
          </div>
          <StatusChip state={payload?.chain?.state === 'fault' ? 'degraded' : state} label={text(payload?.chain?.state, 'missing')} />
        </div>
        <div className="guardian-fault-route">
          {faultRoute.map(step => (
            <button
              type="button"
              key={`${step.id}-${step.index}`}
              className={step.firstFault ? 'first-fault' : ''}
              onClick={() => onOpen('guardian_c2_snapshot')}
            >
              <span>{step.index + 1}</span>
              <strong>{step.id}</strong>
              <small>{step.firstFault ? 'first fault' : text(step.node?.state, 'state missing')}</small>
            </button>
          ))}
          {!faultRoute.length && (
            <button type="button" onClick={() => onOpen('guardian_c2_snapshot')}>
              <span>0</span>
              <strong>route missing</strong>
              <small>open Guardian source detail</small>
            </button>
          )}
        </div>
        <div className="guardian-fault-hints">
          <button type="button" onClick={() => onOpen('guardian_c2_snapshot')}>
            <strong>{text(payload?.chain?.first_fault_node, 'none')}</strong>
            <span>first fault node</span>
            <small>{short(payload?.chain?.summary, 'Guardian did not return a fault summary')}</small>
          </button>
          {chainHints.map((hint, index) => (
            <button type="button" key={`${hint}-${index}`} onClick={() => onOpen('guardian_c2_snapshot')}>
              <strong>{index + 1}</strong>
              <span>owner hint</span>
              <small>{short(hint)}</small>
            </button>
          ))}
        </div>
      </div>

      <div className="guardian-c2-events">
        {events.map((event, index) => (
          <button type="button" key={`${event.plane}-${event.stage}-${index}`} onClick={() => onOpen('guardian_c2_snapshot')}>
            <span>{event.at || 'no timestamp'}</span>
            <strong>{text(event.plane)} / {text(event.stage)}</strong>
            <small>{event.function || 'no function'} | L{event.hook_level ?? '--'}</small>
          </button>
        ))}
        {!events.length && <p>Waiting for Guardian event timeline.</p>}
      </div>
    </article>
  );
}
