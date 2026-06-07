interface MetricRowProps {
  label: string;
  value: string | number;
}

export function MetricRow({ label, value }: MetricRowProps) {
  return (
    <div className="metric-row">
      <span>{label}</span>
      <b>{value}</b>
    </div>
  );
}
