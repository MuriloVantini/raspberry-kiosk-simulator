import { useEffect, type RefObject } from "react";
import { animate, stagger } from "animejs";

export function useTvEntranceAnimation(containerRef: RefObject<HTMLElement | null>, dependencies: unknown[] = []) {
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const elements = container.querySelectorAll<HTMLElement>("[data-tv-motion]");

    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      elements.forEach((element) => { element.style.opacity = "1"; element.style.transform = "none"; });
      return;
    }

    animate(elements, {
      opacity: [0, 1],
      translateY: [28, 0],
      scale: [.985, 1],
      duration: 850,
      delay: stagger(95),
      ease: "outExpo",
    });
  }, dependencies);
}
