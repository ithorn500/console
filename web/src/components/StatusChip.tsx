import type { SourceState } from '../types';

interface StatusChipProps {
  state: SourceState;
  label?: string;
}

export function StatusChip({ state, label }: StatusChipProps) {
  const className = state === 'ok' ? 'ok' : state === 'unavailable' ? 'unavailable' : 'degraded';
  return <span className={`state ${className}`}>{label || state}</span>;
}
