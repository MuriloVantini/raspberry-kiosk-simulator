import { Zap } from "lucide-react";

export function Logo({ compact = false }: { compact?: boolean }) {
  return (
    <div className={`brand-logo ${compact ? "brand-logo--compact" : ""}`} aria-label="Mobile2Screen">
      <span className="brand-logo__mark"><Zap aria-hidden="true" /></span>
      <span>mobile<span>2</span>screen</span>
    </div>
  );
}
