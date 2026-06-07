import { Background, Controls, Handle, Position, ReactFlow, type Edge, type Node, type NodeProps } from '@xyflow/react';
import { useEffect, useMemo, useState } from 'react';
import { fetchSource } from '../api/consoleApi';
import type {
  GemmaLanesPayload,
  HardwarePayload,
  LsbPlanStatus,
  LsbStateStatus,
  MemorrEmailTimelineStatus,
  MemorrFormulatedMemoryRecall,
  SourceDetail,
  VeliaiProviderCatalog,
  VeliaiUsagePayload
} from '../types';

interface AmberLiveMapProps {
  onOpen: (target: string) => void;
}

type LiveNodeData = {
  title: string;
  metric: string | number;
  note: string;
  tone: string;
  target: string;
  active: boolean;
  onOpen: (target: string) => void;
};

function LiveNode({ data }: NodeProps<Node<LiveNodeData>>) {
  return (
    <button className={`live-node ${data.tone} ${data.active ? 'active' : ''}`} type="button" onClick={() => data.onOpen(data.target)}>
      <Handle type="target" position={Position.Left} />
      <Handle type="source" position={Position.Right} />
      <span className="pulse-dot" />
      <strong>{data.metric}</strong>
      <span>{data.title}</span>
      <small>{data.note}</small>
    </button>
  );
}

const nodeTypes = { live: LiveNode };

function topUsage(usage?: VeliaiUsagePayload) {
  const rows = [...(usage?.usage || [])].sort((a, b) => (b.requests || 0) - (a.requests || 0));
  return rows[0];
}

function lanePressure(lanes?: GemmaLanesPayload) {
  return (lanes?.lanes || []).reduce((sum, lane) => sum + lane.inflight + lane.queued, 0);
}

function nvidiaLabel(hw?: HardwarePayload) {
  const gpu = hw?.nvidia?.gpus?.[0];
  return gpu ? `${gpu.temperature_c}C` : '--';
}

function amdLabel(hw?: HardwarePayload) {
  const text = hw?.amd_rocm?.raw_preview || '';
  return text.match(/Temperature .*?\(C\):\s*([0-9.]+)/)?.[1] ? `${text.match(/Temperature .*?\(C\):\s*([0-9.]+)/)?.[1]}C` : '--';
}

export function AmberLiveMap({ onOpen }: AmberLiveMapProps) {
  const [veliaiUsage, setVeliaiUsage] = useState<SourceDetail<VeliaiUsagePayload> | null>(null);
  const [veliaiProviders, setVeliaiProviders] = useState<SourceDetail<VeliaiProviderCatalog> | null>(null);
  const [lanes, setLanes] = useState<SourceDetail<GemmaLanesPayload> | null>(null);
  const [hardware, setHardware] = useState<SourceDetail<HardwarePayload> | null>(null);
  const [timeline, setTimeline] = useState<SourceDetail<MemorrEmailTimelineStatus> | null>(null);
  const [formulated, setFormulated] = useState<SourceDetail<MemorrFormulatedMemoryRecall> | null>(null);
  const [concierge, setConcierge] = useState<SourceDetail<Record<string, unknown>> | null>(null);
  const [lsbState, setLsbState] = useState<SourceDetail<LsbStateStatus> | null>(null);
  const [lsbPlan, setLsbPlan] = useState<SourceDetail<LsbPlanStatus> | null>(null);
  const [lastTick, setLastTick] = useState('--');

  useEffect(() => {
    let cancelled = false;
    async function load() {
      const results = await Promise.allSettled([
        fetchSource<VeliaiUsagePayload>('veliai_usage', { loggerEvidence: false }),
        fetchSource<VeliaiProviderCatalog>('veliai_providers', { loggerEvidence: false }),
        fetchSource<GemmaLanesPayload>('gemma_lanes', { loggerEvidence: false }),
        fetchSource<HardwarePayload>('gemma_hardware', { loggerEvidence: false }),
        fetchSource<MemorrEmailTimelineStatus>('memorr_email_timeline', { loggerEvidence: false }),
        fetchSource<MemorrFormulatedMemoryRecall>('memorr_formulated_memory', { loggerEvidence: false }),
        fetchSource<Record<string, unknown>>('concierge_email', { loggerEvidence: false }),
        fetchSource<LsbStateStatus>('lsb_state_status', { loggerEvidence: false }),
        fetchSource<LsbPlanStatus>('lsb_plan_status', { loggerEvidence: false })
      ]);
      if (cancelled) return;
      const value = <T,>(index: number) => results[index].status === 'fulfilled' ? (results[index] as PromiseFulfilledResult<SourceDetail<T>>).value : null;
      setVeliaiUsage(value<VeliaiUsagePayload>(0));
      setVeliaiProviders(value<VeliaiProviderCatalog>(1));
      setLanes(value<GemmaLanesPayload>(2));
      setHardware(value<HardwarePayload>(3));
      setTimeline(value<MemorrEmailTimelineStatus>(4));
      setFormulated(value<MemorrFormulatedMemoryRecall>(5));
      setConcierge(value<Record<string, unknown>>(6));
      setLsbState(value<LsbStateStatus>(7));
      setLsbPlan(value<LsbPlanStatus>(8));
      setLastTick(new Date().toLocaleTimeString());
    }
    load().catch(() => undefined);
    const timer = window.setInterval(() => load().catch(() => undefined), 5000);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, []);

  const usage = veliaiUsage?.payload;
  const provider = topUsage(usage);
  const pressure = lanePressure(lanes?.payload);
  const mailCount = timeline?.payload?.summary?.email_count ?? 0;
  const sealedCount = timeline?.payload?.summary?.sealed_count ?? 0;
  const formulatedCount = formulated?.payload?.candidate_count ?? timeline?.payload?.summary?.formulated_memory_count ?? 0;
  const providerName = provider?.endpoint_id?.replace(/^local\.|^ollama\.cloud\./, '') || 'waiting';
  const hasVeliaiTraffic = (usage?.summary?.requests || 0) > 0;
  const hasMemorrWork = mailCount > 0 || formulatedCount > 0;
  const lsbReady = lsbState?.payload?.state === 'ready' && lsbPlan?.payload?.state === 'ready';
  const lsbRecords = lsbState?.payload?.records ?? '--';
  const neufabFallbacks = lsbPlan?.payload?.neufab_fallbacks ?? '--';

  const { nodes, edges } = useMemo(() => {
    const liveNodes: Node<LiveNodeData>[] = [
      { id: 'concierge', type: 'live', position: { x: 25, y: 155 }, data: { title: 'Concierge Email', metric: mailCount || '--', note: 'mail into memory', tone: 'cyan', target: 'concierge_email', active: Boolean(concierge?.ok), onOpen } },
      { id: 'bus', type: 'live', position: { x: 265, y: 155 }, data: { title: 'Amber Bus', metric: 'BUS', note: 'admission + evidence', tone: 'green', target: 'amber_bus_overview', active: true, onOpen } },
      { id: 'veliai', type: 'live', position: { x: 520, y: 70 }, data: { title: 'Veliai Router', metric: usage?.summary?.requests ?? '--', note: 'requests this month', tone: 'violet', target: 'veliai_usage', active: hasVeliaiTraffic, onOpen } },
      { id: 'decision', type: 'live', position: { x: 760, y: 70 }, data: { title: 'Chosen Route', metric: providerName, note: provider?.provider || 'no current feed', tone: provider?.provider === 'local_gemma' ? 'green' : 'violet', target: 'veliai_usage', active: hasVeliaiTraffic, onOpen } },
      { id: 'chat', type: 'live', position: { x: 1035, y: 20 }, data: { title: 'Gemma 31B', metric: nvidiaLabel(hardware?.payload), note: 'chat lane CUDA', tone: 'green', target: 'gemma_hardware', active: pressure > 0, onOpen } },
      { id: 'fast', type: 'live', position: { x: 1035, y: 155 }, data: { title: 'Gemma 4B Fast', metric: amdLabel(hardware?.payload), note: 'fast lane HIP', tone: 'cyan', target: 'gemma_lanes', active: pressure > 0, onOpen } },
      { id: 'cloud', type: 'live', position: { x: 1035, y: 290 }, data: { title: 'Cloud Overflow', metric: 'Ollama', note: 'heat/backpressure route', tone: 'violet', target: 'veliai_providers', active: provider?.provider === 'ollama.cloud', onOpen } },
      { id: 'memorr', type: 'live', position: { x: 520, y: 285 }, data: { title: 'Memorr', metric: mailCount || '--', note: 'descriptor timeline', tone: 'amber', target: 'memorr_email_timeline', active: hasMemorrWork, onOpen } },
      { id: 'ocr', type: 'live', position: { x: 760, y: 285 }, data: { title: 'Sealed / Lease', metric: sealedCount || '--', note: 'raw payload gated', tone: sealedCount > 0 ? 'amber' : 'green', target: 'memorr_email_timeline', active: sealedCount > 0, onOpen } },
      { id: 'memory', type: 'live', position: { x: 1035, y: 425 }, data: { title: 'Memory Refs', metric: formulatedCount || '--', note: 'formulated recall', tone: 'green', target: 'memorr_formulated_memory', active: hasMemorrWork, onOpen } },
      { id: 'lsb', type: 'live', position: { x: 265, y: 390 }, data: { title: 'LSB State', metric: lsbRecords, note: 'metadata feedback records', tone: lsbReady ? 'cyan' : 'amber', target: 'lsb_state_status', active: lsbReady, onOpen } },
      { id: 'neufab', type: 'live', position: { x: 25, y: 390 }, data: { title: 'NeuFab Bridge', metric: neufabFallbacks, note: 'fallbacks on Bus path', tone: lsbReady ? 'violet' : 'amber', target: 'lsb_plan_status', active: lsbReady && Number(neufabFallbacks) >= 0, onOpen } }
    ];
    const liveEdges: Edge[] = [
      { id: 'mail-bus', source: 'concierge', target: 'bus', animated: Boolean(concierge?.ok), label: 'mail' },
      { id: 'bus-veliai', source: 'bus', target: 'veliai', animated: hasVeliaiTraffic, label: 'AI jobs' },
      { id: 'veliai-decision', source: 'veliai', target: 'decision', animated: hasVeliaiTraffic, label: 'route' },
      { id: 'decision-chat', source: 'decision', target: 'chat', animated: provider?.endpoint_id?.includes('31b'), label: 'chat' },
      { id: 'decision-fast', source: 'decision', target: 'fast', animated: provider?.endpoint_id?.includes('4b') || provider?.endpoint_id?.includes('fast'), label: 'fast' },
      { id: 'decision-cloud', source: 'decision', target: 'cloud', animated: provider?.provider === 'ollama.cloud', label: 'overflow' },
      { id: 'bus-memorr', source: 'bus', target: 'memorr', animated: hasMemorrWork, label: 'archive' },
      { id: 'memorr-ocr', source: 'memorr', target: 'ocr', animated: sealedCount > 0, label: 'privacy gate' },
      { id: 'ocr-memory', source: 'ocr', target: 'memory', animated: hasMemorrWork, label: 'remember' },
      { id: 'neufab-lsb', source: 'neufab', target: 'lsb', animated: lsbReady, label: 'descriptor feedback' },
      { id: 'lsb-bus', source: 'lsb', target: 'bus', animated: lsbReady, label: 'cognitive metadata' }
    ];
    return { nodes: liveNodes, edges: liveEdges };
  }, [concierge, formulatedCount, hardware, hasMemorrWork, hasVeliaiTraffic, lsbPlan, lsbReady, lsbRecords, lsbState, mailCount, neufabFallbacks, onOpen, pressure, provider, providerName, sealedCount, usage]);

  return (
    <section className="live-map-panel">
      <div className="live-map-head">
        <div>
          <p className="eyebrow">Amber Live</p>
          <h1>System Activity Map</h1>
        </div>
        <div className="live-summary">
          <span>{lastTick}</span>
          <b>{usage?.summary?.requests ?? '--'} AI</b>
          <b>{mailCount || '--'} mail</b>
          <b>{formulatedCount || '--'} memories</b>
        </div>
      </div>
      <div className="amber-live-flow">
        <ReactFlow nodes={nodes} edges={edges} nodeTypes={nodeTypes} fitView minZoom={0.45} maxZoom={1.5} proOptions={{ hideAttribution: true }}>
          <Background color="#24423d" gap={28} />
          <Controls />
        </ReactFlow>
      </div>
      <div className="legend-strip">
        <span><i className="legend-dot active" /> moving now</span>
        <span><i className="legend-dot" /> live counter</span>
        <span><i className="legend-dot missing" /> owner endpoint degraded</span>
      </div>
    </section>
  );
}
