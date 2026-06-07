import { Background, Controls, Handle, MiniMap, Position, ReactFlow, type Edge, type Node, type NodeProps } from '@xyflow/react';
import { useEffect, useMemo, useState } from 'react';
import { fetchSource } from '../api/consoleApi';
import { LoggerCorrelationProofStrip } from '../components/LoggerCorrelationProofStrip';
import { MetricRow } from '../components/MetricRow';
import { StatusChip } from '../components/StatusChip';
import type {
  GemmaLanesPayload,
  HardwarePayload,
  MemorrEmailTimelineStatus,
  MemorrFormulatedMemoryRecall,
  SourceDetail,
  VeliaiEndpoint,
  VeliaiProviderCatalog,
  VeliaiQueueArtifactsSummary,
  VeliaiQueueSummary
} from '../types';

interface VeliaiRouterMapProps {
  onOpen: (target: string) => void;
}

type RouterNodeData = {
  label: string;
  subtitle: string;
  tone: string;
  target: string;
  onOpen: (target: string) => void;
};

type RouteCandidate = {
  endpoint_id?: string;
  model_id?: string;
  provider?: string;
  eligible?: boolean;
  reason?: string;
  local?: boolean;
  health?: string;
  context_length?: number;
  requested_tokens?: number;
  fits_context?: boolean;
  single_pass?: boolean;
  chunks_required?: number;
  drift_risk?: string;
  backpressure_state?: string;
  estimated_cost_usd?: number;
  score?: number;
  route_economics?: {
    economics?: {
      score?: number;
      estimated_cost_usd?: number;
    };
  };
};

type VeliaiRoutePlanPayload = {
  schema?: string;
  route_id?: string;
  decision_hash?: string;
  execution_mode?: string;
  mutates_workers?: boolean;
  mutates_registry?: boolean;
  request?: {
    capability?: string;
    privacy?: string;
    input_tokens?: number;
    min_context_tokens?: number;
    allow_external?: boolean;
    privacy_local_required?: boolean;
  };
  selected?: RouteCandidate & { route_id?: string };
  candidates?: RouteCandidate[];
};

type RouteSoakSample = {
  observedAt: number;
  complete: boolean;
  dryRunCount: number;
  mutationCount: number;
  signatures: Record<string, string>;
};

const routePlanTargets = [
  { id: 'veliai_route_plan_memory', label: 'Private Memory', intent: 'local-only memory.formulate' },
  { id: 'veliai_route_plan_summary', label: 'Public Summary', intent: 'fast public summary' },
  { id: 'veliai_route_plan_code', label: 'Code Agent', intent: 'external-code agent' },
  { id: 'veliai_route_plan_long_context', label: 'Long Context', intent: 'public high-context one-shot' }
];

function RouterFlowNode({ data }: NodeProps<Node<RouterNodeData>>) {
  return (
    <button className={`flow-node router-flow-node ${data.tone}`} type="button" onClick={() => data.onOpen(data.target)}>
      <Handle type="target" position={Position.Left} />
      <Handle type="source" position={Position.Right} />
      <strong>{data.label}</strong>
      <span>{data.subtitle}</span>
    </button>
  );
}

const nodeTypes = { router: RouterFlowNode };

function providerClass(endpoint: VeliaiEndpoint) {
  if (!endpoint.enabled) return 'disabled';
  return endpoint.local ? 'local' : 'cloud';
}

function compact(items: string[] | undefined, max = 4) {
  if (!items?.length) return [];
  return items.length <= max ? items : [...items.slice(0, max), `+${items.length - max}`];
}

function planScore(candidate?: RouteCandidate) {
  return candidate?.score ?? candidate?.route_economics?.economics?.score;
}

function planCost(candidate?: RouteCandidate) {
  return candidate?.estimated_cost_usd ?? candidate?.route_economics?.economics?.estimated_cost_usd;
}

function valueOf(item: unknown, key: string) {
  return item && typeof item === 'object' ? (item as Record<string, unknown>)[key] : undefined;
}

function routeSignature(payload?: VeliaiRoutePlanPayload) {
  if (!payload?.decision_hash || !payload.route_id || !payload.selected?.endpoint_id) return '';
  const rejectedCount = (payload.candidates || []).filter(candidate => candidate.eligible === false).length;
  return [
    payload.decision_hash,
    payload.route_id,
    payload.selected.endpoint_id,
    payload.selected.route_id || '',
    payload.candidates?.length || 0,
    rejectedCount,
    valueOf(payload.request, 'request_id') || ''
  ].join('|');
}

function buildRouteSoakSample(sources: Record<string, SourceDetail<VeliaiRoutePlanPayload> | null>): RouteSoakSample {
  const signatures: Record<string, string> = {};
  let dryRunCount = 0;
  let mutationCount = 0;
  routePlanTargets.forEach(target => {
    const payload = sources[target.id]?.payload;
    signatures[target.id] = routeSignature(payload);
    if (payload?.execution_mode === 'dry_run') dryRunCount += 1;
    if (payload?.mutates_workers !== false || payload?.mutates_registry !== false) mutationCount += 1;
  });
  return {
    observedAt: Date.now(),
    complete: routePlanTargets.every(target => Boolean(signatures[target.id])),
    dryRunCount,
    mutationCount,
    signatures
  };
}

function seconds(valueMs: number) {
  if (!Number.isFinite(valueMs) || valueMs <= 0) return '0s';
  if (valueMs < 120000) return `${Math.round(valueMs / 1000)}s`;
  return `${Math.round(valueMs / 60000)}m`;
}

function readableAction(value: string) {
  return value.replace(/_/g, ' ');
}

function reasonText(candidate: RouteCandidate) {
  return candidate.reason || candidate.health || 'unspecified';
}

function heatChips(hardware?: HardwarePayload) {
  const chips: Array<{ label: string; level: string }> = [];
  const nvidia = hardware?.nvidia?.gpus?.[0];
  if (nvidia) {
    chips.push({
      label: `CUDA ${nvidia.temperature_c}C ${nvidia.utilization_gpu_pct}%`,
      level: nvidia.temperature_c >= 82 || nvidia.utilization_gpu_pct >= 95 ? 'hot' : 'ok'
    });
  }
  const amdText = hardware?.amd_rocm?.raw_preview || '';
  const amdTemp = amdText.match(/Temperature .*?\(C\):\s*([0-9.]+)/)?.[1];
  const amdUse = amdText.match(/GPU use \(%\):\s*([0-9.]+)/)?.[1];
  if (amdText) {
    chips.push({
      label: `HIP ${amdTemp || '?'}C ${amdUse || '?'}%`,
      level: Number(amdTemp || 0) >= 82 || Number(amdUse || 0) >= 95 ? 'hot' : 'ok'
    });
  }
  return chips.length ? chips : [{ label: 'hardware unknown', level: 'warn' }];
}

function ProviderCard({ endpoint, onOpen }: { endpoint: VeliaiEndpoint; onOpen: (target: string) => void }) {
  const cls = providerClass(endpoint);
  const model = endpoint.model || {};
  const cost = endpoint.cost || {};
  const usage = endpoint.usage_month || {};
  return (
    <button className={`provider-card ${cls}`} type="button" onClick={() => onOpen('veliai_providers')}>
      <StatusChip state={endpoint.health === 'healthy' ? 'ok' : 'degraded'} label={endpoint.health || 'unknown'} />
      <h3>{endpoint.name || endpoint.id}</h3>
      <p>{endpoint.provider} · {endpoint.kind} · {endpoint.local ? 'local lane' : 'cloud route'}</p>
      <MetricRow label="model" value={model.alias || model.id || '--'} />
      <MetricRow label="context" value={model.context_length || '--'} />
      <MetricRow label="route weight" value={endpoint.route_weight ?? '--'} />
      <MetricRow label="month usage" value={`${usage.requests || 0} req`} />
      <MetricRow label="cost / MTok" value={`${cost.input_usd_per_mtok ?? '?'} in / ${cost.output_usd_per_mtok ?? '?'} out`} />
      <div className="chip-row">
        <span className={`router-chip ${endpoint.supports_streaming ? 'ok' : 'warn'}`}>{endpoint.supports_streaming ? 'stream' : 'no stream'}</span>
        <span className={`router-chip ${endpoint.local ? 'ok' : 'cloud'}`}>{endpoint.privacy_class || 'privacy?'}</span>
        {compact(endpoint.modalities).map(item => <span className="router-chip" key={item}>{item}</span>)}
      </div>
    </button>
  );
}

export function VeliaiRouterMap({ onOpen }: VeliaiRouterMapProps) {
  const [providerSource, setProviderSource] = useState<SourceDetail<VeliaiProviderCatalog> | null>(null);
  const [routePlanSources, setRoutePlanSources] = useState<Record<string, SourceDetail<VeliaiRoutePlanPayload> | null>>({});
  const [lanesSource, setLanesSource] = useState<SourceDetail<GemmaLanesPayload> | null>(null);
  const [hardwareSource, setHardwareSource] = useState<SourceDetail<HardwarePayload> | null>(null);
  const [cloudHealth, setCloudHealth] = useState<SourceDetail<Record<string, unknown>> | null>(null);
  const [cloudCost, setCloudCost] = useState<SourceDetail<Record<string, unknown>> | null>(null);
  const [queueSource, setQueueSource] = useState<SourceDetail<VeliaiQueueSummary> | null>(null);
  const [artifactSource, setArtifactSource] = useState<SourceDetail<VeliaiQueueArtifactsSummary> | null>(null);
  const [memorrRecallSource, setMemorrRecallSource] = useState<SourceDetail<MemorrFormulatedMemoryRecall> | null>(null);
  const [memorrTimelineSource, setMemorrTimelineSource] = useState<SourceDetail<MemorrEmailTimelineStatus> | null>(null);
  const [routeSoakSamples, setRouteSoakSamples] = useState<RouteSoakSample[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const [providers, routePlans, lanes, hardware, health, cost, queue, artifacts, memorrRecall, memorrTimeline] = await Promise.all([
          fetchSource<VeliaiProviderCatalog>('veliai_providers', { loggerEvidence: false }),
          Promise.allSettled(routePlanTargets.map(target => fetchSource<VeliaiRoutePlanPayload>(target.id, { loggerEvidence: false }))),
          fetchSource<GemmaLanesPayload>('gemma_lanes', { loggerEvidence: false }),
          fetchSource<HardwarePayload>('gemma_hardware', { loggerEvidence: false }),
          fetchSource<Record<string, unknown>>('gemma_cloud_health', { loggerEvidence: false }),
          fetchSource<Record<string, unknown>>('gemma_cloud_cost', { loggerEvidence: false }),
          fetchSource<VeliaiQueueSummary>('veliai_queue', { loggerEvidence: false }),
          fetchSource<VeliaiQueueArtifactsSummary>('veliai_artifacts', { loggerEvidence: false }),
          fetchSource<MemorrFormulatedMemoryRecall>('memorr_formulated_memory', { loggerEvidence: false }),
          fetchSource<MemorrEmailTimelineStatus>('memorr_email_timeline', { loggerEvidence: false })
        ]);
        if (cancelled) return;
        const nextRoutePlans: Record<string, SourceDetail<VeliaiRoutePlanPayload> | null> = {};
        routePlanTargets.forEach((target, index) => {
          const result = routePlans[index];
          nextRoutePlans[target.id] = result.status === 'fulfilled' ? result.value : null;
        });
        setProviderSource(providers);
        setRoutePlanSources(nextRoutePlans);
        setLanesSource(lanes);
        setHardwareSource(hardware);
        setCloudHealth(health);
        setCloudCost(cost);
        setQueueSource(queue);
        setArtifactSource(artifacts);
        setMemorrRecallSource(memorrRecall);
        setMemorrTimelineSource(memorrTimeline);
        setRouteSoakSamples(previous => [...previous, buildRouteSoakSample(nextRoutePlans)].slice(-12));
        setError(null);
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : String(err));
      }
    }
    load();
    const timer = window.setInterval(load, 30000);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, []);

  const catalog = providerSource?.payload;
  const queue = queueSource?.payload;
  const artifactSummary = artifactSource?.payload;
  const queueSummary = queue?.summary || {};
  const supervisor = artifactSummary?.supervisor_status;
  const queueGovernance = queue?.governance || supervisor?.governance;
  const queueGovernanceState = queueGovernance?.state || supervisor?.state || 'waiting';
  const queueGovernanceOk = Boolean(queueSource?.ok && artifactSource?.ok && queueGovernanceState !== 'waiting' && queueGovernance?.ok !== false && supervisor?.unhealthy !== true);
  const queuePressure = Number(queueGovernance?.pressure_level ?? 0);
  const ownerQueueActions = queueGovernance?.allowed_actions || [];
  const detailRouteCount = Object.keys(queue?.detail_routes || artifactSummary?.detail_routes || {}).length;
  const queueGovernanceCards = [
    {
      label: 'governance state',
      value: queueGovernanceState,
      detail: queueGovernanceOk ? 'owner reports normal queue posture' : 'queue governance loading or owner review',
      tone: queueGovernanceOk ? 'ok' : 'warn',
      target: 'veliai_queue'
    },
    {
      label: 'pressure window',
      value: queuePressure,
      detail: `${queueGovernance?.pending ?? supervisor?.pending_requests ?? 0} pending · ${queueGovernance?.failed_recent ?? supervisor?.dead_requests ?? 0} recent failed`,
      tone: queuePressure > 0 ? 'warn' : 'ok',
      target: 'veliai_queue'
    },
    {
      label: 'owner-only actions',
      value: ownerQueueActions.length,
      detail: ownerQueueActions.map(readableAction).join(' · ') || 'no owner action list',
      tone: 'warn',
      target: 'veliai_queue'
    },
    {
      label: 'detail boundary',
      value: `${detailRouteCount} routes`,
      detail: artifactSummary?.heavy_route_note || queue?.heavy_route_note || 'bounded summary only',
      tone: 'ok',
      target: 'veliai_artifacts'
    }
  ];
  const endpoints = [...(catalog?.endpoints || [])].sort((a, b) => (b.usage_month?.requests || 0) - (a.usage_month?.requests || 0));
  const localCount = endpoints.filter(endpoint => endpoint.local && endpoint.enabled).length;
  const cloudCount = endpoints.filter(endpoint => !endpoint.local && endpoint.enabled).length;
  const routePlanRows = routePlanTargets.map(target => {
    const source = routePlanSources[target.id];
    const payload = source?.payload;
    const candidates = payload?.candidates || [];
    const rejected = candidates.filter(candidate => candidate.eligible === false);
    return { ...target, source, payload, candidates, rejected };
  });
  const routeHashCount = routePlanRows.filter(row => row.payload?.decision_hash).length;
  const routeDryRunCount = routePlanRows.filter(row => row.source?.ok && row.payload?.execution_mode === 'dry_run').length;
  const routeMutationCount = routePlanRows.filter(row => row.payload?.mutates_workers !== false || row.payload?.mutates_registry !== false).length;
  const routeSelectionCount = routePlanRows.filter(row => row.payload?.selected?.endpoint_id).length;
  const rejectedAlternatives = routePlanRows.flatMap(row => row.rejected);
  const rejectedReasonCounts = rejectedAlternatives.reduce((counts, candidate) => {
    const reason = reasonText(candidate);
    counts.set(reason, (counts.get(reason) || 0) + 1);
    return counts;
  }, new Map<string, number>());
  const topRejectedReasons = Array.from(rejectedReasonCounts.entries())
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, 3);
  const privacyRejections = rejectedAlternatives.filter(candidate => reasonText(candidate).includes('privacy')).length;
  const profileRejections = rejectedAlternatives.filter(candidate => reasonText(candidate).includes('profile')).length;
  const capabilityRejections = rejectedAlternatives.filter(candidate => reasonText(candidate).includes('capability')).length;
  const externalHandoffRejections = rejectedAlternatives.filter(candidate => reasonText(candidate).includes('handoff')).length;
  const failureModeCards = [
    {
      label: 'privacy gate rejections',
      value: privacyRejections,
      detail: 'external routes blocked for private memory',
      target: 'veliai_route_plan_memory',
      tone: privacyRejections > 0 ? 'ok' : 'warn'
    },
    {
      label: 'profile/capability rejections',
      value: profileRejections + capabilityRejections,
      detail: `${profileRejections} profile · ${capabilityRejections} capability`,
      target: 'veliai_route_plan_summary',
      tone: profileRejections + capabilityRejections > 0 ? 'ok' : 'warn'
    },
    {
      label: 'external handoff rejections',
      value: externalHandoffRejections,
      detail: 'code routes stay handoff-only where required',
      target: 'veliai_route_plan_code',
      tone: externalHandoffRejections > 0 ? 'ok' : 'warn'
    },
    {
      label: 'mutation boundary',
      value: routeMutationCount,
      detail: `${routeDryRunCount}/${routePlanTargets.length} dry-run decisions`,
      target: 'veliai_route_plan_long_context',
      tone: routeMutationCount === 0 ? 'ok' : 'warn'
    }
  ];
  const completeSoakSamples = routeSoakSamples.filter(sample => sample.complete);
  const soakBaseline = completeSoakSamples[0];
  const soakDriftEvents = soakBaseline
    ? completeSoakSamples.slice(1).reduce((count, sample) => count + routePlanTargets.filter(target => sample.signatures[target.id] !== soakBaseline.signatures[target.id]).length, 0)
    : 0;
  const soakMutationEvents = completeSoakSamples.filter(sample => sample.mutationCount > 0).length;
  const soakWindowMs = completeSoakSamples.length > 1
    ? completeSoakSamples[completeSoakSamples.length - 1].observedAt - completeSoakSamples[0].observedAt
    : 0;
  const boundedSoakReady = completeSoakSamples.length >= 2 && soakDriftEvents === 0 && soakMutationEvents === 0;
  const routePlan = routePlanRows[0]?.payload;
  const planCandidates = routePlan?.candidates || [];
  const rejectedCandidates = planCandidates.filter(candidate => candidate.eligible === false);
  const candidatePreview = [
    routePlan?.selected,
    ...rejectedCandidates.slice(0, 5)
  ].filter(Boolean) as RouteCandidate[];
  const memorrRecall = memorrRecallSource?.payload;
  const memorrTimeline = memorrTimelineSource?.payload;
  const memorySelected = routePlan?.selected;
  const memoryLocalOnly = Boolean(routePlan?.request?.allow_external === false && routePlan?.request?.privacy_local_required && memorySelected?.local);
  const memoryMutationFree = Boolean(routePlan?.mutates_workers === false && routePlan?.mutates_registry === false);
  const rawMemoryVisible = Boolean(
    memorrTimeline?.privacy?.raw_payload_available ||
    memorrTimeline?.privacy?.raw_mime_visible ||
    memorrRecall?.candidates?.some(candidate => candidate.raw_payload_available_to_gemma)
  );
  const firstMemoryCandidate = memorrRecall?.candidates?.[0];
  const formulation = valueOf(memorySelected?.route_economics, 'formulation') as Record<string, unknown> | undefined;
  const boundaryReady = Boolean(routePlan?.execution_mode === 'dry_run' && memoryLocalOnly && memoryMutationFree && memorrRecallSource?.ok && memorrTimelineSource?.ok && !rawMemoryVisible);

  const flow = useMemo(() => {
    const treeNodes = catalog?.routing_tree?.nodes || [];
    const positions: Record<string, { x: number; y: number }> = {
      privacy_gate: { x: 30, y: 50 },
      capability_gate: { x: 280, y: 20 },
      local_capability_gate: { x: 280, y: 150 },
      weighted_score: { x: 540, y: 85 },
      select_highest: { x: 800, y: 20 },
      reject: { x: 800, y: 150 }
    };
    const nodes: Node<RouterNodeData>[] = treeNodes.map(node => ({
      id: node.id,
      type: 'router',
      position: positions[node.id] || { x: 30, y: 30 },
      data: {
        label: node.label || node.id,
        subtitle: `${node.kind}${node.field ? ` · ${node.field}` : ''}`,
        tone: node.kind === 'terminal' ? 'red' : node.kind === 'select' ? 'green' : node.kind === 'score' ? 'violet' : 'amber',
        target: 'veliai_providers',
        onOpen
      }
    }));
    const edges: Edge[] = [];
    treeNodes.forEach(node => {
      if (node.yes) edges.push({ id: `${node.id}-yes-${node.yes}`, source: node.id, target: node.yes, label: 'yes', animated: true });
      if (node.no) edges.push({ id: `${node.id}-no-${node.no}`, source: node.id, target: node.no, label: 'no', style: { stroke: '#f26d6d' } });
    });
    return { nodes, edges };
  }, [catalog, onOpen]);

  return (
    <article className="panel wide router-panel">
      <div className="panel-head">
        <div>
          <p className="eyebrow">Veliai Router</p>
          <h2>Live Capability, Policy, Provider, and Heat-Relief Map</h2>
        </div>
        <span className="hint">React Flow · Amber Bus contract</span>
      </div>
      {error && <div className="router-error">{error}</div>}
      <div className="router-flow-shell">
        <ReactFlow nodes={flow.nodes} edges={flow.edges} nodeTypes={nodeTypes} fitView proOptions={{ hideAttribution: true }}>
          <Background color="#315650" gap={20} />
          <MiniMap pannable zoomable />
          <Controls />
        </ReactFlow>
      </div>
      <div className="router-stage">
        <div className="router-summary">
          <h3>Route Pressure</h3>
          <p>Veliai chooses between local lanes and approved cloud routes using privacy, capability, health, cost, and context fit.</p>
          <MetricRow label="local providers" value={localCount} />
          <MetricRow label="cloud providers" value={cloudCount} />
          <MetricRow label="cloud health" value={cloudHealth?.payload?.healthy === true ? 'healthy' : cloudHealth?.payload?.healthy === false ? 'degraded' : 'unknown'} />
          <MetricRow label="cloud cost" value={String(cloudCost?.payload?.estimated_hourly_usd ?? cloudCost?.payload?.estimated_cost_usd ?? 'n/a')} />
          {(lanesSource?.payload?.lanes || []).map(lane => (
            <MetricRow key={lane.lane} label={`${lane.lane} lane`} value={`${lane.circuit} · ${lane.inflight}/${lane.max_inflight} in-flight · ${lane.queued} queued`} />
          ))}
          <div className="chip-row">
            {heatChips(hardwareSource?.payload).map(chip => <span className={`router-chip ${chip.level}`} key={chip.label}>{chip.label}</span>)}
          </div>
          <div className="chip-row">
            <span className="router-chip ok">privacy gate</span>
            <span className="router-chip warn">quota/cost gate</span>
            <span className="router-chip hot">heat relief visible</span>
            <span className="router-chip cloud">Ollama/OpenAI/Gemini candidates</span>
          </div>
          <div className="queue-ledger-proof">
            <div className="panel-head">
              <div>
                <p className="eyebrow">Queue Ledger</p>
                <h3>{queueGovernanceState}</h3>
              </div>
              <button type="button" onClick={() => onOpen('veliai_queue')}>Queue</button>
            </div>
            <MetricRow label="accepted" value={queueSummary.accepted ?? 0} />
            <MetricRow label="running" value={queueSummary.running ?? 0} />
            <MetricRow label="retryable" value={queueSummary.retryable_error ?? 0} />
            <MetricRow label="done" value={queueSummary.done ?? 0} />
            <MetricRow label="failed recent" value={queue?.governance?.failed_recent ?? supervisor?.dead_requests ?? 0} />
            <div className="chip-row">
              <span className={`router-chip ${queue?.ok ? 'ok' : 'warn'}`}>{queueSource?.http_status || '--'} queue HTTP</span>
              <span className={`router-chip ${artifactSummary?.ok ? 'ok' : 'warn'}`}>{artifactSummary?.available_targets?.length || 0} artifact targets</span>
              <button type="button" className="router-chip" onClick={() => onOpen('veliai_artifacts')}>artifact summary</button>
            </div>
          </div>
          <section
            className="queue-governance-ledger"
            data-queue-governance-state={queueGovernanceState}
            data-queue-governance-ok={String(queueGovernanceOk)}
            data-queue-governance-pressure={queuePressure}
            data-queue-actions-executable="false"
          >
            <div className="panel-head">
              <div>
                <p className="eyebrow">Queue Governance</p>
                <h3>Read-only readiness ledger</h3>
              </div>
              <StatusChip state={queueGovernanceOk ? 'ok' : 'degraded'} label={queueGovernanceState} />
            </div>
            <div className="queue-governance-grid">
              {queueGovernanceCards.map(card => (
                <button key={card.label} className={`queue-governance-card ${card.tone}`} type="button" onClick={() => onOpen(card.target)}>
                  <strong>{card.label}</strong>
                  <span>{card.value}</span>
                  <small>{card.detail}</small>
                  <em>{card.label === 'owner-only actions' ? 'displayed, not executable' : 'Amber Bus-only evidence'}</em>
                </button>
              ))}
            </div>
            <div className="chip-row">
              <span className={`router-chip ${queueGovernanceState === 'normal' ? 'ok' : 'warn'}`}>state {queueGovernanceState}</span>
              <span className={`router-chip ${queuePressure === 0 ? 'ok' : 'warn'}`}>pressure {queuePressure}</span>
              <span className="router-chip warn">queue actions owner-only</span>
              <span className="router-chip ok">bounded summaries</span>
            </div>
          </section>
        </div>
        <div className="route-plan-panel">
          <div className="panel-head">
            <div>
              <p className="eyebrow">Memory Route Dry Run</p>
              <h2>{routePlan?.selected?.endpoint_id || 'Route decision pending'}</h2>
            </div>
            <button type="button" onClick={() => onOpen('veliai_route_plan_memory')}>Memory Source</button>
          </div>
          <div className="route-plan-summary">
            <MetricRow label="execution" value={routePlan?.execution_mode || 'unknown'} />
            <MetricRow label="capability" value={routePlan?.request?.capability || 'memory.formulate'} />
            <MetricRow label="privacy" value={routePlan?.request?.privacy || 'private_sensitive'} />
            <MetricRow label="context ask" value={routePlan?.request?.min_context_tokens || routePlan?.selected?.requested_tokens || '--'} />
            <MetricRow label="candidates" value={`${planCandidates.length} total / ${rejectedCandidates.length} rejected alternatives`} />
            <MetricRow label="selected score" value={planScore(routePlan?.selected)?.toFixed?.(2) || '--'} />
          </div>
          <div className="route-drift-guard">
            <div className="panel-head">
              <div>
                <p className="eyebrow">Route Drift Guard</p>
                <h3>{routeMutationCount === 0 ? 'Dry-run hashes anchored' : 'Mutation gate warning'}</h3>
              </div>
              <button type="button" onClick={() => onOpen('veliai_route_plan_memory')}>Drift Source</button>
            </div>
            <div className="route-drift-summary">
              <MetricRow label="dry-run sources" value={`${routeDryRunCount}/${routePlanTargets.length}`} />
              <MetricRow label="decision hashes" value={`${routeHashCount}/${routePlanTargets.length}`} />
              <MetricRow label="selected routes" value={`${routeSelectionCount}/${routePlanTargets.length}`} />
              <MetricRow label="mutation paths" value={routeMutationCount} />
            </div>
            <div className="chip-row">
              <span className={`router-chip ${routeHashCount === routePlanTargets.length ? 'ok' : 'warn'}`}>stable hash anchors</span>
              <span className={`router-chip ${routeMutationCount === 0 ? 'ok' : 'hot'}`}>no runtime mutation</span>
              <span className="router-chip warn">owner-native compare open</span>
              <span className="router-chip warn">long-run drift soak open</span>
            </div>
            <div className="route-drift-grid">
              {routePlanRows.map(row => {
                const selected = row.payload?.selected;
                const mutationFree = row.payload?.mutates_workers === false && row.payload?.mutates_registry === false;
                return (
                  <button className={`route-drift-card ${row.payload?.decision_hash && mutationFree ? 'ok' : 'warn'}`} type="button" key={row.id} onClick={() => onOpen(row.id)}>
                    <span>{row.label} hash {row.payload?.decision_hash || 'pending'}</span>
                    <strong>{selected?.endpoint_id || 'selection pending'}</strong>
                    <em>{row.payload?.route_id || selected?.route_id || 'route id pending'}</em>
                    <small>
                      {row.payload?.execution_mode || 'mode?'} · {row.candidates.length} candidates · {row.rejected.length} rejected · {mutationFree ? 'mutation-free' : 'mutation warning'}
                    </small>
                  </button>
                );
              })}
            </div>
          </div>
          <section
            className="route-failure-ledger"
            data-route-failure-modes={topRejectedReasons.length}
            data-route-rejected-total={rejectedAlternatives.length}
            data-route-privacy-rejections={privacyRejections}
            data-route-mutation-paths={routeMutationCount}
          >
            <div className="panel-head">
              <div>
                <p className="eyebrow">Decision Review</p>
                <h3>Decision Failure Modes</h3>
              </div>
              <button type="button" onClick={() => onOpen('veliai_route_plan_memory')}>Failure Source</button>
            </div>
            <div className="route-failure-grid">
              {failureModeCards.map(card => (
                <button key={card.label} className={`route-failure-card ${card.tone}`} type="button" onClick={() => onOpen(card.target)}>
                  <strong>{card.label}</strong>
                  <span>{card.value}</span>
                  <small>{card.detail}</small>
                  <em>dry-run evidence only</em>
                </button>
              ))}
            </div>
            <div className="chip-row">
              {topRejectedReasons.map(([reason, count]) => (
                <span className="router-chip warn" key={reason}>{readableAction(reason)} {count}</span>
              ))}
              <span className="router-chip ok">no route execution</span>
              <span className="router-chip warn">owner-native compare open</span>
            </div>
          </section>
          <section
            className="route-soak-ledger"
            data-route-soak-ready={String(boundedSoakReady)}
            data-route-soak-samples={completeSoakSamples.length}
            data-route-soak-drift-events={soakDriftEvents}
            data-route-soak-mutation-events={soakMutationEvents}
            data-route-soak-window-ms={soakWindowMs}
          >
            <div className="panel-head">
              <div>
                <p className="eyebrow">Route Soak</p>
                <h3>Bounded Drift Soak Ledger</h3>
              </div>
              <button type="button" onClick={() => onOpen('veliai_route_plan_memory')}>Soak Source</button>
            </div>
            <div className="route-soak-grid">
              <button className={`route-soak-card ${completeSoakSamples.length >= 2 ? 'ok' : 'warn'}`} type="button" onClick={() => onOpen('veliai_route_plan_memory')}>
                <strong>sample window</strong>
                <span>{completeSoakSamples.length} complete samples</span>
                <small>{seconds(soakWindowMs)} browser-observed window</small>
                <em>bounded Console proof only</em>
              </button>
              <button className={`route-soak-card ${soakDriftEvents === 0 && completeSoakSamples.length ? 'ok' : 'warn'}`} type="button" onClick={() => onOpen('veliai_route_plan_summary')}>
                <strong>decision drift</strong>
                <span>{soakDriftEvents} drift events</span>
                <small>{routeHashCount}/{routePlanTargets.length} current hash anchors</small>
                <em>{soakDriftEvents === 0 ? 'stable bounded window' : 'hash review required'}</em>
              </button>
              <button className={`route-soak-card ${soakMutationEvents === 0 && completeSoakSamples.length ? 'ok' : 'warn'}`} type="button" onClick={() => onOpen('veliai_route_plan_code')}>
                <strong>mutation during soak</strong>
                <span>{soakMutationEvents} mutation samples</span>
                <small>{routeDryRunCount}/{routePlanTargets.length} dry-run sources now</small>
                <em>{soakMutationEvents === 0 ? 'no worker or registry mutation' : 'mutation warning'}</em>
              </button>
              <button className="route-soak-card warn" type="button" onClick={() => onOpen('veliai_route_plan_long_context')}>
                <strong>closure gate</strong>
                <span>long-run soak still open</span>
                <small>owner-native compare and owner IDs still required</small>
                <em>L9 remains NO_GO</em>
              </button>
            </div>
            <div className="chip-row">
              <span className={`router-chip ${boundedSoakReady ? 'ok' : 'warn'}`}>{boundedSoakReady ? 'bounded soak stable' : 'bounded soak collecting'}</span>
              <span className="router-chip ok">logger_evidence=0 hydration</span>
              <span className="router-chip ok">route decisions dry-run</span>
              <span className="router-chip warn">long-run drift soak open</span>
            </div>
          </section>
          <section
            className="memory-boundary-ledger"
            data-memory-boundary-ready={String(boundaryReady)}
            data-memory-boundary-local={String(memoryLocalOnly)}
            data-memory-boundary-raw-visible={String(rawMemoryVisible)}
            data-memory-boundary-candidates={memorrRecall?.candidate_count ?? 0}
          >
            <div className="panel-head">
              <div>
                <p className="eyebrow">Gateway / Memorr</p>
                <h3>Gateway Memory Boundary Ledger</h3>
              </div>
              <button type="button" onClick={() => onOpen('memorr_formulated_memory')}>Memorr Proof</button>
            </div>
            <div className="memory-boundary-grid">
              <button className={`memory-boundary-card ${memoryLocalOnly ? 'ok' : 'warn'}`} type="button" onClick={() => onOpen('veliai_route_plan_memory')}>
                <strong>Veliai dry-run route</strong>
                <span>{memorySelected?.endpoint_id || 'selection pending'}</span>
                <small>{routePlan?.request?.capability || 'memory.formulate'} · {routePlan?.request?.privacy || 'private_sensitive'}</small>
                <em>{memoryLocalOnly ? 'local-only privacy gate' : 'privacy route review'}</em>
              </button>
              <button className={`memory-boundary-card ${memoryMutationFree ? 'ok' : 'warn'}`} type="button" onClick={() => onOpen('veliai_route_plan_memory')}>
                <strong>Gateway mutation boundary</strong>
                <span>{routePlan?.execution_mode || 'mode pending'}</span>
                <small>{memoryMutationFree ? 'workers and registry untouched' : 'mutation warning'}</small>
                <em>{formulation?.strategy ? String(formulation.strategy) : 'route plan only'}</em>
              </button>
              <button className={`memory-boundary-card ${memorrRecallSource?.ok ? 'ok' : 'warn'}`} type="button" onClick={() => onOpen('memorr_formulated_memory')}>
                <strong>Memorr owner truth</strong>
                <span>{memorrRecall?.candidate_count ?? '--'} formulated candidates</span>
                <small>{memorrRecall?.estimated_tokens ?? '--'} estimated tokens · path_api {String(memorrRecall?.path_api ?? false)}</small>
                <em>{firstMemoryCandidate?.provenance_ref || firstMemoryCandidate?.artifact_ref || 'owner provenance pending'}</em>
              </button>
              <button className={`memory-boundary-card ${rawMemoryVisible ? 'warn' : 'ok'}`} type="button" onClick={() => onOpen('memorr_email_timeline')}>
                <strong>Privacy and read lease</strong>
                <span>{rawMemoryVisible ? 'raw payload review' : 'raw payload hidden'}</span>
                <small>{memorrTimeline?.summary?.read_lease_count ?? '--'} read leases · {memorrTimeline?.summary?.sealed_count ?? '--'} sealed</small>
                <em>{memorrTimeline?.privacy?.read_lease_required_for_raw ? 'read lease required for raw' : 'descriptor access only'}</em>
              </button>
            </div>
            <div className="chip-row">
              <span className={`router-chip ${boundaryReady ? 'ok' : 'warn'}`}>{boundaryReady ? 'boundary proof live' : 'boundary proof review'}</span>
              <span className="router-chip ok">Memorr owns storage truth</span>
              <span className="router-chip cloud">Gateway uses refs only</span>
              <span className="router-chip warn">owner-native compare open</span>
            </div>
          </section>
          <div className="chip-row">
            <span className={`router-chip ${routePlan?.mutates_workers === false ? 'ok' : 'warn'}`}>no worker mutation</span>
            <span className={`router-chip ${routePlan?.mutates_registry === false ? 'ok' : 'warn'}`}>no registry mutation</span>
            <span className={`router-chip ${routePlan?.request?.allow_external === false ? 'ok' : 'cloud'}`}>local-only proof</span>
            <span className="router-chip ok">Logger query attached</span>
          </div>
          <LoggerCorrelationProofStrip
            title="Route decision proof"
            context="Dry-run route cards open the same Bus-backed Logger correlation query."
            onOpen={onOpen}
          />
          <div className="route-candidate-strip">
            {candidatePreview.map((candidate, index) => (
              <button
                className={`route-candidate-card ${candidate.eligible === false ? 'rejected' : 'selected'}`}
                type="button"
                key={`${candidate.endpoint_id || 'candidate'}-${index}`}
                onClick={() => onOpen('veliai_route_plan_memory')}
              >
                <span>{candidate.eligible === false ? 'rejected alternative' : 'selected route'}</span>
                <strong>{candidate.endpoint_id || 'unknown endpoint'}</strong>
                <em>{candidate.reason || candidate.health || 'no reason surfaced'}</em>
                <small>
                  {candidate.provider || 'provider?'} · {candidate.local ? 'local' : 'cloud'} · score {planScore(candidate)?.toFixed?.(1) || '--'} · ${planCost(candidate) ?? 0}
                </small>
              </button>
            ))}
          </div>
          <div className="route-plan-matrix">
            {routePlanRows.map(row => {
              const selected = row.payload?.selected;
              const selectedScore = planScore(selected);
              const ok = row.source?.ok && row.payload?.execution_mode === 'dry_run';
              return (
                <button className={`route-plan-card ${ok ? 'ok' : 'warn'}`} type="button" key={row.id} onClick={() => onOpen(row.id)}>
                  <span>{row.label}</span>
                  <strong>{selected?.endpoint_id || 'no selected route'}</strong>
                  <em>{row.intent}</em>
                  <small>
                    {row.payload?.request?.capability || 'capability?'} · {row.payload?.request?.privacy || 'privacy?'} · {row.candidates.length} candidates · {row.rejected.length} rejected · score {selectedScore?.toFixed?.(1) || '--'}
                  </small>
                </button>
              );
            })}
          </div>
        </div>
        <div className="provider-column">
          <div className="panel-head">
            <div>
              <p className="eyebrow">Active Backends</p>
              <h2>Top routes now</h2>
            </div>
            <button type="button" onClick={() => onOpen('veliai_providers')}>Catalog</button>
          </div>
          <div className="provider-grid">
            {endpoints.slice(0, 6).map(endpoint => <ProviderCard key={endpoint.id} endpoint={endpoint} onOpen={onOpen} />)}
          </div>
        </div>
      </div>
    </article>
  );
}
