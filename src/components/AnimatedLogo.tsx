import { useRef } from "react";
import { useDrawableAnimation } from "../hooks/useDrawableAnimation";
import LogoDarkMarkup from "../assets/logoGrandeDarkMode.svg?raw";
import LogoLightMarkup from "../assets/logoGrandeLightMode.svg?raw";

const logoDarkInline = LogoDarkMarkup
  .replace(/<path /g, '<path vector-effect="non-scaling-stroke" ')
  .replace("<svg ", '<svg class="w-full h-auto" ');

const logoLightInline = LogoLightMarkup
  .replace(/<path /g, '<path vector-effect="non-scaling-stroke" ')
  .replace("<svg ", '<svg class="w-full h-auto" ');

export function AnimatedLogo({ isDarkMode = true, compact = false }: { isDarkMode?: boolean; compact?: boolean }) {
  const logoRef = useRef<HTMLDivElement>(null);
  useDrawableAnimation(logoRef, {
    duration: 1200,
    staggerMs: 30,
    ease: "ease-out",
    deps: [isDarkMode],
  });

  return (
    <div className={`animated-logo ${compact ? "animated-logo--compact" : ""}`}>
      <div
        aria-label="Mobile2Screen"
        role="img"
        ref={logoRef}
        dangerouslySetInnerHTML={{ __html: isDarkMode ? logoDarkInline : logoLightInline }}
      />
    </div>
  );
}
