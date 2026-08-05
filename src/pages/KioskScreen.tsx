import { useEffect, useRef, useState } from "react";
import { CheckCircle2, MonitorUp, ShieldCheck, Smartphone } from "lucide-react";
import { AnimatedLogo } from "../components/AnimatedLogo";
import { useTvEntranceAnimation } from "../hooks/useTvEntranceAnimation";
import { completeAlert } from "../lib/api";
import type { ConnectionState, Delivery } from "../types";

function formatClock(date: Date) {
  return new Intl.DateTimeFormat("pt-BR", { dateStyle: "full", timeStyle: "medium" }).format(date);
}

export function KioskScreen() {
  const [connection, setConnection] = useState<ConnectionState>({ connected: false });
  const [delivery, setDelivery] = useState<Delivery | null>(null);
  const [clock, setClock] = useState(() => new Date());
  const [qrVersion, setQrVersion] = useState(0);
  const homeMotionRef = useRef<HTMLElement>(null);

  useTvEntranceAnimation(homeMotionRef, [connection.connected, Boolean(delivery)]);

  useEffect(() => {
    const timer = window.setInterval(() => setClock(new Date()), 1000);
    const events = new EventSource("/events");
    events.addEventListener("connection", (event) => setConnection(JSON.parse((event as MessageEvent).data)));
    events.addEventListener("paired", (event) => {
      const payload = JSON.parse((event as MessageEvent).data);
      setConnection((current) => ({ ...current, connected: true, device: payload.device }));
    });
    events.addEventListener("pairing", () => setQrVersion(Date.now()));
    events.addEventListener("alert", (event) => setDelivery(JSON.parse((event as MessageEvent).data)));
    return () => { window.clearInterval(timer); events.close(); };
  }, []);

  useEffect(() => {
    if (!delivery) return;
    const duration = Number(delivery.alert?.duration_seconds) || 10;
    const timer = window.setTimeout(async () => {
      await completeAlert().catch(() => undefined);
      setDelivery(null);
    }, duration * 1000);
    return () => window.clearTimeout(timer);
  }, [delivery]);

  if (delivery) {
    const alert = delivery.alert || {};
    return (
      <main className={`kiosk-alert kiosk-alert--${alert.type || "info"}`}>
        <div className="kiosk-alert__logo">
          <AnimatedLogo isDarkMode compact />
        </div>
        <div className="kiosk-alert__content"><span data-tv-motion>{alert.type || "informação"}</span>
          <h1 data-tv-motion>{alert.title || "Novo alerta"}
          </h1><p data-tv-motion>{alert.message}</p>
        </div>
        <div className="kiosk-alert__duration" data-tv-motion>
          Exibindo por {Number(alert.duration_seconds) || 10} segundos
        </div>
      </main>
    );
  }

  return (
    <main ref={homeMotionRef} className="kiosk-home">
      <header className="kiosk-header">
        <AnimatedLogo isDarkMode />
        <div className={`connection-pill ${connection.connected ? "online" : ""}`} data-tv-motion>
          <span />{connection.connected ? "Tela online" : "Aguardando conexão"}
        </div>
      </header>
      <section className="kiosk-content">
        {connection.connected ? (
          <div className="connected-panel">
            <span className="connected-panel__icon" data-tv-motion>
              <CheckCircle2 />
            </span>
            <p className="eyebrow" data-tv-motion>Pareamento concluído</p>
            <h1 data-tv-motion>
              {connection.device?.name || "TV conectada"}
            </h1>
            <p data-tv-motion>Esta tela está pronta para receber alertas do Mobile2Screen.</p>
            <div className="connected-panel__meta" data-tv-motion>
              <ShieldCheck />
              Conexão autenticada e monitorada
            </div>
          </div>
        ) : (
          <div className="pairing-layout">
            <div className="pairing-copy">
              <span className="eyebrow" data-tv-motion>
                <MonitorUp /> Configuração da tela
              </span>
              <h1 data-tv-motion>Conecte esta tela ao Mobile2Screen</h1>
              <p data-tv-motion>Use o celular para entrar na sua conta e selecionar o dispositivo correspondente a esta TV.</p>
              <ol data-tv-motion>
                <li>
                  <span>1</span>
                  Aponte a câmera para o QR Code
                </li>
                <li>
                  <span>2</span>Faça login com sua conta
                </li>
                <li>
                  <span>3</span>Escolha o dispositivo conectado
                </li>
              </ol>
            </div>
            <div className="qr-card" data-tv-motion><div className="qr-card__header">
              <Smartphone /><div>
                <strong>Escaneie para conectar</strong>
                <span>Abra com a câmera do celular</span>
              </div>
            </div>
              <div className="qr-card__image">
                <img src={`/pairing-qr.svg?v=${qrVersion}`} alt="QR Code para conectar esta tela" />
              </div>
              <div className="qr-card__secure">
                <ShieldCheck />
                Código seguro e temporário
              </div>
            </div>
          </div>
        )}
      </section>
      <footer className="kiosk-footer"><span>{formatClock(clock)}</span>
        <span>Mobile2Screen Kiosk</span>
      </footer>
    </main>
  );
}
