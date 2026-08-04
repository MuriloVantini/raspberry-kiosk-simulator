import { Moon, Sun } from "lucide-react";

export function ThemeToggle({ dark, onChange }: { dark: boolean; onChange: (dark: boolean) => void }) {
  return (
    <button className="theme-toggle" onClick={() => onChange(!dark)} aria-label="Alternar tema" type="button">
      <Sun className={!dark ? "active" : ""} />
      <span className={`theme-toggle__track ${dark ? "checked" : ""}`}><span /></span>
      <Moon className={dark ? "active" : ""} />
    </button>
  );
}
