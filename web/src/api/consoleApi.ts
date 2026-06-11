import type { ConsoleOverview, EvidenceChain, LoggerIncidentStreamProof, LoggerRequestProofDepth, MemoryConciergeFlow, SourceDetail } from '../types';

async function getJson<T>(url: string): Promise<T> {
  const response = await fetch(url, { cache: 'no-store' });
  if (!response.ok) {
    throw new Error(`${response.status} ${response.statusText}`);
  }
  return response.json() as Promise<T>;
}

async function postJson<T>(url: string, body: unknown): Promise<T> {
  const response = await fetch(url, {
    method: 'POST',
    cache: 'no-store',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });
  if (!response.ok) {
    throw new Error(`${response.status} ${response.statusText}`);
  }
  return response.json() as Promise<T>;
}

export function fetchOverview(): Promise<ConsoleOverview> {
  return getJson<ConsoleOverview>('/api/console/overview');
}

export function fetchEvidenceChain(): Promise<EvidenceChain> {
  return getJson<EvidenceChain>('/api/console/evidence-chain');
}

export function fetchSource<T = unknown>(target: string, options: { loggerEvidence?: boolean } = {}): Promise<SourceDetail<T>> {
  const params = new URLSearchParams({ target });
  if (options.loggerEvidence === false) params.set('logger_evidence', '0');
  return getJson<SourceDetail<T>>(`/api/console/source?${params.toString()}`);
}

export function postSourceAction<T = unknown>(target: string, body: unknown): Promise<SourceDetail<T>> {
  const params = new URLSearchParams({ target });
  return postJson<SourceDetail<T>>(`/api/console/source-action?${params.toString()}`, body);
}

export function fetchMemoryConciergeFlow(): Promise<MemoryConciergeFlow> {
  return getJson<MemoryConciergeFlow>('/api/console/memory-concierge-flow');
}

export function fetchLoggerIncidentStreamProof(): Promise<LoggerIncidentStreamProof> {
  return getJson<LoggerIncidentStreamProof>('/api/console/logger-incident-stream-proof');
}

export function fetchLoggerRequestProofDepth(): Promise<LoggerRequestProofDepth> {
  return getJson<LoggerRequestProofDepth>('/api/console/logger-request-proof-depth');
}
