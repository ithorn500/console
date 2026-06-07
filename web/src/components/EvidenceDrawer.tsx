import { useState } from 'react';
import type { SourceDetail } from '../types';

interface EvidenceDrawerProps {
  detail: SourceDetail | null;
  loadingTarget: string | null;
  error: string | null;
  onClose: () => void;
}

export function EvidenceDrawer({ detail, loadingTarget, error, onClose }: EvidenceDrawerProps) {
  const open = Boolean(detail || loadingTarget || error);
  const [showRaw, setShowRaw] = useState(false);
  const payload = detail?.payload as Record<string, unknown> | string | undefined;
  const loggerProof = detail?.logger_call_evidence;
  return (
    <aside className={`drawer ${open ? 'open' : ''}`} aria-hidden={!open}>
      <div className="drawer-head">
        <div>
          <p className="eyebrow">Owner Detail</p>
          <h2>{detail?.label || loadingTarget || 'Source'}</h2>
        </div>
        <button type="button" onClick={onClose}>Close</button>
      </div>
      {error && <div className="drawer-card danger">{error}</div>}
      {!error && !detail && <div className="drawer-card">loading...</div>}
      {detail && !error && (
        <>
          <div className="drawer-card">
            <div className="metric-row"><span>Owner</span><b>{detail.owner}</b></div>
            <div className="metric-row"><span>HTTP</span><b>{detail.http_status}</b></div>
            <div className="metric-row"><span>Latency</span><b>{detail.duration_ms}ms</b></div>
            <div className="metric-row"><span>Schema</span><b>{typeof payload === 'object' && payload ? String(payload.schema || 'owner payload') : 'text payload'}</b></div>
          </div>
          {loggerProof && (
            <div className={`drawer-card ${loggerProof.ok ? '' : 'danger'}`}>
              <div className="metric-row"><span>Logger</span><b>{loggerProof.ok ? 'receipt live' : 'receipt pending'}</b></div>
              <div className="metric-row"><span>Ingest</span><b>{loggerProof.ingest_http_status} / {loggerProof.ingest_stored_count}</b></div>
              <div className="metric-row"><span>Proof</span><b>{loggerProof.proof_gate_status || loggerProof.proof_http_status}</b></div>
              <div className="metric-row"><span>Request</span><b>{loggerProof.proof_request_seen ? 'seen' : 'not seen'}</b></div>
            </div>
          )}
          <button type="button" onClick={() => setShowRaw(value => !value)}>
            {showRaw ? 'Hide Raw Evidence' : 'Show Raw Evidence'}
          </button>
          {showRaw && <pre>{JSON.stringify(detail, null, 2)}</pre>}
        </>
      )}
    </aside>
  );
}
