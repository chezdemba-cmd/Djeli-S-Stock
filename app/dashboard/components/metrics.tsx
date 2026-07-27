import { LucideIcon } from "lucide-react";

export function Metric({ icon: Icon, tone, label, value, detail }: { icon: LucideIcon; tone: string; label: string; value: string; detail: string }) {
  return (
    <article className="metric">
      <div className={`metric-icon ${tone}`}>
        <Icon />
      </div>
      <div>
        <span>{label}</span>
        <strong>{value}</strong>
        <small>{detail}</small>
      </div>
    </article>
  );
}
