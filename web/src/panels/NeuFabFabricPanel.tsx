import { Background, Controls, Handle, MiniMap, Position, ReactFlow, type Edge, type Node, type NodeProps } from '@xyflow/react';
import { useEffect, useMemo, useState } from 'react';
import { fetchSource } from '../api/consoleApi';
import { MetricRow } from '../components/MetricRow';
import { StatusChip } from '../components/StatusChip';
import type {
  NeuFabFeedbackStatus,
  NeuFabPerceptionStatus,
  NeuFabStatus,
  SourceDetail
} from '../types';

interface NeuFabFabricPanelProps {
  onOpen: (target: string) => void;
}

type FabricNodeData = {
  label: string;
  subtitle: string;
  tone: string;
  active: boolean;
  target: string;
  onOpen: (target: string) => void;
};

function FabricNode({ data }: NodeProps<Node<FabricNodeData>>) {
  return (
    <button
      className={`flow-node neufab-node ${data.tone} ${data.active ? 'active' : ''}`}
      type="button"
      onClick={() => data.onOpen(data.target)}
    >
      <Handle type="target" position={Position.Left} />
      <Handle type="source" position={Position.Right} />
      <strong>{data.label}</strong>
      <span>{data.subtitle}</span>
    </button>
  );
}

const nodeTypes = { fabric: FabricNode };

function partLabel(part?: string) {
  if (!part) return 'unknown';
  return part.replace(/_/g, ' ');
}

function signalTone(value?: boolean) {
  return value ? 'ok' : 'warn';
}

function shortValue(value: unknown, fallback = '--') {
  if (value === undefined || value === null || value === '') return fallback;
  return String(value);
}

export function NeuFabFabricPanel({ onOpen }: NeuFabFabricPanelProps) {
  const [fabricSource, setFabricSource] = useState<SourceDetail<NeuFabStatus> | null>(null);
  const [feedbackSource, setFeedbackSource] = useState<SourceDetail<NeuFabFeedbackStatus> | null>(null);
  const [perceptionSource, setPerceptionSource] = useState<SourceDetail<NeuFabPerceptionStatus> | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const [fabric, feedback, perception] = await Promise.all([
          fetchSource<NeuFabStatus>('neufab_status', { loggerEvidence: false }),
          fetchSource<NeuFabFeedbackStatus>('neufab_feedback', { loggerEvidence: false }),
          fetchSource<NeuFabPerceptionStatus>('neufab_perception', { loggerEvidence: false })
        ]);
        if (cancelled) return;
        setFabricSource(fabric);
        setFeedbackSource(feedback);
        setPerceptionSource(perception);
        setError(null);
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : String(err));
      }
    }
    load();
    const timer = window.setInterval(load, 5000);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, []);

  const fabric = fabricSource?.payload;
  const feedback = feedbackSource?.payload;
  const perception = perceptionSource?.payload;
  const lastFrame = fabric?.last_frame || null;
  const recentFrames = fabric?.recent_frames || (lastFrame ? [lastFrame] : []);
  const recentFeedback = feedback?.recent_feedback || (feedback?.last_feedback ? [feedback.last_feedback] : []);
  const recentEvents = perception?.recent_events || (perception?.last_event ? [perception.last_event] : []);

  const flow = useMemo(() => {
    const activeSource = lastFrame?.source_part;
    const activeTarget = lastFrame?.target_part;
    const baseNodes: Array<{ id: string; label: string; subtitle: string; tone: string; x: number; y: number; target: string }> = [
      { id: 'jarvis', label: 'Jarvis', subtitle: 'voice / face / operator', tone: 'cyan', x: 20, y: 80, target: 'neufab_perception' },
      { id: 'lsb_intelligence', label: 'LSB', subtitle: 'cognitive state', tone: 'amber', x: 230, y: 10, target: 'lsb_state_status' },
      { id: 'neufab', label: 'NeuFab', subtitle: 'corpus callosum', tone: 'violet', x: 250, y: 160, target: 'neufab_status' },
      { id: 'gemma', label: 'Gemma', subtitle: 'reasoning lane', tone: 'green', x: 500, y: 80, target: 'gemma_lanes' },
      { id: 'provider_router', label: 'Veliai', subtitle: 'route decision', tone: 'violet', x: 730, y: 10, target: 'veliai_providers' },
      { id: 'memory_recall', label: 'Memorr', subtitle: 'owner refs only', tone: 'cyan', x: 730, y: 160, target: 'memorr_archive' },
      { id: 'concierge', label: 'Concierge', subtitle: 'mail and handoff', tone: 'amber', x: 20, y: 250, target: 'concierge_email' },
      { id: 'omega', label: 'Omega', subtitle: 'apply guard', tone: 'red', x: 500, y: 250, target: 'guardian_c2_snapshot' }
    ];
    const nodes: Node<FabricNodeData>[] = baseNodes.map(node => ({
      id: node.id,
      type: 'fabric',
      position: { x: node.x, y: node.y },
      data: {
        label: node.label,
        subtitle: node.subtitle,
        tone: node.tone,
        active: node.id === activeSource || node.id === activeTarget,
        target: node.target,
        onOpen
      }
    }));
    const edges: Edge[] = [
      { id: 'jarvis-neufab', source: 'jarvis', target: 'neufab', animated: activeSource === 'jarvis' || activeTarget === 'jarvis' },
      { id: 'concierge-neufab', source: 'concierge', target: 'neufab', animated: activeSource === 'concierge' || activeTarget === 'concierge' },
      { id: 'lsb-neufab', source: 'lsb_intelligence', target: 'neufab', animated: activeSource === 'lsb_intelligence' || activeTarget === 'lsb_intelligence' },
      { id: 'neufab-gemma', source: 'neufab', target: 'gemma', animated: activeSource === 'gemma' || activeTarget === 'gemma' || activeSource === 'neufab' },
      { id: 'gemma-router', source: 'gemma', target: 'provider_router', animated: activeTarget === 'provider_router' },
      { id: 'gemma-memory', source: 'gemma', target: 'memory_recall', animated: activeTarget === 'memory_recall' },
      { id: 'gemma-omega', source: 'gemma', target: 'omega', animated: activeTarget === 'omega' },
      { id: 'memory-neufab', source: 'memory_recall', target: 'neufab', animated: activeSource === 'memory_recall' },
      { id: 'omega-lsb', source: 'omega', target: 'lsb_intelligence', animated: activeSource === 'omega' }
    ];
    if (activeSource && activeTarget && !edges.some(edge => edge.source === activeSource && edge.target === activeTarget)) {
      edges.push({ id: `live-${activeSource}-${activeTarget}`, source: activeSource, target: activeTarget, animated: true, label: 'now' });
    }
    return { nodes, edges };
  }, [lastFrame, onOpen]);

  return (
    <article className="panel wide neufab-panel">
      <div className="panel-head">
        <div>
          <p className="eyebrow">NeuFab</p>
          <h2>Live Brain Fabric Traversal</h2>
        </div>
        <span className="hint">5s refresh · Amber Bus invoke · owner refs only</span>
      </div>

      {error && <div className="router-error">{error}</div>}

      <div className="neufab-metric-grid">
        <button type="button" onClick={() => onOpen('neufab_status')}>
          <strong>{fabric?.frame_count ?? '--'}</strong>
          <span>frames</span>
        </button>
        <button type="button" onClick={() => onOpen('neufab_feedback')}>
          <strong>{feedback?.feedback_count ?? '--'}</strong>
          <span>feedback</span>
        </button>
        <button type="button" onClick={() => onOpen('neufab_perception')}>
          <strong>{perception?.event_count ?? '--'}</strong>
          <span>perception</span>
        </button>
        <button type="button" onClick={() => onOpen('neufab_status')}>
          <strong>{fabric?.raw_payload_block ? 'blocked' : '--'}</strong>
          <span>raw payload</span>
        </button>
      </div>

      <div className="neufab-stage">
        <div className="neufab-flow-shell">
          <ReactFlow nodes={flow.nodes} edges={flow.edges} nodeTypes={nodeTypes} fitView proOptions={{ hideAttribution: true }}>
            <Background color="#355a70" gap={20} />
            <MiniMap pannable zoomable />
            <Controls />
          </ReactFlow>
        </div>

        <section className="neufab-now">
          <div className="panel-head">
            <div>
              <p className="eyebrow">Traversing Now</p>
              <h3>{partLabel(lastFrame?.source_part)} to {partLabel(lastFrame?.target_part)}</h3>
            </div>
            <StatusChip state={fabric?.ok ? 'ok' : 'degraded'} label={fabric?.ok ? 'live' : 'waiting'} />
          </div>
          <MetricRow label="intent" value={shortValue(lastFrame?.intent)} />
          <MetricRow label="transport" value={shortValue(lastFrame?.transport)} />
          <MetricRow label="request" value={shortValue(lastFrame?.request_id)} />
          <MetricRow label="latency budget" value={`${shortValue(lastFrame?.latency_budget_ms)} ms`} />
          <MetricRow label="processing" value={`${shortValue(lastFrame?.processing_us)} us`} />
          <div className="chip-row">
            <span className={`router-chip ${signalTone(fabric?.raw_payload_block)}`}>raw payload blocked</span>
            <span className={`router-chip ${signalTone(fabric?.owner_refs_only)}`}>owner refs only</span>
            <span className={`router-chip ${signalTone(feedback?.advisory_only)}`}>feedback advisory</span>
            <span className={`router-chip ${signalTone(perception?.memorr_handoff_is_candidate_only)}`}>Memorr candidate</span>
          </div>
        </section>
      </div>

      <div className="neufab-activity-grid">
        <section className="neufab-card">
          <div className="panel-head">
            <div>
              <p className="eyebrow">Recent Frames</p>
              <h3>Corpus traffic</h3>
            </div>
            <button type="button" onClick={() => onOpen('neufab_status')}>Open</button>
          </div>
          <div className="neufab-list">
            {recentFrames.slice(-8).reverse().map((frame, index) => (
              <button className="neufab-row" type="button" onClick={() => onOpen('neufab_status')} key={`${frame.frame_id || frame.request_id || 'frame'}-${index}`}>
                <b>{partLabel(frame.source_part)} to {partLabel(frame.target_part)}</b>
                <span>{shortValue(frame.intent)} · {shortValue(frame.transport)} · {shortValue(frame.recorded_at)}</span>
              </button>
            ))}
          </div>
        </section>

        <section className="neufab-card">
          <div className="panel-head">
            <div>
              <p className="eyebrow">Feedback</p>
              <h3>Pain / pleasure signals</h3>
            </div>
            <button type="button" onClick={() => onOpen('neufab_feedback')}>Open</button>
          </div>
          <div className="neufab-list">
            {recentFeedback.slice(-8).reverse().map((item, index) => (
              <button className="neufab-row" type="button" onClick={() => onOpen('neufab_feedback')} key={`${item.feedback_id || item.request_id || 'feedback'}-${index}`}>
                <b>{shortValue(item.signal_class)} · {shortValue(item.outcome)}</b>
                <span>intensity {shortValue(item.intensity)} · confidence {shortValue(item.confidence)} · {shortValue(item.affected_ref)}</span>
              </button>
            ))}
          </div>
        </section>

        <section className="neufab-card">
          <div className="panel-head">
            <div>
              <p className="eyebrow">Perception</p>
              <h3>Semantic events</h3>
            </div>
            <button type="button" onClick={() => onOpen('neufab_perception')}>Open</button>
          </div>
          <div className="neufab-list">
            {recentEvents.slice(-8).reverse().map((event, index) => (
              <button className="neufab-row" type="button" onClick={() => onOpen('neufab_perception')} key={`${event.semantic_ref || event.request_id || 'event'}-${index}`}>
                <b>{shortValue(event.event_type)} · {shortValue(event.source_system)}</b>
                <span>{shortValue(event.profile_id)} · {shortValue(event.privacy_class)} · {shortValue(event.gemma_context_hint)}</span>
              </button>
            ))}
          </div>
        </section>
      </div>
    </article>
  );
}
