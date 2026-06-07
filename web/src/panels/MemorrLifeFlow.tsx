import { useEffect, useMemo, useState } from 'react';
import { fetchSource } from '../api/consoleApi';
import { MetricRow } from '../components/MetricRow';
import type {
  MemorrArchiveStatus,
  MemorrEmailTimelineStatus,
  MemorrExchangeBackfillStatus,
  MemorrFormulatedMemoryRecall,
  MemorrMirrorStatus,
  MemorrPimContextStatus,
  MemorrSourceStatus,
  SourceDetail
} from '../types';

interface MemorrLifeFlowProps {
  onOpen: (target: string) => void;
}

type MemorrTarget =
  | 'memorr_archive'
  | 'memorr_mirror'
  | 'memorr_source'
  | 'memorr_exchange_backfill'
  | 'memorr_exchange_pim_context'
  | 'memorr_formulated_memory'
  | 'memorr_email_timeline';

type SourceMap = Partial<{
  memorr_archive: SourceDetail<MemorrArchiveStatus>;
  memorr_mirror: SourceDetail<MemorrMirrorStatus>;
  memorr_source: SourceDetail<MemorrSourceStatus>;
  memorr_exchange_backfill: SourceDetail<MemorrExchangeBackfillStatus>;
  memorr_exchange_pim_context: SourceDetail<MemorrPimContextStatus>;
  memorr_formulated_memory: SourceDetail<MemorrFormulatedMemoryRecall>;
  memorr_email_timeline: SourceDetail<MemorrEmailTimelineStatus>;
}>;

const targets: MemorrTarget[] = [
  'memorr_archive',
  'memorr_mirror',
  'memorr_source',
  'memorr_exchange_backfill',
  'memorr_exchange_pim_context',
  'memorr_formulated_memory',
  'memorr_email_timeline'
];

function short(value: unknown, fallback = '--') {
  if (value === null || value === undefined || value === '') return fallback;
  const text = String(value);
  return text.length > 96 ? `${text.slice(0, 93)}...` : text;
}

function rows(value: unknown): Array<Record<string, unknown>> {
  return Array.isArray(value) ? value.filter(item => item && typeof item === 'object') as Array<Record<string, unknown>> : [];
}

function Bubble({ label, value, tone, onClick }: { label: string; value: string | number; tone: string; onClick: () => void }) {
  return (
    <button className={`ops-bubble ${tone}`} type="button" onClick={onClick}>
      <strong>{value}</strong>
      <span>{label}</span>
    </button>
  );
}

export function MemorrLifeFlow({ onOpen }: MemorrLifeFlowProps) {
  const [sources, setSources] = useState<SourceMap>({});

  useEffect(() => {
    let cancelled = false;
    async function load() {
      const results = await Promise.allSettled(targets.map(target => fetchSource(target, { loggerEvidence: false })));
      if (cancelled) return;
      const next: SourceMap = {};
      targets.forEach((target, index) => {
        const result = results[index];
        if (result.status === 'fulfilled') {
          if (target === 'memorr_archive') next.memorr_archive = result.value as SourceDetail<MemorrArchiveStatus>;
          if (target === 'memorr_mirror') next.memorr_mirror = result.value as SourceDetail<MemorrMirrorStatus>;
          if (target === 'memorr_source') next.memorr_source = result.value as SourceDetail<MemorrSourceStatus>;
          if (target === 'memorr_exchange_backfill') next.memorr_exchange_backfill = result.value as SourceDetail<MemorrExchangeBackfillStatus>;
          if (target === 'memorr_exchange_pim_context') next.memorr_exchange_pim_context = result.value as SourceDetail<MemorrPimContextStatus>;
          if (target === 'memorr_formulated_memory') next.memorr_formulated_memory = result.value as SourceDetail<MemorrFormulatedMemoryRecall>;
          if (target === 'memorr_email_timeline') next.memorr_email_timeline = result.value as SourceDetail<MemorrEmailTimelineStatus>;
        }
      });
      setSources(next);
    }
    load().catch(() => undefined);
    const timer = window.setInterval(() => load().catch(() => undefined), 30000);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, []);

  const archive = sources.memorr_archive?.payload;
  const processing = sources.memorr_mirror?.payload;
  const sleep = sources.memorr_source?.payload;
  const backfill = sources.memorr_exchange_backfill?.payload;
  const pim = sources.memorr_exchange_pim_context?.payload;
  const formulated = sources.memorr_formulated_memory?.payload;
  const timeline = sources.memorr_email_timeline?.payload;
  const summary = timeline?.summary || {};
  const candidates = formulated?.candidates || [];
  const timelineRows = timeline?.timeline || [];
  const contextRows = pim?.contextual_memories || [];
  const recentJobs = rows(processing?.recent_jobs);
  const liveSources = Object.values(sources).filter(source => source?.ok).length;
  const lifecycleReady = Boolean(sources.memorr_archive?.ok && sources.memorr_mirror?.ok && sources.memorr_source?.ok);
  const lineageCandidate = candidates.find(candidate => candidate.gemma_index_ref || candidate.memorr_asset_refs || String(candidate.namespace || '').includes('exchange_pim')) || candidates[0];
  const lineageArtifact = String(lineageCandidate?.artifact_ref || '');
  const lineagePim = contextRows.find(row => String(row.memory_ref || '') === lineageArtifact) || contextRows.find(row => row.memory_ref) || contextRows[0];
  const lineageJob = recentJobs.find(job => String(job.job_id || '') === String(lineageCandidate?.provenance_ref || '')) || recentJobs.find(job => String(job.state || '') === 'ready') || recentJobs[0];
  const timelineSample = timelineRows.find(row => row.formulated_memory_ref || row.gemma_index_ref) || timelineRows[0];
  const rawPayloadVisible = Boolean(
    timeline?.privacy?.raw_payload_available ||
    timeline?.privacy?.raw_mime_visible ||
    pim?.raw_payload_available_to_gemma ||
    backfill?.raw_payload_stored ||
    backfill?.raw_filter_output_visible_to_intelligence
  );
  const lineageSteps = [
    {
      label: 'Exchange Capture',
      target: 'memorr_exchange_backfill',
      state: sources.memorr_exchange_backfill?.ok ? 'ok' : 'review',
      metric: `${backfill?.imported_count ?? '--'} imported`,
      detail: `${short(backfill?.last_source_protocol, 'source')} · ${short(backfill?.last_hygiene_verdict_class, 'hygiene')}`,
      ref: backfill?.last_email_ref || backfill?.last_batch_ref
    },
    {
      label: 'Archive Boundary',
      target: 'memorr_archive',
      state: sources.memorr_archive?.ok ? 'ok' : 'review',
      metric: `${archive?.email_count ?? '--'} archived emails`,
      detail: `${archive?.document_version_count ?? '--'} versions · ${archive?.pending_ocr_or_classification_count ?? '--'} pending OCR/class`,
      ref: archive?.owner || 'memorr storage truth'
    },
    {
      label: 'Semantic Mirror',
      target: 'memorr_mirror',
      state: sources.memorr_mirror?.ok ? 'ok' : 'review',
      metric: `${processing?.ready_job_count ?? '--'} ready jobs`,
      detail: `${short(lineageJob?.tool_name, 'semantic tool')} · ${short(lineageJob?.privacy_class, 'privacy')}`,
      ref: lineageJob?.job_id || lineageCandidate?.provenance_ref
    },
    {
      label: 'Formulated Memory',
      target: 'memorr_formulated_memory',
      state: sources.memorr_formulated_memory?.ok && lineageArtifact ? 'ok' : 'review',
      metric: `${formulated?.candidate_count ?? '--'} candidates`,
      detail: `${short(lineageCandidate?.memory_type, 'memory')} · ${short(lineageCandidate?.confidence, 'confidence')}`,
      ref: lineageArtifact || lineageCandidate?.provenance_ref
    },
    {
      label: 'PIM Promotion',
      target: 'memorr_exchange_pim_context',
      state: sources.memorr_exchange_pim_context?.ok && lineagePim?.memory_ref ? 'ok' : 'review',
      metric: `${pim?.promoted_memory_count ?? '--'} promoted`,
      detail: `${short(lineagePim?.pim_kind, 'PIM')} · ${short(lineagePim?.salience_decision, 'decision')}`,
      ref: lineagePim?.gemma_index_ref || lineagePim?.memory_ref || lineagePim?.evidence_ref
    },
    {
      label: 'Privacy Boundary',
      target: 'memorr_email_timeline',
      state: rawPayloadVisible ? 'warn' : 'ok',
      metric: `${summary.read_lease_count ?? '--'} read leases`,
      detail: rawPayloadVisible ? 'raw payload review required' : 'raw payload hidden',
      ref: (timelineSample?.read_lease as Record<string, unknown> | undefined)?.evidence || timelineSample?.email_ref
    },
    {
      label: 'Sleep Lifecycle',
      target: 'memorr_source',
      state: sleep?.paused ? 'warn' : sources.memorr_source?.ok ? 'ok' : 'review',
      metric: `${sleep?.candidate_count ?? '--'} candidates`,
      detail: `${short(sleep?.latest_state, 'sleep state')} · ${sleep?.pending_count ?? '--'} pending`,
      ref: sleep?.latest_run_id
    }
  ];

  const authorityChips = useMemo(() => [
    ['Exchange authority', pim?.exchange_remains_pim_authority ? 'ok' : 'warn'],
    ['Exchange mutation blocked', backfill?.exchange_mutation_allowed || pim?.exchange_mutation_allowed ? 'hot' : 'ok'],
    ['raw payload hidden', timeline?.privacy?.raw_payload_available || pim?.raw_payload_available_to_gemma ? 'hot' : 'ok'],
    ['read lease required', timeline?.privacy?.read_lease_required_for_raw ? 'warn' : 'cloud'],
    ['credential material absent', backfill?.credential_material_included ? 'hot' : 'ok']
  ], [backfill, pim, timeline]);

  return (
    <article className="ops-panel memorr-panel">
      <div className="ops-title">
        <div>
          <p className="eyebrow">Memorr</p>
          <h2>Provenance Workbench</h2>
        </div>
        <span className="live-pill">{liveSources}/{targets.length} Bus sources live · lifecycle {lifecycleReady ? 'ready' : 'review'}</span>
      </div>

      <div className="life-flow">
        <Bubble label="archived emails" value={archive?.email_count ?? '--'} tone="cyan" onClick={() => onOpen('memorr_archive')} />
        <div className="flow-arrow" />
        <Bubble label="processing ready" value={processing?.ready_job_count ?? '--'} tone="green" onClick={() => onOpen('memorr_mirror')} />
        <div className="flow-arrow" />
        <Bubble label="sleep candidates" value={sleep?.candidate_count ?? '--'} tone="amber" onClick={() => onOpen('memorr_source')} />
        <div className="flow-arrow" />
        <Bubble label="backfill imports" value={backfill?.imported_count ?? '--'} tone="cyan" onClick={() => onOpen('memorr_exchange_backfill')} />
        <div className="flow-arrow" />
        <Bubble label="PIM evidence" value={pim?.evidence_count ?? '--'} tone="green" onClick={() => onOpen('memorr_exchange_pim_context')} />
        <div className="flow-arrow" />
        <Bubble label="sealed emails" value={summary.sealed_count ?? '--'} tone="amber" onClick={() => onOpen('memorr_email_timeline')} />
        <div className="flow-arrow" />
        <Bubble label="formulated memories" value={formulated?.candidate_count ?? summary.formulated_memory_count ?? '--'} tone="violet" onClick={() => onOpen('memorr_formulated_memory')} />
        <div className="flow-arrow" />
        <Bubble label="raw visible" value={timeline?.privacy?.raw_payload_available ? 'yes' : 'no'} tone={timeline?.privacy?.raw_payload_available ? 'amber' : 'green'} onClick={() => onOpen('memorr_email_timeline')} />
      </div>

      <section
        className="memorr-lineage-stage"
        data-memorr-lineage-steps={lineageSteps.length}
        data-memorr-lineage-live={liveSources}
        data-memorr-lineage-raw-visible={String(rawPayloadVisible)}
        data-memorr-lineage-gemma-index={short(lineagePim?.gemma_index_ref || lineageCandidate?.gemma_index_ref, 'absent')}
      >
        <div>
          <p className="eyebrow">Owner-backed sample</p>
          <h3>Memorr Evidence Lineage</h3>
          <div className="chip-row">
            <span className={`router-chip ${lineageArtifact ? 'ok' : 'warn'}`}>formulated memory linked</span>
            <span className={`router-chip ${rawPayloadVisible ? 'hot' : 'ok'}`}>{rawPayloadVisible ? 'raw payload visible' : 'raw payload hidden'}</span>
            <span className="router-chip cloud">Gateway index ref only</span>
            <span className="router-chip warn">actions still owner-gated</span>
          </div>
        </div>
        <div className="memorr-lineage-track">
          {lineageSteps.map(step => (
            <button
              type="button"
              className={`memorr-lineage-card ${step.state}`}
              key={step.label}
              onClick={() => onOpen(step.target)}
            >
              <strong>{step.label}</strong>
              <span>{step.metric}</span>
              <small>{step.detail}</small>
              <em>{short(step.ref)}</em>
            </button>
          ))}
        </div>
      </section>

      <div className="memorr-provenance-grid">
        <section className="memorr-card">
          <p className="eyebrow">Archive Status</p>
          <div className="ops-metrics compact">
            <MetricRow label="emails" value={archive?.email_count ?? '--'} />
            <MetricRow label="attachments" value={archive?.attachment_count ?? '--'} />
            <MetricRow label="versions" value={archive?.document_version_count ?? '--'} />
            <MetricRow label="sealed" value={archive?.sealed_count ?? '--'} />
            <MetricRow label="quarantine" value={archive?.quarantine_evidence_count ?? '--'} />
            <MetricRow label="pending OCR/class" value={archive?.pending_ocr_or_classification_count ?? '--'} />
          </div>
          <div className="chip-row">
            <span className={`router-chip ${archive?.path_api ? 'hot' : 'ok'}`}>Bus source</span>
            <span className="router-chip warn">no-store attachments {archive?.no_store_attachment_count ?? '--'}</span>
            <span className="router-chip ok">owner {short(archive?.owner, 'memorr')}</span>
          </div>
          <button type="button" onClick={() => onOpen('memorr_archive')}>open archive source</button>
        </section>

        <section className="memorr-card">
          <p className="eyebrow">Processing Mirror</p>
          <div className="ops-metrics compact">
            <MetricRow label="semantic jobs" value={processing?.semantic_job_count ?? '--'} />
            <MetricRow label="ready" value={processing?.ready_job_count ?? '--'} />
            <MetricRow label="pending" value={processing?.pending_job_count ?? '--'} />
            <MetricRow label="failed" value={processing?.failed_job_count ?? '--'} />
            <MetricRow label="OCR jobs" value={processing?.ocr_job_count ?? '--'} />
            <MetricRow label="Veliai docs" value={processing?.veliai_document_job_count ?? '--'} />
          </div>
          <div className="chip-row">
            <span className={`router-chip ${processing?.raw_payload_exposed_to_lsb ? 'hot' : 'ok'}`}>raw hidden from LSB</span>
            <span className={`router-chip ${processing?.memorr_is_owner_truth ? 'ok' : 'warn'}`}>Memorr owner truth</span>
            <span className={`router-chip ${processing?.veliai_is_executor ? 'cloud' : 'warn'}`}>Veliai executor</span>
          </div>
          <button type="button" onClick={() => onOpen('memorr_mirror')}>open processing source</button>
        </section>

        <section className="memorr-card">
          <p className="eyebrow">Sleep Lifecycle</p>
          <div className="ops-metrics compact">
            <MetricRow label="runs" value={sleep?.run_count ?? '--'} />
            <MetricRow label="candidates" value={sleep?.candidate_count ?? '--'} />
            <MetricRow label="artifacts" value={sleep?.artifact_count ?? '--'} />
            <MetricRow label="pending" value={sleep?.pending_count ?? '--'} />
            <MetricRow label="deferred" value={sleep?.deferred_count ?? '--'} />
            <MetricRow label="paused" value={sleep?.paused ? 'yes' : 'no'} />
          </div>
          <div className="chip-row">
            <span className={`router-chip ${sleep?.paused ? 'warn' : 'ok'}`}>{short(sleep?.latest_state, 'sleep state')}</span>
            <span className="router-chip cloud">{short(sleep?.latest_run_id, 'latest run')}</span>
          </div>
          <button type="button" onClick={() => onOpen('memorr_source')}>open sleep source</button>
        </section>

        <section className="memorr-card">
          <p className="eyebrow">Exchange Backfill</p>
          <div className="ops-metrics compact">
            <MetricRow label="batches" value={backfill?.batch_count ?? '--'} />
            <MetricRow label="imported" value={backfill?.imported_count ?? '--'} />
            <MetricRow label="duplicates skipped" value={backfill?.skipped_duplicate_count ?? '--'} />
            <MetricRow label="failed" value={backfill?.failed_count ?? '--'} />
            <MetricRow label="score-only hygiene" value={backfill?.score_only_hygiene_count ?? '--'} />
            <MetricRow label="hygiene missing" value={backfill?.score_only_hygiene_missing_count ?? '--'} />
            <MetricRow label="hygiene suppressed" value={backfill?.hygiene_suppressed_count ?? '--'} />
            <MetricRow label="raw MIME assets" value={backfill?.raw_mime_imported_count ?? '--'} />
            <MetricRow label="attachments" value={backfill?.attachment_imported_count ?? '--'} />
            <MetricRow label="document versions" value={backfill?.document_version_imported_count ?? '--'} />
          </div>
          <div className="chip-row">
            <span className={`router-chip ${backfill?.score_only_hygiene_required ? 'ok' : 'hot'}`}>score-only required</span>
            <span className={`router-chip ${backfill?.last_memorr_action === 'suppress' ? 'warn' : 'ok'}`}>Memorr {short(backfill?.last_memorr_action, 'pending')}</span>
            <span className={`router-chip ${backfill?.last_exchange_delivery_action === 'junk' ? 'warn' : 'cloud'}`}>Exchange {short(backfill?.last_exchange_delivery_action, 'pending')}</span>
            <span className={`router-chip ${backfill?.raw_filter_output_visible_to_intelligence || backfill?.raw_payload_stored ? 'hot' : 'ok'}`}>raw hidden</span>
            <span className={`router-chip ${backfill?.last_raw_object_ref ? 'cloud' : 'warn'}`}>MIME asset {short(backfill?.last_raw_mime_sha256, 'pending')}</span>
          </div>
          <button type="button" onClick={() => onOpen('memorr_exchange_backfill')}>{short(backfill?.last_batch_ref, 'open backfill source')}</button>
        </section>

        <section className="memorr-card">
          <p className="eyebrow">PIM Context</p>
          <div className="ops-metrics compact">
            <MetricRow label="email" value={pim?.email_count ?? '--'} />
            <MetricRow label="contacts" value={pim?.contact_count ?? '--'} />
            <MetricRow label="calendar" value={pim?.calendar_count ?? '--'} />
            <MetricRow label="promoted" value={pim?.promoted_memory_count ?? '--'} />
            <MetricRow label="duplicates suppressed" value={short(pim?.dedupe?.duplicate_suppressed_count)} />
            <MetricRow label="evidence only" value={short(pim?.salience?.evidence_only_count)} />
          </div>
          <div className="chip-row">
            {authorityChips.map(([label, tone]) => <span className={`router-chip ${tone}`} key={label}>{label}</span>)}
          </div>
        </section>

        <section className="memorr-card">
          <p className="eyebrow">Email Timeline</p>
          <div className="ops-metrics compact">
            <MetricRow label="emails" value={summary.email_count ?? '--'} />
            <MetricRow label="returned" value={summary.returned_count ?? '--'} />
            <MetricRow label="attachments" value={summary.attachment_count ?? '--'} />
            <MetricRow label="read leases" value={summary.read_lease_count ?? '--'} />
          </div>
          <button type="button" onClick={() => onOpen('memorr_email_timeline')}>descriptor-only timeline</button>
        </section>
      </div>

      <div className="memorr-candidate-grid">
        <section>
          <div className="panel-head">
            <div>
              <p className="eyebrow">Formulated Recall</p>
              <h3>{formulated?.estimated_tokens ?? '--'} estimated tokens</h3>
            </div>
            <button type="button" onClick={() => onOpen('memorr_formulated_memory')}>Recall Source</button>
          </div>
          <div className="memorr-list">
            {candidates.slice(0, 5).map(candidate => (
              <button type="button" key={String(candidate.artifact_ref || candidate.provenance_ref)} onClick={() => onOpen('memorr_formulated_memory')}>
                <strong>{short(candidate.memory_type, 'memory')}</strong>
                <span>{short(candidate.retrieval_summary)}</span>
                <small>{short(candidate.provenance_ref || candidate.source_refs)}</small>
              </button>
            ))}
            {!candidates.length && <span className="instrument off">formulated recall waiting for owner payload</span>}
          </div>
        </section>

        <section>
          <div className="panel-head">
            <div>
              <p className="eyebrow">Timeline and Context</p>
              <h3>{timelineRows.length} descriptors visible</h3>
            </div>
            <button type="button" onClick={() => onOpen('memorr_exchange_pim_context')}>PIM Source</button>
          </div>
          <div className="memorr-list">
            {timelineRows.slice(0, 3).map(row => (
              <button type="button" key={String(row.email_ref || row.thread_id)} onClick={() => onOpen('memorr_email_timeline')}>
                <strong>{short(row.archive_class || row.privacy_class, 'email descriptor')}</strong>
                <span>{short(row.sender_redacted)} · {short(row.received_at)}</span>
                <small>{short((row.read_lease as Record<string, unknown> | undefined)?.evidence || row.email_ref)}</small>
              </button>
            ))}
            {contextRows.slice(0, 2).map(row => (
              <button type="button" key={String(row.evidence_ref || row.memory_ref)} onClick={() => onOpen('memorr_exchange_pim_context')}>
                <strong>{short(row.pim_kind, 'PIM context')}</strong>
                <span>{short(row.salience_decision)} · score {short(row.salience_score)}</span>
                <small>{short(row.memory_ref || row.timeline_ref)}</small>
              </button>
            ))}
          </div>
        </section>
      </div>

      <div className="instrument-row">
        <button type="button" className={`instrument ${sources.memorr_archive?.ok ? 'on' : 'off'}`} onClick={() => onOpen('memorr_archive')}>archive status live</button>
        <button type="button" className={`instrument ${sources.memorr_mirror?.ok ? 'on' : 'off'}`} onClick={() => onOpen('memorr_mirror')}>processing mirror live</button>
        <button type="button" className={`instrument ${sources.memorr_source?.ok ? 'on' : 'off'}`} onClick={() => onOpen('memorr_source')}>sleep lifecycle live</button>
        <button type="button" className="instrument on" onClick={() => onOpen('memorr_formulated_memory')}>read-only recall live</button>
        <button type="button" className="instrument on" onClick={() => onOpen('memorr_email_timeline')}>descriptor timeline live</button>
      </div>
    </article>
  );
}
