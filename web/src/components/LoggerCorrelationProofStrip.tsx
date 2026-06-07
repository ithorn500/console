interface LoggerCorrelationProofStripProps {
  title: string;
  context: string;
  onOpen: (target: string) => void;
}

export function LoggerCorrelationProofStrip({ title, context, onOpen }: LoggerCorrelationProofStripProps) {
  return (
    <div className="logger-correlation-strip">
      <button type="button" onClick={() => onOpen('logger_correlation_query')}>
        <span className="router-chip ok">logger.correlation.query</span>
        <strong>{title}</strong>
        <small>{context}</small>
      </button>
      <button type="button" onClick={() => onOpen('logger_correlation_query')}>
        <span>data plane</span>
        <strong>Amber Bus</strong>
        <small>Shared source detail opens the live query and its interface id.</small>
      </button>
      <button type="button" onClick={() => onOpen('logger_evidence_proof')}>
        <span>proof level</span>
        <strong>evidence proof</strong>
        <small>Programme proof is live; per-request depth still depends on emitted correlation IDs.</small>
      </button>
    </div>
  );
}
