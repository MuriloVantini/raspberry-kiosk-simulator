export type AlertSoundType = "info" | "warning" | "critical" | "success";

interface Tone {
  frequency: number;
  offset: number;
  duration: number;
  volume: number;
  wave: OscillatorType;
}

const patterns: Record<AlertSoundType, Tone[]> = {
  info: [
    { frequency: 659.25, offset: 0, duration: 0.18, volume: 0.12, wave: "sine" },
    { frequency: 880, offset: 0.2, duration: 0.28, volume: 0.14, wave: "sine" },
  ],
  warning: [
    { frequency: 440, offset: 0, duration: 0.24, volume: 0.18, wave: "triangle" },
    { frequency: 440, offset: 0.36, duration: 0.24, volume: 0.18, wave: "triangle" },
  ],
  critical: [
    { frequency: 220, offset: 0, duration: 0.18, volume: 0.2, wave: "sawtooth" },
    { frequency: 164.81, offset: 0.22, duration: 0.18, volume: 0.2, wave: "sawtooth" },
    { frequency: 220, offset: 0.44, duration: 0.18, volume: 0.2, wave: "sawtooth" },
    { frequency: 164.81, offset: 0.66, duration: 0.3, volume: 0.2, wave: "sawtooth" },
  ],
  success: [
    { frequency: 523.25, offset: 0, duration: 0.16, volume: 0.12, wave: "sine" },
    { frequency: 659.25, offset: 0.16, duration: 0.16, volume: 0.13, wave: "sine" },
    { frequency: 783.99, offset: 0.32, duration: 0.34, volume: 0.15, wave: "sine" },
  ],
};

function normalizeType(type?: string): AlertSoundType {
  return type === "warning" || type === "critical" || type === "success" ? type : "info";
}

export function playAlertSound(type?: string): () => void {
  if (typeof AudioContext === "undefined") return () => undefined;

  const context = new AudioContext();
  const oscillators: OscillatorNode[] = [];
  let closeTimer: number | undefined;
  let stopped = false;

  const closeContext = () => {
    if (context.state !== "closed") void context.close().catch(() => undefined);
  };

  const start = async () => {
    try {
      if (context.state === "suspended") await context.resume();
      if (stopped || context.state !== "running") return;

      const tones = patterns[normalizeType(type)];
      const startAt = context.currentTime + 0.04;

      tones.forEach((tone) => {
        const oscillator = context.createOscillator();
        const gain = context.createGain();
        const toneStart = startAt + tone.offset;
        const toneEnd = toneStart + tone.duration;

        oscillator.type = tone.wave;
        oscillator.frequency.setValueAtTime(tone.frequency, toneStart);
        gain.gain.setValueAtTime(0.0001, toneStart);
        gain.gain.exponentialRampToValueAtTime(tone.volume, toneStart + 0.025);
        gain.gain.setValueAtTime(tone.volume, Math.max(toneStart + 0.025, toneEnd - 0.06));
        gain.gain.exponentialRampToValueAtTime(0.0001, toneEnd);

        oscillator.connect(gain);
        gain.connect(context.destination);
        oscillator.start(toneStart);
        oscillator.stop(toneEnd);
        oscillators.push(oscillator);
      });

      const patternDuration = Math.max(...tones.map((tone) => tone.offset + tone.duration));
      closeTimer = window.setTimeout(closeContext, (patternDuration + 0.3) * 1000);
    } catch {
      closeContext();
    }
  };

  void start();

  return () => {
    stopped = true;
    if (closeTimer !== undefined) window.clearTimeout(closeTimer);
    oscillators.forEach((oscillator) => {
      try { oscillator.stop(); } catch { /* o oscilador já terminou */ }
    });
    closeContext();
  };
}
