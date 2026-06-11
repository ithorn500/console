import { useEffect, useMemo, useState } from 'react';
import { fetchSource, postSourceAction } from '../api/consoleApi';
import type { SourceDetail } from '../types';

interface IdentityCustodyPanelProps {
  onOpen: (target: string) => void;
}

type CustodyRow = Record<string, string | number | boolean | null | undefined>;

interface IdentityCustodyStatus {
  ok?: boolean;
  photo_count?: number;
  photo_package_count?: number;
  photo_package_backlog?: number;
  thumbnail_blob_count?: number;
  thumbnail_blob_backlog?: number;
  face_crop_blob_count?: number;
  face_crop_blob_backlog_estimate?: number;
  photo_face_observation_count?: number;
  photo_face_identity_count?: number;
  photo_subject_identity_count?: number;
  person_face_embedding_count?: number;
  person_face_embedding_binary_count?: number;
  binary_embedding_backlog?: number;
  ignored_face_count?: number;
  pending_learning_payload_files?: number;
  learning_publish_count?: number;
  learning_publish_ok_count?: number;
  failed_descriptor_count?: number;
  replay_count?: number;
  replay_publish_count?: number;
  face_queue_status_counts?: Record<string, number>;
  scene_queue_status_counts?: Record<string, number>;
  memorr_to_veliai_ring?: {
    lifecycle_state?: string;
    write_seq?: number;
    read_seq?: number;
    queued_depth?: number;
    last_consumed_seq?: number;
    dropped_full_count?: number;
    stale_frame_count?: number;
    checksum_error_count?: number;
  };
  last_publish?: CustodyRow;
  last_replay?: CustodyRow;
  last_backfill?: CustodyRow;
  failed_descriptor_samples?: CustodyRow[];
  warnings?: string[];
}

function value(input: unknown, fallback: string | number = '--') {
  if (input === null || input === undefined || input === '') return fallback;
  return input as string | number;
}

function short(input: unknown, fallback = '-') {
  const text = String(value(input, fallback));
  return text.length > 80 ? `${text.slice(0, 77)}...` : text;
}

function statusTone(count: unknown) {
  const n = Number(count ?? 0);
  if (Number.isNaN(n) || n === 0) return 'ok';
  if (n < 100) return 'warn';
  return 'hot';
}

export function IdentityCustodyPanel({ onOpen }: IdentityCustodyPanelProps) {
  const [source, setSource] = useState<SourceDetail<IdentityCustodyStatus> | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [actionState, setActionState] = useState<string>('idle');

  async function load() {
    try {
      const next = await fetchSource<IdentityCustodyStatus>('memorr_identity_custody', { loggerEvidence: false });
      setSource(next);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }

  useEffect(() => {
    let cancelled = false;
    async function tick() {
      if (cancelled) return;
      await load();
    }
    tick().catch(() => undefined);
    const timer = window.setInterval(() => tick().catch(() => undefined), 15000);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, []);

  async function runAction(target: 'memorr_identity_custody_replay' | 'memorr_identity_custody_backfill') {
    setActionState(target === 'memorr_identity_custody_replay' ? 'replaying' : 'backfilling');
    try {
      await postSourceAction(target, { limit: 256 });
      await load();
      setActionState('idle');
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setActionState('idle');
    }
  }

  const payload = source?.payload;
  const ring = payload?.memorr_to_veliai_ring || {};
  const warnings = payload?.warnings || [];
  const failed = payload?.failed_descriptor_samples || [];
  const faceStatus = payload?.face_queue_status_counts || {};
  const sceneStatus = payload?.scene_queue_status_counts || {};
  const headline = useMemo(() => [
    ['Photos', payload?.photo_count],
    ['Faces', payload?.photo_face_identity_count],
    ['Embeddings', payload?.person_face_embedding_count],
    ['Binary vectors', payload?.person_face_embedding_binary_count],
    ['Pending learn', payload?.pending_learning_payload_files],
    ['Ring depth', ring.queued_depth]
  ], [payload, ring.queued_depth]);

  return (
    <article className="ops-panel identity-custody-panel">
      <div className="ops-title">
        <div>
          <p className="eyebrow">Memorr</p>
          <h2>Identity Custody</h2>
        </div>
        <div className="identity-custody-actions">
          <span className={`live-pill ${source?.ok && payload?.ok ? 'ok' : 'warn'}`}>
            {source?.ok && payload?.ok ? 'live' : 'review'}
          </span>
          <button type="button" onClick={() => onOpen('memorr_identity_custody')}>Evidence</button>
          <button
            type="button"
            disabled={actionState !== 'idle'}
            onClick={() => runAction('memorr_identity_custody_replay').catch(() => undefined)}
          >
            Replay
          </button>
          <button
            type="button"
            disabled={actionState !== 'idle'}
            onClick={() => runAction('memorr_identity_custody_backfill').catch(() => undefined)}
          >
            Backfill
          </button>
        </div>
      </div>

      <div className="identity-custody-headline">
        {headline.map(([label, metric]) => (
          <button key={label} type="button" onClick={() => onOpen('memorr_identity_custody')}>
            <strong>{value(metric)}</strong>
            <span>{label}</span>
          </button>
        ))}
      </div>

      <div className="identity-custody-grid">
        <section>
          <h3>Package Coverage</h3>
          <dl>
            <div><dt>Packages</dt><dd>{value(payload?.photo_package_count)}</dd></div>
            <div><dt>Package backlog</dt><dd>{value(payload?.photo_package_backlog)}</dd></div>
            <div><dt>Thumbnails</dt><dd>{value(payload?.thumbnail_blob_count)}</dd></div>
            <div><dt>Face crops</dt><dd>{value(payload?.face_crop_blob_count)}</dd></div>
          </dl>
        </section>

        <section>
          <h3>Learning</h3>
          <dl>
            <div><dt>Published</dt><dd>{value(payload?.learning_publish_count)}</dd></div>
            <div><dt>Published ok</dt><dd>{value(payload?.learning_publish_ok_count)}</dd></div>
            <div><dt>Failed</dt><dd>{value(payload?.failed_descriptor_count)}</dd></div>
            <div><dt>Replays</dt><dd>{value(payload?.replay_count)}</dd></div>
          </dl>
        </section>

        <section>
          <h3>NeoFAB</h3>
          <dl>
            <div><dt>Ring</dt><dd>{short(ring.lifecycle_state)}</dd></div>
            <div><dt>Write seq</dt><dd>{value(ring.write_seq)}</dd></div>
            <div><dt>Read seq</dt><dd>{value(ring.read_seq)}</dd></div>
            <div><dt>Last consumed</dt><dd>{value(ring.last_consumed_seq)}</dd></div>
          </dl>
        </section>
      </div>

      <div className="identity-custody-status-strip">
        <button className={statusTone(payload?.binary_embedding_backlog)} type="button" onClick={() => onOpen('memorr_identity_custody')}>
          <strong>{value(payload?.binary_embedding_backlog)}</strong>
          <span>vector backlog</span>
        </button>
        <button className={statusTone(payload?.face_crop_blob_backlog_estimate)} type="button" onClick={() => onOpen('memorr_identity_custody')}>
          <strong>{value(payload?.face_crop_blob_backlog_estimate)}</strong>
          <span>crop backlog</span>
        </button>
        <button className={statusTone(payload?.failed_descriptor_count)} type="button" onClick={() => onOpen('memorr_identity_custody')}>
          <strong>{value(payload?.failed_descriptor_count)}</strong>
          <span>failed descriptors</span>
        </button>
        <button className={statusTone(ring.queued_depth)} type="button" onClick={() => onOpen('memorr_identity_custody')}>
          <strong>{value(ring.queued_depth)}</strong>
          <span>ring lag</span>
        </button>
      </div>

      <div className="identity-custody-ledger">
        <section>
          <h3>Queues</h3>
          <p>Face: {Object.entries(faceStatus).map(([key, count]) => `${key} ${count}`).join(' · ') || '-'}</p>
          <p>Scene: {Object.entries(sceneStatus).map(([key, count]) => `${key} ${count}`).join(' · ') || '-'}</p>
        </section>
        <section>
          <h3>Latest</h3>
          <p>Publish: {short(payload?.last_publish?.publish_ref || payload?.last_publish?._key)}</p>
          <p>Replay: {short(payload?.last_replay?.replay_ref || payload?.last_replay?._key)}</p>
          <p>Backfill: {short(payload?.last_backfill?.backfill_ref || payload?.last_backfill?._key)}</p>
        </section>
      </div>

      {(warnings.length > 0 || failed.length > 0 || error || actionState !== 'idle') && (
        <div className="identity-custody-warning-strip">
          {error && <span className="hot">source {error}</span>}
          {actionState !== 'idle' && <span>{actionState}</span>}
          {warnings.map(item => <span key={item}>{item}</span>)}
          {failed.slice(0, 3).map(row => (
            <span key={String(row.publish_ref || row._key)} className="hot">{short(row.face_ref)} failed</span>
          ))}
        </div>
      )}
    </article>
  );
}
