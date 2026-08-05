import { useEffect, type RefObject } from "react";
import { animate, svg, stagger, splitText } from "animejs";

export interface UseDrawableAnimationOptions {
  selector?: string;
  textSelector?: string;
  duration?: number;
  staggerMs?: number;
  ease?: string;
  deps?: unknown[];
}

export function useDrawableAnimation(
  containerRef: RefObject<Element | null>,
  options: UseDrawableAnimationOptions = {},
) {
  const {
    selector = "path, rect, line, circle, polyline, polygon",
    textSelector,
    duration = 900,
    staggerMs = 150,
    ease = "inOutQuad",
    deps = [],
  } = options;

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    // Defer by one rAF so the browser computes SVG path geometry (getTotalLength)
    // before animejs reads it — paths injected via innerHTML may report length=0
    // synchronously, causing the animation to cut or snap midway.
    let rafId: number;
    rafId = requestAnimationFrame(() => {
      const paths = Array.from(container.querySelectorAll<SVGPathElement>(selector));

      if (paths.length) {
        const drawables = paths.map((path) => svg.createDrawable(path)[0]);
        animate(drawables, {
          draw: ["0 0", "0 1"],
          ease,
          duration,
          delay: stagger(staggerMs),
        });
      }

      if (textSelector) {
        const textElements = Array.from(container.querySelectorAll<HTMLElement>(textSelector));
        if (textElements.length) {
          const textDelay = paths.length > 0 ? duration * 0.4 : 0;
          const characters = textElements.flatMap((element) => splitText(element, { chars: true }).chars);
          animate(characters, {
            opacity: [0, 1],
            translateY: ["0.5em", 0],
            duration: 400,
            delay: (_: unknown, index: number) => textDelay + index * 80,
            ease,
          });
        }
      }
    });

    return () => cancelAnimationFrame(rafId);
  }, deps);
}
