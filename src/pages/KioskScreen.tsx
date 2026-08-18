import { useEffect, useRef, useState } from "react";
import { CheckCircle2, MonitorUp, ShieldCheck, Smartphone } from "lucide-react";
import { AnimatedLogo } from "../components/AnimatedLogo";
import { useTvEntranceAnimation } from "../hooks/useTvEntranceAnimation";
import { completeAlert } from "../lib/api";
import { playAlertSound } from "../lib/alertSound";
import type { ConnectionState, Delivery } from "../types";

function formatClock(date: Date) {
  return new Intl.DateTimeFormat("pt-BR", { dateStyle: "full", timeStyle: "medium" }).format(date);
}

function textLengthModifier(value: string, longAt: number, veryLongAt: number) {
  const length = value.trim().length;

  if (length >= veryLongAt) return "text-fit--very-long";
  if (length >= longAt) return "text-fit--long";
  return "";
}

function ProfileBrand({ connection, alert = false, profileOnly = false }: { connection: ConnectionState; alert?: boolean; profileOnly?: boolean }) {
  const profileName = connection.device?.profile_name || "Usuário Mobile2Screen";
  const initials = profileName.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]).join("").toUpperCase() || "US";

  return (
    <div className={alert ? "kiosk-alert__brand" : `kiosk-brand${profileOnly ? " kiosk-brand--profile-only" : ""}`} data-tv-motion>
      {!profileOnly && <AnimatedLogo isDarkMode compact={alert} />}
      <div className="kiosk-profile-image" title={profileName}>
        {connection.device?.profile_image_url
          ? <img src={`/profile-image?v=${encodeURIComponent(connection.device.profile_image_url)}`} alt={`Foto de ${profileName}`} />
          : <span aria-label={`Iniciais de ${profileName}`}>{initials}</span>}
      </div>
    </div>
  );
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
    const stopSound = playAlertSound(delivery.alert?.type);
    const duration = Number(delivery.alert?.duration_seconds) || 10;
    const timer = window.setTimeout(async () => {
      await completeAlert().catch(() => undefined);
      setDelivery(null);
    }, duration * 1000);
    return () => {
      window.clearTimeout(timer);
      stopSound();
    };
  }, [delivery]);

  if (delivery) {
    const alert = delivery.alert || {};
    const title = alert.title || "Novo alerta";
    const message = alert.message || "";
    return (
      <main ref={homeMotionRef} className={`kiosk-alert kiosk-alert--${alert.type || "info"}`}>
        <ProfileBrand connection={connection} alert />
        <div className="kiosk-alert__content"><span data-tv-motion>{alert.type || "informação"}</span>
          <h1 className={textLengthModifier(title, 42, 80)} data-tv-motion>{title}</h1>
          {message && <p className={textLengthModifier(message, 180, 320)} data-tv-motion>{message}</p>}
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
        <ProfileBrand connection={connection} profileOnly />
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
            <h1
              className={textLengthModifier(connection.device?.name || "TV conectada", 28, 52)}
              data-tv-motion
            >
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
