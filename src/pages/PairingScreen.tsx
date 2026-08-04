import { useEffect, useMemo, useState, type FormEvent } from "react";
import { AlertCircle, CheckCircle2, Eye, EyeOff, Lock, Mail, MonitorSmartphone, Wifi } from "lucide-react";
import { Logo } from "../components/Logo";
import { ThemeToggle } from "../components/ThemeToggle";
import { Button } from "../components/ui/Button";
import { Input } from "../components/ui/Input";
import { Label } from "../components/ui/Label";
import { listDevices, login, selectDevice } from "../lib/api";
import type { Device } from "../types";

type Step = "login" | "device" | "success" | "expired";
const THEME_KEY = "m2s.theme";

export function PairingScreen() {
  const session = useMemo(() => new URLSearchParams(window.location.search).get("session") || "", []);
  const [step, setStep] = useState<Step>(session ? "login" : "expired");
  const [dark, setDark] = useState(() => localStorage.getItem(THEME_KEY) === "dark" || (!localStorage.getItem(THEME_KEY) && matchMedia("(prefers-color-scheme: dark)").matches));
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [userName, setUserName] = useState("");
  const [devices, setDevices] = useState<Device[]>([]);
  const [deviceId, setDeviceId] = useState("");
  const [connectedDevice, setConnectedDevice] = useState<Device | null>(null);

  useEffect(() => {
    document.documentElement.classList.toggle("dark", dark);
    localStorage.setItem(THEME_KEY, dark ? "dark" : "light");
  }, [dark]);

  async function handleLogin(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      const result = await login(session, email, password);
      const deviceResult = await listDevices(session);
      setUserName(result.user?.name || "usuário");
      setDevices(deviceResult.data);
      setStep("device");
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Não foi possível entrar.");
    } finally {
      setBusy(false);
    }
  }

  async function handleDevice(event: FormEvent) {
    event.preventDefault();
    if (!deviceId) return;
    setBusy(true);
    setError("");
    try {
      const result = await selectDevice(session, Number(deviceId));
      setConnectedDevice(result.data);
      setStep("success");
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Não foi possível conectar a tela.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="pair-page">
      <div className="ambient ambient--one" /><div className="ambient ambient--two" />
      <div className="pair-page__theme"><ThemeToggle dark={dark} onChange={setDark} /></div>
      <section className="pair-container">
        <div className="pair-logo"><Logo /></div>
        <div className="auth-card">
          <div className="auth-card__accent" />
          {step === "login" && (
            <form className="auth-card__body" onSubmit={handleLogin}>
              <div className="auth-heading"><span className="auth-heading__icon"><MonitorSmartphone /></span><div><h1>Conectar uma tela</h1><p>Entre com sua conta Mobile2Screen para continuar.</p></div></div>
              <div className="form-stack">
                <Label htmlFor="email">E-mail</Label>
                <Input id="email" type="email" value={email} onChange={(event) => setEmail(event.target.value)} autoComplete="email" placeholder="seu@email.com" leadingIcon={<Mail />} required />
              </div>
              <div className="form-stack">
                <Label htmlFor="password">Senha</Label>
                <Input id="password" type={showPassword ? "text" : "password"} value={password} onChange={(event) => setPassword(event.target.value)} autoComplete="current-password" placeholder="••••••••" leadingIcon={<Lock />} trailingAction={<button type="button" className="icon-button" onClick={() => setShowPassword((value) => !value)} aria-label="Mostrar senha">{showPassword ? <EyeOff /> : <Eye />}</button>} required />
              </div>
              <Button type="submit" loading={busy}>Entrar e escolher dispositivo</Button>
            </form>
          )}
          {step === "device" && (
            <form className="auth-card__body" onSubmit={handleDevice}>
              <div className="auth-heading"><span className="auth-heading__icon"><Wifi /></span><div><h1>Escolha o dispositivo</h1><p>Olá, {userName}. Onde esta tela está instalada?</p></div></div>
              <div className="form-stack">
                <Label htmlFor="device">Dispositivo conectado</Label>
                <select id="device" className="ui-select" value={deviceId} onChange={(event) => setDeviceId(event.target.value)} required>
                  <option value="">Selecione um dispositivo...</option>
                  {devices.map((device) => <option key={device.id} value={device.id}>{device.name}{device.location ? ` — ${device.location}` : ""} ({device.type || "dispositivo"})</option>)}
                </select>
                {devices.length === 0 && <p className="field-help">Nenhum dispositivo cadastrado nesta conta.</p>}
              </div>
              <Button type="submit" loading={busy} disabled={!deviceId}>Conectar nesta tela</Button>
            </form>
          )}
          {step === "success" && <div className="auth-card__body result-state"><CheckCircle2 className="result-state__success" /><h1>Tela conectada</h1><p><strong>{connectedDevice?.name}</strong> está pronto para receber alertas.</p><span>Você já pode fechar esta página.</span></div>}
          {step === "expired" && <div className="auth-card__body result-state"><AlertCircle className="result-state__error" /><h1>QR Code inválido</h1><p>Leia novamente o QR Code exibido na tela.</p></div>}
          {error && <div className="form-error"><AlertCircle />{error}</div>}
        </div>
        <p className="pair-footer">© 2026 Mobile2Screen · Pareamento seguro</p>
      </section>
    </main>
  );
}
