import type { Device } from "../types";

interface ApiResponse<T> {
  data: T;
}

async function parseResponse<T>(response: Response): Promise<T> {
  const payload = (await response.json().catch(() => ({}))) as T & { message?: string };
  if (!response.ok) throw new Error(payload.message || "Não foi possível concluir a operação.");
  return payload;
}

export async function pairingRequest<T>(path: string, session: string, body: Record<string, unknown> = {}) {
  const response = await fetch(path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ session, ...body }),
  });
  return parseResponse<T>(response);
}

export function login(session: string, email: string, password: string) {
  return pairingRequest<{ user: { name?: string } }>("/api/pair/login", session, { email, password });
}

export function listDevices(session: string) {
  return pairingRequest<ApiResponse<Device[]>>("/api/pair/devices", session);
}

export function selectDevice(session: string, deviceId: number) {
  return pairingRequest<ApiResponse<Device>>("/api/pair/select", session, { device_id: deviceId });
}

export async function completeAlert() {
  await fetch("/api/complete-alert", { method: "POST" });
}
