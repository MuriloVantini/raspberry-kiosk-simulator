import type { LabelHTMLAttributes, ReactNode } from "react";

export function Label({ children, className = "", ...props }: LabelHTMLAttributes<HTMLLabelElement> & { children: ReactNode }) {
  return <label className={`ui-label ${className}`} {...props}>{children}</label>;
}
