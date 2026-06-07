import { useEffect, useMemo, useState } from 'react';
import { fetchMemoryConciergeFlow, fetchSource } from '../api/consoleApi';
import type { MemoryConciergeFlow, MemoryConciergeFlowNode, SourceDetail } from '../types';

function NodeButton({
  node,
  selected,
  onSelect
}: {
  node: MemoryConciergeFlowNode;
  selected: boolean;
  onSelect: (node: MemoryConciergeFlowNode) => void;
}) {
  return (
    <button
      className={`memory-loop-node ${node.tone} ${node.state} ${selected ? 'selected' : ''}`}
      type="button"
      onClick={() => onSelect(node)}
    >
      <span className="loop-spark" />
      <strong>{node.metric}</strong>
      <span>{node.label}</span>
      <small>{node.note}</small>
    </button>
  );
}

export function MemoryConciergeLoop() {
  const [flow, setFlow] = useState<MemoryConciergeFlow | null>(null);
  const [sourceStates, setSourceStates] = useState<SourceDetail[]>([]);
  const [selected, setSelected] = useState<MemoryConciergeFlowNode | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const data = await fetchMemoryConciergeFlow();
        const criticalTargets = [
          'mail_flow',
          'concierge_lifecycle_drill',
          'mail_quarantine_review',
          'exchange_connector_status',
          'exchange_pim_reader',
          'memorr_exchange_backfill',
          'memorr_exchange_pim_context',
          'memorr_formulated_memory',
          'memorr_email_timeline',
          'gemma_models'
        ];
        const states = await Promise.allSettled(criticalTargets.map(target => fetchSource(target, { loggerEvidence: false })));
        if (cancelled) return;
        setFlow(data);
        setSourceStates(states.flatMap(result => result.status === 'fulfilled' ? [result.value] : []));
        setError(null);
        setSelected(current => current || data.nodes[0] || null);
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : String(err));
      }
    }
    load().catch(() => undefined);
    const timer = window.setInterval(() => load().catch(() => undefined), 5000);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, []);

  const activeEdges = useMemo(() => flow?.edges.filter(edge => edge.active).length ?? 0, [flow]);
  const summary = flow?.summary || {};
  const controls = flow?.operator_controls || [];
  const clickthroughs = flow?.clickthroughs || [];
  const quarantineSource = sourceStates.find(source => source.id === 'mail_quarantine_review');
  const quarantinePayload = quarantineSource?.payload as {
    summary?: Record<string, number | boolean>;
    queue?: Array<Record<string, string | boolean | string[]>>;
    postmaster_route?: Record<string, string | number | boolean>;
  } | undefined;
  const quarantineQueue = Array.isArray(quarantinePayload?.queue) ? quarantinePayload.queue : [];
  const lifecycleSource = sourceStates.find(source => source.id === 'concierge_lifecycle_drill');
  const lifecyclePayload = lifecycleSource?.payload as {
    mode?: string;
    go_no_go?: string;
    popgrabber_state?: string;
    lifecycle?: Array<Record<string, string>>;
    rollback?: Record<string, string | boolean>;
    source_policy?: Record<string, string | number | boolean>;
    credential_rotation?: Record<string, string | number | boolean>;
    exchange_failure_drill?: Record<string, string | number | boolean>;
  } | undefined;
  const lifecycleRows = Array.isArray(lifecyclePayload?.lifecycle) ? lifecyclePayload.lifecycle : [];
  const timelineSource = sourceStates.find(source => source.id === 'memorr_email_timeline');
  const timelinePayload = timelineSource?.payload as {
    summary?: Record<string, number | boolean>;
    timeline?: Array<Record<string, string | boolean | string[] | Record<string, string | boolean>>>;
    privacy?: Record<string, string | boolean>;
  } | undefined;
  const timelineRows = Array.isArray(timelinePayload?.timeline) ? timelinePayload.timeline : [];
  const exchangePimSource = sourceStates.find(source => source.id === 'exchange_pim_reader');
  const exchangePimPayload = exchangePimSource?.payload as {
    enabled?: boolean;
    configured?: boolean;
    email_folder?: string;
    contacts_folder?: string;
    calendar_folder?: string;
    target_mailbox_redacted?: string;
    read_only?: boolean;
    exchange_mutation_allowed?: boolean;
  } | undefined;
  const pimSource = sourceStates.find(source => source.id === 'memorr_exchange_pim_context');
  const pimPayload = pimSource?.payload as {
    evidence_count?: number;
    email_count?: number;
    contact_count?: number;
    calendar_count?: number;
    promoted_memory_count?: number;
    sync?: Record<string, string | number | boolean>;
    dedupe?: Record<string, string | number | boolean>;
    salience?: Record<string, string | number | boolean>;
    authority?: Record<string, string | number | boolean>;
    contextual_memories?: Array<Record<string, string | boolean>>;
    topic_timelines?: Array<Record<string, string | number>>;
    commitments?: Array<Record<string, string | boolean>>;
  } | undefined;
  const pimMemories = Array.isArray(pimPayload?.contextual_memories) ? pimPayload.contextual_memories : [];
  const pimTopics = Array.isArray(pimPayload?.topic_timelines) ? pimPayload.topic_timelines : [];
  const pimCommitments = Array.isArray(pimPayload?.commitments) ? pimPayload.commitments : [];
  const sourceSummary = sourceStates.reduce((acc, state) => {
    acc[state.ok ? 'ok' : 'degraded'] += 1;
    return acc;
  }, { ok: 0, degraded: 0 });

  return (
    <article className="ops-panel memory-loop-panel">
      <div className="ops-title">
        <div>
          <p className="eyebrow">Memory Concierge</p>
          <h2>Mail, Memory, LSB, NeuFab, Veliai</h2>
        </div>
        <span className="live-pill">{flow?.ui_data_plane || 'bus only'}</span>
      </div>

      {error && <div className="router-error">{error}</div>}

      <div className="loop-headline">
        <div>
          <strong>{summary.memorr_deliveries ?? '--'}</strong>
          <span>Memorr deliveries</span>
        </div>
        <div>
          <strong>{summary.exchange_deliveries ?? '--'}</strong>
          <span>Exchange deliveries</span>
        </div>
        <div>
          <strong>{summary.exchange_backfill_imports ?? '--'}</strong>
          <span>backfill imports</span>
        </div>
        <div>
          <strong>{summary.gemma_index_refs ?? activeEdges}</strong>
          <span>Gemma index refs</span>
        </div>
      </div>

      <div className="memory-loop-track">
        {(flow?.nodes || []).map((node, index) => (
          <div className="memory-loop-step" key={node.id}>
            <NodeButton node={node} selected={selected?.id === node.id} onSelect={setSelected} />
            {index < (flow?.nodes.length || 0) - 1 && <div className="memory-loop-line" />}
          </div>
        ))}
      </div>

      <div className="loop-detail-grid">
        <section className="loop-detail">
          <p className="eyebrow">Selected</p>
          <h3>{selected?.label || 'Waiting for Bus'}</h3>
          <p>{selected?.detail || 'No flow node has been published yet.'}</p>
          <div className="chip-row">
            <span className="router-chip ok">raw payload blocked</span>
            <span className="router-chip cloud">correlation {flow?.correlation_id || '--'}</span>
            <span className="router-chip warn">route {flow?.latest_decision?.route_action || '--'}</span>
            <span className="router-chip ok">Exchange {flow?.latest_decision?.exchange_delivery_state || '--'}</span>
            <span className="router-chip cloud">Gemma {flow?.latest_decision?.gemma_index_state || '--'}</span>
          </div>
        </section>
        <section className="loop-detail">
          <p className="eyebrow">Outcome</p>
          <h3>{flow?.go_no_go?.full_memory_product_loop || 'collecting evidence'}</h3>
          <p>{sourceSummary.ok} critical source checks live, {sourceSummary.degraded} need review through the same Console source drawer.</p>
          <div className="loop-evidence">
            {(flow?.evidence || []).map(item => (
              <span key={item.label}>
                <b>{item.label}</b>
                {item.value}
              </span>
            ))}
          </div>
        </section>
      </div>

      <div className="loop-source-strip">
        {sourceStates.map(source => (
          <button
            type="button"
            className={`loop-source-card ${source.ok ? 'ok' : 'warn'}`}
            key={source.id}
            onClick={() => window.open(`/api/console/source?target=${encodeURIComponent(source.id)}`, '_blank', 'noopener,noreferrer')}
          >
            <strong>{source.label}</strong>
            <span>{source.owner}</span>
            <small>{source.ok ? 'live' : 'review'} · {source.duration_ms} ms</small>
          </button>
        ))}
      </div>

      <div className="quarantine-review-stage">
        <section>
          <p className="eyebrow">Quarantine Review</p>
          <h3>{quarantinePayload?.summary?.visible_events ?? 0} visible / {quarantinePayload?.summary?.total_events ?? 0} total</h3>
          <div className="chip-row">
            <span className="router-chip warn">dead letters {String(quarantinePayload?.summary?.dead_letter_required ?? 0)}</span>
            <span className="router-chip cloud">postmaster {String(quarantinePayload?.summary?.postmaster_routed ?? 0)}</span>
            <span className="router-chip ok">release controls {quarantinePayload?.summary?.release_controls_enabled ? 'enabled' : 'held'}</span>
            <span className="router-chip ok">blind retry blocked</span>
          </div>
        </section>
        <div className="quarantine-queue">
          {quarantineQueue.slice(-6).map(item => (
            <button
              type="button"
              className="quarantine-card"
              key={String(item.review_id || item.audit_ref || item.correlation_id)}
              title={String(item.audit_ref || '')}
            >
              <strong>{String(item.verdict_class || 'review')}</strong>
              <span>{String(item.spam_action || 'review')} · {String(item.poison_state || 'unknown')}</span>
              <small>{item.postmaster_route_enabled ? 'postmaster route' : 'operator review'} · {String(item.dead_letter_status || 'not_required')}</small>
            </button>
          ))}
        </div>
      </div>

      <div className="lifecycle-drill-stage">
        <section>
          <p className="eyebrow">Lifecycle Drill</p>
          <h3>{String(lifecyclePayload?.mode || 'mirror')} · {String(lifecyclePayload?.go_no_go || 'collecting')}</h3>
          <div className="chip-row">
            <span className="router-chip ok">source no-delete</span>
            <span className="router-chip warn">rollback approval required</span>
            <span className="router-chip cloud">{String(lifecyclePayload?.popgrabber_state || 'popgrabber reference')}</span>
            <span className="router-chip ok">credentials hidden</span>
          </div>
        </section>
        <div className="lifecycle-drill-track">
          {lifecycleRows.map(item => (
            <div className="lifecycle-drill-card" key={String(item.step)}>
              <strong>{String(item.step || 'step')}</strong>
              <span>{String(item.state || 'pending')}</span>
              <small>{String(item.evidence || 'evidence pending')}</small>
            </div>
          ))}
          <div className="lifecycle-drill-card">
            <strong>Exchange Failure Drill</strong>
            <span>reject {String(lifecyclePayload?.exchange_failure_drill?.rejected_evidence_count ?? 0)} · fallback {String(lifecyclePayload?.exchange_failure_drill?.fallback_or_retry_count ?? 0)}</span>
            <small>policy changed {String(lifecyclePayload?.exchange_failure_drill?.live_policy_changed ?? false)}</small>
          </div>
        </div>
      </div>

      <div className="email-timeline-stage">
        <section>
          <p className="eyebrow">Memorr Email Timeline</p>
          <h3>{timelinePayload?.summary?.returned_count ?? 0} shown / {timelinePayload?.summary?.email_count ?? 0} archived</h3>
          <div className="chip-row">
            <span className="router-chip ok">read leases {String(timelinePayload?.summary?.read_lease_count ?? 0)}</span>
            <span className="router-chip cloud">attachments {String(timelinePayload?.summary?.attachment_count ?? 0)}</span>
            <span className="router-chip ok">raw MIME hidden</span>
          </div>
        </section>
        <div className="email-timeline-track">
          {timelineRows.slice(0, 6).map(item => (
            <button
              type="button"
              className="email-timeline-card"
              key={String(item.email_ref)}
              title={String(item.email_ref)}
            >
              <strong>{String(item.subject_redacted || 'redacted email')}</strong>
              <span>{String(item.received_at || 'unknown date')} · {String(item.privacy_class || 'privacy')}</span>
              <small>{String(item.gemma_index_ref || item.formulated_memory_ref || 'Gemma summary pending')}</small>
            </button>
          ))}
        </div>
      </div>

      <div className="pim-context-stage">
        <section>
          <p className="eyebrow">Exchange PIM Context</p>
          <h3>{pimPayload?.promoted_memory_count ?? 0} memories / {pimPayload?.evidence_count ?? 0} evidence</h3>
          <div className="chip-row">
            <span className={`router-chip ${exchangePimPayload?.configured ? 'ok' : 'warn'}`}>EWS {exchangePimPayload?.configured ? 'configured' : 'not configured'}</span>
            <span className="router-chip ok">read only {exchangePimPayload?.read_only ? 'yes' : 'pending'}</span>
            <span className="router-chip ok">Exchange authority</span>
            <span className="router-chip warn">mutations {pimPayload?.authority?.exchange_mutation_allowed ? 'open' : 'blocked'}</span>
          </div>
          <div className="pim-context-metrics">
            <span><b>{pimPayload?.email_count ?? 0}</b> email</span>
            <span><b>{pimPayload?.contact_count ?? 0}</b> contacts</span>
            <span><b>{pimPayload?.calendar_count ?? 0}</b> calendar</span>
            <span><b>{String(pimPayload?.dedupe?.duplicate_suppressed_count ?? 0)}</b> dedupe</span>
          </div>
        </section>
        <div className="pim-context-grid">
          <div className="pim-context-card">
            <strong>EWS Source</strong>
            <span>{exchangePimPayload?.target_mailbox_redacted || 'mailbox hidden'}</span>
            <small>{exchangePimPayload?.email_folder || 'Inbox'} · {exchangePimPayload?.contacts_folder || 'Contacts'} · {exchangePimPayload?.calendar_folder || 'Calendar'}</small>
          </div>
          {pimTopics.slice(0, 2).map(topic => (
            <div className="pim-context-card" key={String(topic.topic_ref)}>
              <strong>Topic Timeline</strong>
              <span>{String(topic.item_count ?? 0)} items · {String(topic.promoted_memory_count ?? 0)} promoted</span>
              <small>{String(topic.topic_hash || topic.topic_ref || 'topic hash')}</small>
            </div>
          ))}
          {pimCommitments.slice(0, 2).map(item => (
            <div className="pim-context-card" key={String(item.evidence_ref)}>
              <strong>Commitment</strong>
              <span>{String(item.source_timestamp || 'timestamp hidden')}</span>
              <small>{String(item.commitment_hash || 'commitment hash pending')}</small>
            </div>
          ))}
          {pimMemories.slice(0, 3).map(item => (
            <div className="pim-context-card" key={String(item.evidence_ref)}>
              <strong>{String(item.pim_kind || 'pim evidence')}</strong>
              <span>{String(item.salience_decision || 'evidence_only')} · {String(item.salience_score || '0')}</span>
              <small>{String(item.gemma_index_ref || item.memory_ref || 'evidence only')}</small>
            </div>
          ))}
        </div>
      </div>

      <div className="loop-operator-grid">
        {controls.map(group => (
          <section className="loop-operator-group" key={group.group}>
            <p className="eyebrow">{group.owner}</p>
            <h3>{group.group}</h3>
            <div className="loop-control-list">
              {group.controls.map(control => (
                <span
                  className={`loop-control ${control.enabled ? 'enabled' : 'disabled'} ${control.safe ? 'safe' : 'guarded'}`}
                  key={control.id}
                  title={`${control.method} ${control.path}${control.action ? ` action=${control.action}` : ''}`}
                >
                  <b>{control.label}</b>
                  <small>{control.safe ? 'safe' : 'guarded'} · {control.method}</small>
                </span>
              ))}
            </div>
          </section>
        ))}
      </div>

      <div className="loop-clickthroughs">
        {clickthroughs.map(item => (
          <a href={`/api/console/source?target=${encodeURIComponent(item.console_target)}`} key={item.console_target}>
            {item.label}
          </a>
        ))}
      </div>
    </article>
  );
}
