import { useEffect, useMemo, useState } from 'react';
import { fetchSource } from '../api/consoleApi';
import { MetricRow } from '../components/MetricRow';
import { StatusChip } from '../components/StatusChip';
import type { OwnerActionReadinessOwner, OwnerActionReadinessPayload, SourceDetail } from '../types';

interface OwnerActionReadinessPanelProps {
  onOpen: (target: string) => void;
}

function gateLabel(value: string) {
  return value.replace(/_/g, ' ');
}

function ownerTone(owner: OwnerActionReadinessOwner) {
  if (owner.action_ready || owner.action_dispatch_allowed) return 'ok';
  if (owner.authority.write_authority === 'none') return 'degraded';
  return 'unavailable';
}

function short(text: string, length = 120) {
  if (!text) return '--';
  return text.length > length ? `${text.slice(0, length - 3)}...` : text;
}

async function fetchOwnerActionReadiness(attempts = 3): Promise<SourceDetail<OwnerActionReadinessPayload>> {
  let latest: SourceDetail<OwnerActionReadinessPayload> | null = null;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    latest = await fetchSource<OwnerActionReadinessPayload>('owner_action_readiness', { loggerEvidence: false });
    if (latest.ok && latest.http_status === 200) return latest;
    await new Promise(resolve => window.setTimeout(resolve, 350 * attempt));
  }
  if (latest) return latest;
  throw new Error('owner_action_readiness source unavailable');
}

export function OwnerActionReadinessPanel({ onOpen }: OwnerActionReadinessPanelProps) {
  const [source, setSource] = useState<SourceDetail<OwnerActionReadinessPayload> | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [lastTick, setLastTick] = useState('--');

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const next = await fetchOwnerActionReadiness();
        if (cancelled) return;
        setSource(next);
        setError(null);
        setLastTick(new Date().toLocaleTimeString());
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

  const payload = source?.payload;
  const owners = payload?.owners || [];
  const writeOwners = useMemo(() => owners.filter(owner => owner.capability_counts.write > 0), [owners]);
  const summary = payload?.summary;
  const sourceState = source?.ok ? 'degraded' : 'unavailable';
  const nonRuntimeContract = payload?.source_fixture?.non_runtime_contract === true;
  const runtimeReadyOwners = owners.filter(owner => owner.action_ready || owner.action_dispatch_allowed).length;
  const compareProofMissing = owners.filter(owner => owner.comparison.runtime_proof_status !== 'green').length;
  const rollbackProofMissing = owners.filter(owner => owner.rollback.execution_proof_status !== 'green').length;
  const fallbackTruthOwners = owners.filter(owner => owner.rollback.preserves_owner_truth).length;
  const privatePayloadClearOwners = owners.filter(owner => !owner.display_policy.raw_private_payload_visible && !owner.authority.private_file_api_allowed).length;
  const contractLedger = [
    {
      label: 'runtime action contract',
      value: nonRuntimeContract ? 'not live' : 'runtime',
      detail: payload?.source_fixture?.status || 'source pending',
      tone: nonRuntimeContract ? 'warn' : 'ok'
    },
    {
      label: 'dispatch owners ready',
      value: `${runtimeReadyOwners}/${summary?.owner_count ?? owners.length}`,
      detail: summary?.ready_for_action_dispatch ? 'dispatch permitted' : 'dispatch disabled',
      tone: runtimeReadyOwners > 0 || summary?.ready_for_action_dispatch ? 'hot' : 'ok'
    },
    {
      label: 'mutation authority',
      value: summary?.mutation_allowed ? 'allowed' : 'blocked',
      detail: summary?.mutation_allowed ? 'owner writes may execute' : 'no owner apply endpoint proven',
      tone: summary?.mutation_allowed ? 'hot' : 'ok'
    },
    {
      label: 'compare proof missing',
      value: compareProofMissing,
      detail: 'owner-native visual/runtime compare',
      tone: compareProofMissing ? 'warn' : 'ok'
    },
    {
      label: 'rollback proof missing',
      value: rollbackProofMissing,
      detail: 'execution proof required before actions',
      tone: rollbackProofMissing ? 'warn' : 'ok'
    },
    {
      label: 'owner truth fallback',
      value: `${fallbackTruthOwners}/${summary?.owner_count ?? owners.length}`,
      detail: 'fallback preserves owner authority',
      tone: fallbackTruthOwners === (summary?.owner_count ?? owners.length) ? 'ok' : 'warn'
    },
    {
      label: 'private payload policy',
      value: `${privatePayloadClearOwners}/${summary?.owner_count ?? owners.length}`,
      detail: summary?.raw_private_payload_visible ? 'raw payload visible' : 'raw payload hidden',
      tone: summary?.raw_private_payload_visible ? 'hot' : 'ok'
    }
  ];
  const handoffPhases = [
    {
      label: 'source-native compare',
      gate: 'owner_native_compare_proof_missing',
      detail: 'owner runtime parity proof'
    },
    {
      label: 'preview',
      gate: 'owner_preview_contract_missing',
      detail: 'owner preview contract'
    },
    {
      label: 'confirm',
      gate: 'operator_confirmation_contract_missing',
      detail: 'operator confirmation contract'
    },
    {
      label: 'apply',
      gate: 'apply_endpoint_not_proven',
      detail: 'owner apply endpoint proof'
    },
    {
      label: 'verify',
      gate: 'action_verification_contract_missing',
      detail: 'post-apply verification proof'
    },
    {
      label: 'rollback',
      gate: 'rollback_execution_proof_missing',
      detail: 'rollback execution proof'
    },
    {
      label: 'Logger proof',
      gate: 'logger_action_evidence_missing',
      detail: 'targeted action evidence'
    }
  ].map(phase => {
    const blockedOwners = owners.filter(owner => owner.missing_gates.includes(phase.gate));
    return {
      ...phase,
      blockedOwners,
      blockedCount: blockedOwners.length
    };
  });
  const openHandoffPhases = handoffPhases.filter(phase => phase.blockedCount > 0).length;

  return (
    <section className="panel owner-action-readiness-panel wide">
      <div className="panel-head">
        <div>
          <p className="eyebrow">Epic 26 Action Authority</p>
          <h2>Owner action readiness and rollback proof</h2>
        </div>
        <div className="statusbar">
          <StatusChip state={sourceState} label={summary?.go_no_go || (source?.ok ? 'loaded' : 'loading')} />
          <button type="button" onClick={() => onOpen('owner_action_readiness')}>Open Evidence</button>
        </div>
      </div>

      <div className="action-readiness-summary">
        <MetricRow label="owners" value={summary?.owner_count ?? '--'} />
        <MetricRow label="write owners" value={summary?.write_owner_count ?? '--'} />
        <MetricRow label="blocked actions" value={summary?.blocked_action_count ?? '--'} />
        <MetricRow label="rollback contracts" value={summary?.rollback_contract_count ?? '--'} />
        <MetricRow label="correlation required" value={summary?.correlation_required_count ?? '--'} />
        <MetricRow label="dispatch ready" value={summary?.ready_for_action_dispatch ? 'yes' : 'no'} />
      </div>

      <div className="action-readiness-strip">
        <span><b>source</b>{payload?.source_fixture?.path || '--'}</span>
        <span><b>fixture</b>{payload?.source_fixture?.status || '--'}</span>
        <span><b>data plane</b>{payload?.data_plane || source?.data_plane || '--'}</span>
        <span><b>mutation</b>{summary?.mutation_allowed ? 'allowed' : 'blocked'}</span>
        <span><b>last proof</b>{lastTick}</span>
      </div>

      <div className="action-contract-ledger">
        {contractLedger.map(item => (
          <button key={item.label} type="button" className={`action-contract-card ${item.tone}`} onClick={() => onOpen('owner_action_readiness')}>
            <span>{item.label}</span>
            <strong>{item.value}</strong>
            <small>{item.detail}</small>
          </button>
        ))}
      </div>

      <div className="action-handoff-matrix" data-action-handoff-open={openHandoffPhases}>
        <div className="panel-head">
          <div>
            <p className="eyebrow">Owner Handoff</p>
            <h3>Preview, apply, verify, rollback, and proof contracts</h3>
          </div>
          <StatusChip state={openHandoffPhases ? 'unavailable' : 'ok'} label={openHandoffPhases ? 'contracts open' : 'ready'} />
        </div>
        <div className="action-handoff-grid">
          {handoffPhases.map(phase => (
            <button key={phase.gate} type="button" onClick={() => onOpen('owner_action_readiness')}>
              <StatusChip state={phase.blockedCount ? 'unavailable' : 'ok'} label={phase.blockedCount ? 'blocked' : 'clear'} />
              <span>{phase.label}</span>
              <strong>{phase.blockedCount}/{owners.length || '--'}</strong>
              <small>{phase.detail}</small>
              <em>{phase.blockedOwners.map(owner => owner.owner_id).join(' · ') || 'all owners clear'}</em>
            </button>
          ))}
        </div>
      </div>

      {error ? <p className="hint">{error}</p> : null}

      <div className="owner-action-grid">
        {owners.map(owner => (
          <button key={owner.owner_id} type="button" className={`owner-action-card ${ownerTone(owner)}`} onClick={() => onOpen('owner_action_readiness')}>
            <div className="owner-action-head">
              <StatusChip state={ownerTone(owner)} label={owner.action_ready ? 'ready' : owner.authority.write_authority === 'none' ? 'display' : 'blocked'} />
              <div>
                <h3>{owner.owner_id}</h3>
                <p>{owner.owner_host} · {owner.stage}</p>
              </div>
            </div>
            <div className="owner-action-facts">
              <span><b>{owner.capability_counts.write}</b> write</span>
              <span><b>{owner.capability_counts.read}</b> read</span>
              <span><b>{owner.rollback.preserves_owner_truth ? 'yes' : 'no'}</b> rollback truth</span>
              <span><b>{owner.bus_identity.correlation_required ? 'yes' : 'no'}</b> correlation</span>
              <span><b>{owner.comparison.runtime_proof_status}</b> compare proof</span>
              <span><b>{owner.rollback.execution_proof_status}</b> rollback proof</span>
            </div>
            <p>{short(owner.rollback.fallback_ref)}</p>
            <div className="owner-action-gates">
              {owner.missing_gates.slice(0, 10).map(gate => <span key={gate}>{gateLabel(gate)}</span>)}
            </div>
          </button>
        ))}
      </div>

      <div className="action-write-rail">
        {writeOwners.map(owner => (
          <span key={owner.owner_id}>
            <b>{owner.owner_id}</b>
            {owner.write_capabilities.join(', ') || 'no write surface'}
          </span>
        ))}
      </div>
    </section>
  );
}
