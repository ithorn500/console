import { useEffect, useMemo, useState } from 'react';
import { fetchSource, postSourceAction } from '../api/consoleApi';
import { MetricRow } from '../components/MetricRow';
import { StatusChip } from '../components/StatusChip';
import type { SourceDetail, SourceState } from '../types';

interface ConciergeBackupPanelProps {
  onOpen: (target: string) => void;
}

type GuestIdentity = {
  guest_kind?: string;
  guest_id?: string;
  guest_name?: string;
  guest_instance_id?: string;
  lineage_key?: string;
  vmid_reuse_safe?: boolean;
};

type BackupRecord = {
  host: string;
  backup_id: string;
  artifact_type?: string;
  dedupe_domain?: string;
  lineage_key?: string;
  guest_identity?: GuestIdentity;
  source_artifact_size_bytes?: number;
  source_artifact_sha256?: string;
  expected_output_sha256?: string;
  chunk_count?: number;
  created_at?: string;
  local_manifest_path?: string;
  cloud_manifest_path?: string;
  restore_supported?: boolean;
  restore_apply_guest_supported?: boolean;
  operator_start_policy?: string;
};

type BackupLineage = {
  key: string;
  host: string;
  kind: string;
  guestId: string;
  label: string;
  latest: BackupRecord;
  versions: BackupRecord[];
};

type Gate = {
  gate: string;
  state: string;
  detail: string;
};

type ConciergeBackupStatus = {
  ok?: boolean;
  state?: string;
  go_no_go?: string;
  full_product_ready?: boolean;
  generated_at?: string;
  data_plane?: string;
  custody_chain?: string[];
  data_root?: { path?: string; exists?: boolean; available_bytes?: number; capacity_bytes?: number };
  vault_root?: { path?: string; exists?: boolean; available_bytes?: number; capacity_bytes?: number };
  google?: {
    api_direct?: boolean;
    remote_root?: string;
    token?: { has_refresh_token?: boolean };
    catalog_index_used?: boolean;
    recursive_drive_scan_used?: boolean;
  };
  catalog?: {
    host_count?: number;
    backup_count?: number;
    chunk_ref_count?: number;
    pack_count?: number;
    generated_at?: string;
  };
  backup_inventory?: {
    backup_count?: number;
    hosts?: Record<string, number>;
    lineages?: Record<string, number>;
    backups?: BackupRecord[];
  };
  restore?: {
    binary_available?: boolean;
    apply_guest_available?: boolean;
    apply_guest_requires_explicit_operator_action?: boolean;
    apply_guest_starts_guest?: boolean;
    operator_start_from_proxmox_ui?: boolean;
    default_stage_root?: string;
  };
  product_readiness?: {
    cloud_custody_ready?: boolean;
    host_config_ready?: boolean;
    lxc_backup_ready?: boolean;
    vm_backup_ready?: boolean;
    scheduler_execution_ready?: boolean;
    restore_apply_ready?: boolean;
    pve_remote_guest_custody_ready?: boolean;
    full_host_sweep_ready?: boolean;
  };
  gates?: Gate[];
};

type BackupSchedule = {
  schedule_id: string;
  enabled: boolean;
  host: string;
  target_type: string;
  target_ids: string;
  cadence: string;
  local_time: string;
  retention_keep_last: number;
  quiesce: string;
  notes: string;
};

type BackupSchedulePayload = {
  ok?: boolean;
  schedule_contract?: { schedules?: BackupSchedule[] };
  schedules?: BackupSchedule[];
};

type RestoreDraft = {
  targetHost: string;
  targetId: string;
  targetName: string;
  targetStorage: string;
  stageRoot: string;
  targetRoot: string;
};

const defaultSchedule: BackupSchedule = {
  schedule_id: 'pve3-daily-lxc',
  enabled: true,
  host: 'PVE3',
  target_type: 'linux_lxc',
  target_ids: '',
  cadence: 'daily',
  local_time: '02:00',
  retention_keep_last: 7,
  quiesce: 'snapshot',
  notes: ''
};

function fmtBytes(value?: number) {
  if (value === undefined || value === null) return '--';
  const units = ['B', 'KiB', 'MiB', 'GiB', 'TiB'];
  let next = value;
  let index = 0;
  while (next >= 1024 && index < units.length - 1) {
    next /= 1024;
    index += 1;
  }
  return `${next.toFixed(index === 0 ? 0 : 1)} ${units[index]}`;
}

function short(value?: string, fallback = '--', length = 48) {
  if (!value) return fallback;
  return value.length > length ? `${value.slice(0, length - 3)}...` : value;
}

function backupKind(backup?: BackupRecord) {
  const type = backup?.artifact_type || '';
  if (type.includes('lxc')) return 'lxc';
  if (type.includes('vm')) return 'vm';
  if (type.includes('host') || backup?.backup_id?.startsWith('host-config-')) return 'host';
  return 'backup';
}

function backupLabel(backup: BackupRecord) {
  const identity = backup.guest_identity || {};
  return identity.guest_name || `${backupKind(backup).toUpperCase()} ${identity.guest_id || backup.backup_id}`;
}

function backupGuestId(backup: BackupRecord) {
  const identity = backup.guest_identity || {};
  if (identity.guest_id) return identity.guest_id;
  const match = backup.backup_id.match(/^(lxc|vm)-(\d+)-/);
  return match?.[2] || '';
}

function backupLineageKey(backup: BackupRecord) {
  const kind = backupKind(backup);
  const guestId = backupGuestId(backup);
  return guestId ? `${backup.host}:${kind}:${guestId}` : `${backup.host}:${kind}:${backup.backup_id}`;
}

function backupVersionLabel(backup: BackupRecord) {
  const when = backup.created_at || backup.backup_id;
  return `${when} · ${fmtBytes(backup.source_artifact_size_bytes)} · ${backup.chunk_count ?? '--'} chunks`;
}

function statusTone(payload: ConciergeBackupStatus | undefined, source: SourceDetail<ConciergeBackupStatus> | null): SourceState {
  if (!source || !source.ok) return 'unavailable';
  if (payload?.full_product_ready && payload.go_no_go === 'go') return 'ok';
  return 'degraded';
}

function commandFor(backup: BackupRecord | undefined, draft: RestoreDraft) {
  if (!backup) return '';
  const kind = backupKind(backup);
  const stageRoot = draft.stageRoot || '/Data/Backup/Restore/tmp';
  const targetRoot = draft.targetRoot || '/';
  const runHost = (draft.targetHost || backup.host || '').toLowerCase();
  if (kind === 'host') {
    const command = [
      'concierge-bare-metal-restore',
      '--apply-host-config',
      '--i-understand-this-writes-etc',
      `--host ${backup.host}`,
      `--backup-id ${backup.backup_id}`,
      `--stage-root ${stageRoot}`,
      `--target-root ${targetRoot}`
    ].join(' ');
    return runHost ? `ssh ${runHost}.amber.com 'sudo ${command}'` : command;
  }
  const command = [
    'concierge-bare-metal-restore',
    '--apply-guest',
    '--i-understand-this-writes-pve-guest',
    `--host ${backup.host}`,
    `--backup-id ${backup.backup_id}`,
    `--stage-root ${stageRoot}`,
    `--target-root ${targetRoot}`,
    `--guest-kind ${kind}`,
    `--target-id ${draft.targetId || '<new-id>'}`,
    draft.targetName ? `--target-name ${draft.targetName}` : ''
  ].filter(Boolean).join(' ');
  return runHost ? `ssh ${runHost}.amber.com 'sudo ${command}'` : command;
}

export function ConciergeBackupPanel({ onOpen }: ConciergeBackupPanelProps) {
  const [source, setSource] = useState<SourceDetail<ConciergeBackupStatus> | null>(null);
  const [scheduleSource, setScheduleSource] = useState<SourceDetail<BackupSchedulePayload> | null>(null);
  const [selectedLineageKey, setSelectedLineageKey] = useState('');
  const [selectedId, setSelectedId] = useState('');
  const [hostFilter, setHostFilter] = useState('all');
  const [kindFilter, setKindFilter] = useState('all');
  const [query, setQuery] = useState('');
  const [draft, setDraft] = useState<BackupSchedule>(defaultSchedule);
  const [restoreDraft, setRestoreDraft] = useState<RestoreDraft>({
    targetHost: 'PVE3',
    targetId: '',
    targetName: '',
    targetStorage: 'local',
    stageRoot: '/Data/Backup/Restore/tmp',
    targetRoot: '/'
  });
  const [saving, setSaving] = useState(false);
  const [actionBusy, setActionBusy] = useState('');
  const [actionResult, setActionResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [lastTick, setLastTick] = useState('--');

  useEffect(() => {
    let cancelled = false;
    async function load() {
      const errors: string[] = [];
      try {
        const status = await fetchSource<ConciergeBackupStatus>('concierge_proxmox_backup', { loggerEvidence: false });
        if (cancelled) return;
        const list = status.payload?.backup_inventory?.backups || [];
        setSource(status);
        setSelectedLineageKey(current => current || (list[0] ? backupLineageKey(list[0]) : ''));
        setSelectedId(current => current || (list[0] ? `${list[0].host}/${list[0].backup_id}` : ''));
        setLastTick(new Date().toLocaleTimeString());
      } catch (err) {
        errors.push(err instanceof Error ? err.message : String(err));
      }
      try {
        const schedules = await fetchSource<BackupSchedulePayload>('concierge_proxmox_backup_schedules', { loggerEvidence: false });
        if (cancelled) return;
        setScheduleSource(schedules);
        const existing = schedules.payload?.schedule_contract?.schedules || schedules.payload?.schedules || [];
        if (existing[0]) setDraft(existing[0]);
      } catch (err) {
        errors.push(err instanceof Error ? err.message : String(err));
      }
      if (!cancelled) setError(errors.length ? errors.join(' / ') : null);
    }
    load();
    const timer = window.setInterval(load, 30000);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, []);

  const payload = source?.payload;
  const backups = payload?.backup_inventory?.backups || [];
  const hosts = Object.keys(payload?.backup_inventory?.hosts || {}).sort();
  const schedules = scheduleSource?.payload?.schedule_contract?.schedules || scheduleSource?.payload?.schedules || [];
  const lineages = useMemo(() => {
    const groups = new Map<string, BackupRecord[]>();
    backups.forEach(backup => {
      const key = backupLineageKey(backup);
      groups.set(key, [...(groups.get(key) || []), backup]);
    });
    return Array.from(groups.entries()).map(([key, versions]) => {
      const sorted = [...versions].sort((a, b) => (b.created_at || b.backup_id).localeCompare(a.created_at || a.backup_id));
      const latest = sorted[0];
      return {
        key,
        host: latest.host,
        kind: backupKind(latest),
        guestId: backupGuestId(latest),
        label: backupLabel(latest),
        latest,
        versions: sorted
      };
    }).sort((a, b) => (b.latest.created_at || b.latest.backup_id).localeCompare(a.latest.created_at || a.latest.backup_id));
  }, [backups]);
  const filteredLineages = useMemo(() => lineages.filter(lineage => {
    const haystack = `${lineage.host} ${lineage.kind} ${lineage.guestId} ${lineage.label} ${lineage.key} ${lineage.versions.map(version => version.backup_id).join(' ')}`.toLowerCase();
    return (hostFilter === 'all' || lineage.host === hostFilter)
      && (kindFilter === 'all' || lineage.kind === kindFilter)
      && (!query.trim() || haystack.includes(query.trim().toLowerCase()));
  }), [lineages, hostFilter, kindFilter, query]);
  const selectedLineage = lineages.find(lineage => lineage.key === selectedLineageKey) || filteredLineages[0] || lineages[0];
  const selected = selectedLineage?.versions.find(backup => `${backup.host}/${backup.backup_id}` === selectedId) || selectedLineage?.versions[0] || backups[0];
  const openGates = payload?.gates?.filter(gate => gate.state !== 'green') || [];
  const managerState = statusTone(payload, source);
  const restoreCommand = commandFor(selected, restoreDraft);

  async function saveSchedule() {
    setSaving(true);
    setError(null);
    const body = {
      schema: 'amber.concierge.proxmox_backup.schedule_set.v1',
      ok: true,
      data_plane: 'amber_bus_only',
      owner: 'amber-bus-concierge',
      pve_mutation_on_save: false,
      destructive_delete_scheduled: false,
      schedules: [draft],
      defaults: {
        custody_chain: ['/Data', '/Vault', 'google_drive_direct_api'],
        host_backup_default: true,
        retention_keep_last: draft.retention_keep_last
      }
    };
    try {
      const saved = await postSourceAction<BackupSchedulePayload>('concierge_proxmox_backup_schedules', body);
      setScheduleSource(saved);
      setLastTick(new Date().toLocaleTimeString());
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSaving(false);
    }
  }

  async function runBackupAction(action: string, execute = false) {
    if (!selected && !['scrub_packs', 'restore_drill', 'retention_plan', 'gc_plan'].includes(action)) return;
    setActionBusy(action);
    setError(null);
    setActionResult(null);
    const body = {
      schema: 'amber.concierge.proxmox_backup.action.v1',
      action,
      host: selected?.host || '',
      backup_id: selected?.backup_id || '',
      guest_kind: selected ? backupKind(selected) : 'lxc',
      target_id: restoreDraft.targetId,
      target_name: restoreDraft.targetName,
      target_storage: restoreDraft.targetStorage,
      stage_root: restoreDraft.stageRoot,
      target_root: restoreDraft.targetRoot,
      confirm_guest_apply: action === 'apply_guest',
      confirm_host_apply: action === 'apply_host_config',
      execute,
      keep_last: draft.retention_keep_last
    };
    try {
      const result = await postSourceAction<Record<string, unknown>>('concierge_proxmox_backup_actions', body);
      setActionResult(JSON.stringify(result.payload || result, null, 2));
      const refreshed = await fetchSource<ConciergeBackupStatus>('concierge_proxmox_backup', { loggerEvidence: false });
      setSource(refreshed);
      setLastTick(new Date().toLocaleTimeString());
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setActionBusy('');
    }
  }

  return (
    <section className="panel wide backup-manager-panel">
      <div className="backup-manager-top">
        <div>
          <p className="eyebrow">Concierge Backup</p>
          <h2>Backup Management</h2>
        </div>
        <div className="statusbar">
          <StatusChip state={managerState} label={payload?.full_product_ready ? 'ready' : 'attention'} />
          <button type="button" onClick={() => onOpen('concierge_proxmox_backup')}>Evidence</button>
        </div>
      </div>

      <div className="backup-command-bar">
        <button type="button" className={kindFilter === 'all' ? 'active' : ''} onClick={() => setKindFilter('all')}>All</button>
        <button type="button" className={kindFilter === 'lxc' ? 'active' : ''} onClick={() => setKindFilter('lxc')}>LXC</button>
        <button type="button" className={kindFilter === 'vm' ? 'active' : ''} onClick={() => setKindFilter('vm')}>VM</button>
        <button type="button" className={kindFilter === 'host' ? 'active' : ''} onClick={() => setKindFilter('host')}>Host</button>
        <select value={hostFilter} onChange={event => setHostFilter(event.target.value)}>
          <option value="all">All hosts</option>
          {hosts.map(host => <option key={host} value={host}>{host}</option>)}
        </select>
        <input value={query} onChange={event => setQuery(event.target.value)} placeholder="Search backups" />
        <span>{lastTick}</span>
      </div>

      <div className="backup-manager-summary">
        <section>
          <b>{payload?.backup_inventory?.backup_count ?? '--'}</b>
          <span>Backups</span>
        </section>
        <section>
          <b>{payload?.catalog?.pack_count ?? '--'}</b>
          <span>Google Packs</span>
        </section>
        <section>
          <b>{fmtBytes(payload?.data_root?.available_bytes)}</b>
          <span>/Data Free</span>
        </section>
        <section>
          <b>{fmtBytes(payload?.vault_root?.available_bytes)}</b>
          <span>/Vault Free</span>
        </section>
        <section>
          <b>{openGates.length}</b>
          <span>Open Gates</span>
        </section>
      </div>

      <div className="backup-manager-workspace">
        <section className="backup-browser">
          <div className="backup-section-head">
            <h3>Protected Systems</h3>
            <StatusChip state={filteredLineages.length ? 'ok' : 'degraded'} label={`${filteredLineages.length} shown`} />
          </div>
          <div className="backup-table">
            {filteredLineages.map(lineage => {
              return (
                <button
                  key={lineage.key}
                  type="button"
                  className={lineage.key === selectedLineage?.key ? 'selected' : ''}
                  onClick={() => {
                    setSelectedLineageKey(lineage.key);
                    setSelectedId(`${lineage.versions[0].host}/${lineage.versions[0].backup_id}`);
                  }}
                >
                  <span>{lineage.host}</span>
                  <b>{lineage.label}</b>
                  <span>{lineage.kind}</span>
                  <span>{lineage.guestId || '--'}</span>
                  <span>{lineage.versions.length} versions</span>
                  <span>{fmtBytes(lineage.latest.source_artifact_size_bytes)}</span>
                </button>
              );
            })}
            {!filteredLineages.length && <p className="backup-empty">No VMs or LXCs match the current filter.</p>}
          </div>
        </section>

        <section className="backup-detail">
          <div className="backup-section-head">
            <h3>{selected ? backupLabel(selected) : 'Select Backup'}</h3>
            <StatusChip state={selected?.restore_supported ? 'ok' : 'degraded'} label={selected?.restore_supported ? 'restorable' : 'metadata'} />
          </div>
          <div className="backup-detail-grid">
            <MetricRow label="host" value={selected?.host || '--'} />
            <MetricRow label="backup id" value={short(selected?.backup_id, '--', 42)} />
            <MetricRow label="type" value={selected?.artifact_type || '--'} />
            <MetricRow label="guest id" value={selected?.guest_identity?.guest_id || '--'} />
            <MetricRow label="lineage" value={short(selected?.lineage_key || selected?.guest_identity?.lineage_key, '--', 42)} />
            <MetricRow label="size" value={fmtBytes(selected?.source_artifact_size_bytes)} />
            <MetricRow label="chunks" value={selected?.chunk_count ?? '--'} />
            <MetricRow label="domain" value={selected?.dedupe_domain || '--'} />
          </div>
          <div className="backup-version-list">
            <div className="backup-section-head">
              <h4>Versions</h4>
              <StatusChip state={selectedLineage?.versions.length ? 'ok' : 'degraded'} label={`${selectedLineage?.versions.length || 0}`} />
            </div>
            {(selectedLineage?.versions || []).map(version => {
              const key = `${version.host}/${version.backup_id}`;
              return (
                <button key={key} type="button" className={key === `${selected?.host}/${selected?.backup_id}` ? 'selected' : ''} onClick={() => setSelectedId(key)}>
                  <b>{backupVersionLabel(version)}</b>
                  <span>{short(version.backup_id, '--', 56)}</span>
                </button>
              );
            })}
          </div>
          <div className="backup-custody-path">
            {(payload?.custody_chain || []).map(stage => <span key={stage}>{stage}</span>)}
          </div>
        </section>

        <section className="backup-restore">
          <div className="backup-section-head">
            <h3>Restore</h3>
            <StatusChip state={payload?.restore?.apply_guest_available ? 'ok' : 'degraded'} label={payload?.restore?.operator_start_from_proxmox_ui ? 'manual start' : 'gated'} />
          </div>
          <div className="backup-restore-form">
            <label>
              <span>Run On Host</span>
              <select value={restoreDraft.targetHost} onChange={event => setRestoreDraft({ ...restoreDraft, targetHost: event.target.value })}>
                <option value="PVE3">PVE3</option>
                <option value="PVE">PVE</option>
              </select>
            </label>
            <label>
              <span>New ID</span>
              <input value={restoreDraft.targetId} onChange={event => setRestoreDraft({ ...restoreDraft, targetId: event.target.value })} placeholder="e.g. 913" />
            </label>
            <label>
              <span>Name</span>
              <input value={restoreDraft.targetName} onChange={event => setRestoreDraft({ ...restoreDraft, targetName: event.target.value })} placeholder="optional" />
            </label>
            <label>
              <span>Storage</span>
              <input value={restoreDraft.targetStorage} onChange={event => setRestoreDraft({ ...restoreDraft, targetStorage: event.target.value })} placeholder="local" />
            </label>
            <label>
              <span>Stage Root</span>
              <input value={restoreDraft.stageRoot} onChange={event => setRestoreDraft({ ...restoreDraft, stageRoot: event.target.value })} />
            </label>
            <label>
              <span>Target Root</span>
              <input value={restoreDraft.targetRoot} onChange={event => setRestoreDraft({ ...restoreDraft, targetRoot: event.target.value })} />
            </label>
          </div>
          <div className="backup-restore-command">
            <code>{restoreCommand || 'select a backup'}</code>
          </div>
          <div className="backup-action-row">
            <button type="button" disabled={!selected?.restore_supported || !!actionBusy} onClick={() => runBackupAction('stage')}>{actionBusy === 'stage' ? 'Staging' : 'Stage'}</button>
            <button type="button" disabled={!selected?.restore_apply_guest_supported || !restoreDraft.targetId || !!actionBusy} onClick={() => runBackupAction('apply_guest')}>{actionBusy === 'apply_guest' ? 'Applying' : 'Apply Stopped'}</button>
            <button type="button" onClick={() => onOpen('concierge_proxmox_backup')}>Evidence</button>
          </div>
          {actionResult && <pre className="backup-action-result">{actionResult}</pre>}
        </section>

        <section className="backup-scheduler">
          <div className="backup-section-head">
            <h3>Schedules</h3>
            <StatusChip state={scheduleSource?.ok ? 'ok' : 'degraded'} label={saving ? 'saving' : `${schedules.length}`} />
          </div>
          <div className="backup-schedule-form">
            <label><span>Enabled</span><input type="checkbox" checked={draft.enabled} onChange={event => setDraft({ ...draft, enabled: event.target.checked })} /></label>
            <label><span>Host</span><select value={draft.host} onChange={event => setDraft({ ...draft, host: event.target.value })}><option>PVE3</option><option>PVE</option><option>ALL</option></select></label>
            <label><span>Target</span><select value={draft.target_type} onChange={event => setDraft({ ...draft, target_type: event.target.value })}><option value="linux_lxc">Linux LXC</option><option value="host_config">Host Config</option><option value="linux_vm">Linux VM</option><option value="windows_vm">Windows VM</option></select></label>
            <label><span>IDs</span><input value={draft.target_ids} onChange={event => setDraft({ ...draft, target_ids: event.target.value })} placeholder="blank = all" /></label>
            <label><span>Cadence</span><select value={draft.cadence} onChange={event => setDraft({ ...draft, cadence: event.target.value })}><option>daily</option><option>weekly</option><option>manual</option></select></label>
            <label><span>Time</span><input type="time" value={draft.local_time} onChange={event => setDraft({ ...draft, local_time: event.target.value })} /></label>
            <label><span>Keep</span><input type="number" min="1" max="90" value={draft.retention_keep_last} onChange={event => setDraft({ ...draft, retention_keep_last: Number(event.target.value) })} /></label>
            <button type="button" onClick={() => saveSchedule()} disabled={saving}>{saving ? 'Saving' : 'Save'}</button>
          </div>
          <div className="backup-schedule-list">
            {schedules.map(item => (
              <button key={item.schedule_id} type="button" onClick={() => setDraft(item)}>
                <StatusChip state={item.enabled ? 'ok' : 'degraded'} label={item.enabled ? 'on' : 'off'} />
                <b>{item.schedule_id}</b>
                <span>{item.host} {item.target_type} {item.local_time}</span>
              </button>
            ))}
          </div>
          <div className="backup-maintenance-actions">
            <button type="button" disabled={!!actionBusy} onClick={() => runBackupAction('scrub_packs')}>{actionBusy === 'scrub_packs' ? 'Scrubbing' : 'Scrub Packs'}</button>
            <button type="button" disabled={!!actionBusy} onClick={() => runBackupAction('restore_drill')}>{actionBusy === 'restore_drill' ? 'Drilling' : 'Restore Drill'}</button>
            <button type="button" disabled={!!actionBusy} onClick={() => runBackupAction('retention_plan')}>{actionBusy === 'retention_plan' ? 'Planning' : 'Retention Plan'}</button>
            <button type="button" disabled={!!actionBusy} onClick={() => runBackupAction('gc_plan')}>{actionBusy === 'gc_plan' ? 'Planning' : 'GC Plan'}</button>
          </div>
        </section>
      </div>
      {error && <p className="backup-error">{error}</p>}
    </section>
  );
}
