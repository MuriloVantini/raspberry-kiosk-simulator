import type { InputHTMLAttributes, ReactNode } from "react";

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  leadingIcon?: ReactNode;
  trailingAction?: ReactNode;
}

export function Input({ leadingIcon, trailingAction, className = "", ...props }: InputProps) {
  return (
    <div className={`ui-input-shell ${className}`}>
      {leadingIcon && <span className="ui-input-icon">{leadingIcon}</span>}
      <input className="ui-input" {...props} />
      {trailingAction && <span className="ui-input-action">{trailingAction}</span>}
    </div>
  );
}
