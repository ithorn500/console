import { Background, Controls, Handle, MiniMap, Position, ReactFlow, type Edge, type Node, type NodeProps } from '@xyflow/react';
import { useEffect, useMemo, useState } from 'react';
import { fetchSource } from '../api/consoleApi';
import type { ConsoleOverview, ConsoleSource } from '../types';
import { StatusChip } from '../components/StatusChip';

interface AmberTopologyProps {
  overview: ConsoleOverview | null;
  onOpen: (target: string) => void;
}

type ServiceNodeData = {
  label: string;
  subtitle: string;
  target: string;
  state: string;
  tone: string;
  owner: string;
  duration: string;
  onOpen: (target: string) => void;
};

type TopologyEdge = {
  id: string;
  source: string;
  target: string;
  label: string;
  targetSource: string;
  animated?: boolean;
};

type AnyRecord = Record<string, unknown>;

type Signal = {
  metric: string;
  freshness: string;
  detail: string;
};

const signalTargets = [
  'amber_bus_apps',
  'logger_ops_dashboard',
  'lsb_state_status',
  'guardian_c2_snapshot',
  'memorr_email_timeline',
  'veliai_usage',
  'gemma_lanes',
  'neufab_status',
  'neufab_feedback',
  'actorr_operator_snapshot',
  'epic26_tasks'
];

function byId(sources: ConsoleSource[], id: string): ConsoleSource | undefined {
  return sources.find(source => source.id === id);
}

function sourceState(sources: ConsoleSource[], id: string) {
  return byId(sources, id)?.state || 'unavailable';
}

function sourceOwner(sources: ConsoleSource[], id: string) {
  return byId(sources, id)?.owner || 'owner unknown';
}

function sourceDuration(sources: ConsoleSource[], id: string) {
  const duration = byId(sources, id)?.duration_ms;
  return typeof duration === 'number' ? `${duration}ms` : '--';
}

function isLive(sources: ConsoleSource[], id: string) {
  return sourceState(sources, id) === 'ok';
}

function record(value: unknown): AnyRecord | null {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as AnyRecord : null;
}

function list(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function text(value: unknown, fallback = '--') {
  if (value === null || value === undefined || value === '') return fallback;
  const next = String(value);
  return next.length > 72 ? `${next.slice(0, 69)}...` : next;
}

function sourceSignal(target: string, payload: unknown, error?: string): Signal {
  const body = record(payload);
  if (!body) return { metric: error || 'unavailable', freshness: '--', detail: error || 'owner source unavailable through Bus' };
  if (target === 'amber_bus_apps') {
    const apps = list(body.applications || body.apps);
    return { metric: `${apps.length} apps`, freshness: text(body.generated_at), detail: 'registered app manifests' };
  }
  if (target === 'logger_ops_dashboard') {
    const analytics = record(body.analytics);
    const totals = record(analytics?.totals);
    return { metric: `${Number(totals?.incidents || 0)} incidents`, freshness: text(body.timestamp || analytics?.generated_at), detail: `${Number(totals?.logs || 0)} logs / ${Number(totals?.error_logs || 0)} errors` };
  }
  if (target === 'guardian_c2_snapshot') {
    return { metric: `${Object.keys(record(body.planes) || {}).length} planes`, freshness: text(body.generated_at_utc), detail: text(record(body.chain)?.summary, 'Guardian C2 chain') };
  }
  if (target === 'memorr_email_timeline') {
    const summary = record(body.summary);
    return { metric: `${Number(summary?.email_count || 0)} emails`, freshness: text(body.generated_at || summary?.generated_at), detail: `${Number(summary?.sealed_count || 0)} sealed / ${Number(summary?.formulated_memory_count || 0)} memories` };
  }
  if (target === 'veliai_usage') {
    const summary = record(body.summary);
    return { metric: `${Number(summary?.requests || 0)} requests`, freshness: text(body.generated_at), detail: `${list(body.usage).length} provider usage rows` };
  }
  if (target === 'gemma_lanes') {
    return { metric: `${list(body.lanes).length} lanes`, freshness: text(body.generated_at || body.emitted_at), detail: 'chat/embed/fast lane state' };
  }
  if (target === 'neufab_status' || target === 'neufab_feedback') {
    return { metric: `${Number(body.frame_count || 0)} frames`, freshness: text(record(body.last_frame)?.when_utc || body.generated_at), detail: text(body.protocol || body.schema, 'NeuFab fabric') };
  }
  if (target === 'epic26_tasks') {
    return { metric: `${Number(body.row_count || 0)} rows`, freshness: text(body.generated_at), detail: 'programme board source; Epic 26-specific rows still unavailable' };
  }
  return { metric: text(body.state || body.ok || 'seen'), freshness: text(body.generated_at || body.emitted_at || body.timestamp), detail: text(body.schema || target) };
}

function ServiceNode({ data }: NodeProps<Node<ServiceNodeData>>) {
  return (
    <button className={`flow-node ${data.tone}`} type="button" onClick={() => data.onOpen(data.target)}>
      <Handle type="target" position={Position.Left} />
      <Handle type="source" position={Position.Right} />
      <strong>{data.label}</strong>
      <span>{data.subtitle}</span>
      <StatusChip state={data.state} />
      <small>{data.owner} | {data.duration}</small>
    </button>
  );
}

const nodeTypes = { service: ServiceNode };

export function AmberTopology({ overview, onOpen }: AmberTopologyProps) {
  const sources = overview?.sources || [];
  const [signals, setSignals] = useState<Record<string, Signal>>({});

  useEffect(() => {
    let cancelled = false;
    async function load() {
      const results = await Promise.allSettled(signalTargets.map(target => fetchSource(target, { loggerEvidence: false })));
      if (cancelled) return;
      const next: Record<string, Signal> = {};
      signalTargets.forEach((target, index) => {
        const result = results[index];
        if (result.status === 'fulfilled') {
          next[target] = sourceSignal(target, result.value.payload, result.value.error);
        } else {
          next[target] = { metric: 'unavailable', freshness: '--', detail: result.reason instanceof Error ? result.reason.message : String(result.reason) };
        }
      });
      setSignals(next);
    }
    load().catch(() => undefined);
    const timer = window.setInterval(() => load().catch(() => undefined), 30000);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, []);

  const node = (
    id: string,
    label: string,
    subtitle: string,
    target: string,
    tone: string,
    x: number,
    y: number
  ): Node<ServiceNodeData> => ({
    id,
    type: 'service',
    position: { x, y },
    data: {
      label,
      subtitle,
      target,
      state: sourceState(sources, target),
      tone,
      owner: sourceOwner(sources, target),
      duration: sourceDuration(sources, target),
      onOpen
    }
  });
  const nodes: Node<ServiceNodeData>[] = [
    node('console', 'Amber Console', 'observability only', 'programme_epics', 'cyan', 455, 10),
    node('bus', 'Amber Bus', 'spine, apps, client health', 'amber_bus_apps', 'green', 250, 140),
    node('logger', 'Logger', 'proof and SLO evidence', 'logger_ops_dashboard', 'green', 30, 310),
    node('lsb', 'LSB', 'cognitive state and plan', 'lsb_state_status', 'cyan', 250, 500),
    node('guardian', 'Guardian C2', 'apply owner and lawn', 'guardian_c2_snapshot', 'amber', 500, 500),
    node('neufab', 'NeuFab', 'corpus callosum fabric', 'neufab_status', 'violet', 755, 500),
    node('veliai', 'Veliai', 'provider route graph', 'veliai_providers', 'violet', 755, 140),
    node('gemma', 'Gemma Gateway', 'lanes, heat, models', 'gemma_lanes', 'cyan', 1000, 250),
    node('memorr', 'Memorr', 'memory provenance', 'memorr_email_timeline', 'orange', 500, 310),
    node('actorr', 'Actorr', 'media operator flow', 'actorr_operator_snapshot', 'amber', 1000, 500),
    node('programme', 'Programme', 'ACSA tasks and gates', 'epic26_tasks', 'red', 30, 60)
  ];
  const topologyEdges: TopologyEdge[] = [
    { id: 'console-bus', source: 'console', target: 'bus', label: 'source catalog', targetSource: 'amber_bus_apps', animated: isLive(sources, 'amber_bus_apps') },
    { id: 'bus-logger', source: 'bus', target: 'logger', label: 'proof dashboard', targetSource: 'logger_ops_dashboard', animated: isLive(sources, 'logger_ops_dashboard') },
    { id: 'bus-lsb', source: 'bus', target: 'lsb', label: 'state + plan', targetSource: 'lsb_state_status', animated: isLive(sources, 'lsb_state_status') },
    { id: 'bus-guardian', source: 'bus', target: 'guardian', label: 'C2 invoke', targetSource: 'guardian_c2_snapshot', animated: isLive(sources, 'guardian_c2_snapshot') },
    { id: 'bus-memorr', source: 'bus', target: 'memorr', label: 'memory contract', targetSource: 'memorr_email_timeline', animated: isLive(sources, 'memorr_email_timeline') },
    { id: 'memorr-veliai', source: 'memorr', target: 'veliai', label: 'memory context', targetSource: 'veliai_usage', animated: isLive(sources, 'veliai_usage') },
    { id: 'veliai-gemma', source: 'veliai', target: 'gemma', label: 'route to lane', targetSource: 'gemma_lanes', animated: isLive(sources, 'gemma_lanes') },
    { id: 'guardian-neufab', source: 'guardian', target: 'neufab', label: 'semantics', targetSource: 'neufab_status', animated: isLive(sources, 'neufab_status') },
    { id: 'neufab-veliai', source: 'neufab', target: 'veliai', label: 'feedback', targetSource: 'neufab_feedback', animated: isLive(sources, 'neufab_feedback') },
    { id: 'bus-actorr', source: 'bus', target: 'actorr', label: 'media snapshot', targetSource: 'actorr_operator_snapshot', animated: isLive(sources, 'actorr_operator_snapshot') },
    { id: 'programme-console', source: 'programme', target: 'console', label: 'ACSA gate', targetSource: 'epic26_tasks', animated: isLive(sources, 'epic26_tasks') }
  ];
  const edges: Edge[] = useMemo(() => topologyEdges.map(edge => ({
    id: edge.id,
    source: edge.source,
    target: edge.target,
    animated: edge.animated,
    label: edge.label,
    style: edge.animated ? undefined : { stroke: '#6b7280', strokeDasharray: '5 4' }
  })), [topologyEdges]);

  return (
    <article className="panel wide topology-panel">
      <div className="panel-head">
        <div>
          <p className="eyebrow">Living Topology</p>
          <h2>Owner Evidence Graph</h2>
        </div>
        <button type="button" onClick={() => onOpen('amber_bus_apps')}>Sources</button>
      </div>
      <div className="flow-shell topology-flow">
        <ReactFlow nodes={nodes} edges={edges} nodeTypes={nodeTypes} fitView proOptions={{ hideAttribution: true }}>
          <Background color="#315650" gap={22} />
          <MiniMap pannable zoomable />
          <Controls />
        </ReactFlow>
      </div>
      <div className="topology-edge-grid">
        {topologyEdges.map(edge => (
          <button type="button" key={edge.id} onClick={() => onOpen(edge.targetSource)}>
            <strong>{edge.label}</strong>
            <span>{edge.source} to {edge.target}</span>
            <StatusChip state={sourceState(sources, edge.targetSource)} />
            <small>{signals[edge.targetSource]?.metric || 'loading signal'} | {signals[edge.targetSource]?.freshness || '--'}</small>
            <em>{signals[edge.targetSource]?.detail || sourceOwner(sources, edge.targetSource)}</em>
          </button>
        ))}
      </div>
    </article>
  );
}
