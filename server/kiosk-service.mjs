import { randomBytes } from "node:crypto";

export class KioskService {
  constructor(configuration) {
    this.configuration = configuration;
    this.credentials = { deviceId: "", deviceToken: "" };
    this.connection = { connected: false, lastHeartbeatAt: null, lastError: null };
    this.currentDeliveryId = null;
    this.eventClients = new Set();
    this.pairing = this.createPairingSession();
  }

  createPairingSession() { return { token: randomBytes(24).toString("hex"), authToken: null, user: null }; }
  isConfigured() { return Boolean(this.credentials.deviceId && this.credentials.deviceToken); }
  pairingUrl() { return `${this.configuration.publicBaseUrl}/pair?session=${this.pairing.token}`; }
  snapshot() { return { configured: this.isConfigured(), public_url: this.configuration.publicBaseUrl, ...this.connection }; }

  subscribe(request, response) {
    response.writeHead(200, { "Content-Type": "text/event-stream", "Cache-Control": "no-cache", Connection: "keep-alive" });
    response.write(`event: connection\ndata: ${JSON.stringify(this.connection)}\n\n`);
    this.eventClients.add(response);
    request.on("close", () => this.eventClients.delete(response));
  }

  publish(event, payload) {
    const message = `event: ${event}\ndata: ${JSON.stringify(payload)}\n\n`;
    this.eventClients.forEach((client) => client.write(message));
  }

  requirePairingSession(session) {
    if (!session || session !== this.pairing.token) throw new Error("Sessão de pareamento inválida ou expirada.");
  }

  async callApi(path, options = {}, token = null) {
    const response = await fetch(`${this.configuration.apiBaseUrl}${path}`, {
      ...options,
      headers: { Accept: "application/json", "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}), ...(options.headers ?? {}) },
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(payload.message ?? `A API retornou ${response.status}.`);
    return payload;
  }

  callDeviceApi(path, options = {}) {
    if (!this.isConfigured()) throw new Error("Este kiosk ainda não foi pareado com um dispositivo.");
    return this.callApi(path, { ...options, headers: { "X-Device-Token": this.credentials.deviceToken, ...(options.headers ?? {}) } });
  }

  callUserApi(path, options = {}) { return this.callApi(path, options, this.pairing.authToken); }

  async revokePairingAuth() {
    if (!this.pairing.authToken) return;
    try { await this.callUserApi("/api/logout", { method: "POST" }); } catch { /* token já revogado */ }
    this.pairing.authToken = null;
    this.pairing.user = null;
  }

  async login(session, email, password) {
    this.requirePairingSession(session);
    await this.revokePairingAuth();
    const payload = await this.callApi("/api/login", { method: "POST", body: JSON.stringify({ email, password }) });
    this.pairing.authToken = payload.token;
    this.pairing.user = payload.user;
    this.expireAuthenticatedPairing(this.pairing.token);
    return { user: payload.user };
  }

  expireAuthenticatedPairing(authenticatedSession) {
    setTimeout(async () => {
      if (this.pairing.token !== authenticatedSession || !this.pairing.authToken) return;
      await this.revokePairingAuth();
      this.pairing = this.createPairingSession();
      this.publish("pairing", { url: this.pairingUrl() });
    }, 10 * 60 * 1000).unref();
  }

  async listDevices(session) {
    this.requirePairingSession(session);
    if (!this.pairing.authToken) throw new Error("Faça login para continuar.");
    const payload = await this.callUserApi("/api/devices");
    return (payload.data ?? []).map(({ id, name, type, location, is_online }) => ({ id, name, type, location, is_online }));
  }

  async selectDevice(session, deviceId) {
    this.requirePairingSession(session);
    if (!this.pairing.authToken) throw new Error("Faça login para continuar.");
    const payload = await this.callUserApi(`/api/devices/${Number(deviceId)}`);
    const device = payload.data;
    if (!device?.id || !device?.connection_token) throw new Error("Dispositivo inválido ou sem token de conexão.");
    this.credentials = { deviceId: String(device.id), deviceToken: device.connection_token };
    await this.connectDevice();
    await this.revokePairingAuth();
    const selected = { id: device.id, name: device.name };
    this.pairing = this.createPairingSession();
    this.publish("paired", { device: selected });
    return selected;
  }

  async connectDevice() {
    const payload = await this.callDeviceApi(`/api/kiosk/devices/${this.credentials.deviceId}/connect`, { method: "POST", body: JSON.stringify({ simulator: true, screen: "kiosk" }) });
    const device = this.toPublicDevice(payload.data);
    this.connection = { connected: true, lastHeartbeatAt: new Date().toISOString(), lastError: null, device };
    this.publish("connection", this.connection);
    return device;
  }

  toPublicDevice(device = {}) {
    const { id, name, type, location, is_online } = device;
    return { id, name, type, location, is_online };
  }

  async heartbeat() {
    if (!this.isConfigured()) return;
    try {
      await this.callDeviceApi(`/api/kiosk/devices/${this.credentials.deviceId}/heartbeat`, { method: "POST", body: JSON.stringify({ metadata: { simulator: true, screen: "kiosk", local_port: this.configuration.port } }) });
      this.connection = { ...this.connection, connected: true, lastHeartbeatAt: new Date().toISOString(), lastError: null };
    } catch (error) { this.connection = { ...this.connection, connected: false, lastError: error.message }; }
    this.publish("connection", this.connection);
  }

  async pollDeliveries() {
    if (!this.isConfigured() || this.currentDeliveryId !== null) return;
    try {
      const payload = await this.callDeviceApi(`/api/kiosk/devices/${this.credentials.deviceId}/deliveries`);
      const [delivery] = payload.data ?? [];
      if (!delivery) return;
      this.currentDeliveryId = delivery.id;
      await this.setDeliveryStatus(delivery.id, "delivered");
      this.publish("alert", delivery);
    } catch (error) {
      this.connection = { ...this.connection, connected: false, lastError: error.message };
      this.publish("connection", this.connection);
    }
  }

  setDeliveryStatus(deliveryId, status) {
    return this.callDeviceApi(`/api/kiosk/devices/${this.credentials.deviceId}/deliveries/${deliveryId}/status`, { method: "PATCH", body: JSON.stringify({ status }) });
  }

  async completeAlert() {
    if (this.currentDeliveryId === null) throw new Error("Nenhum alerta está em exibição.");
    await this.setDeliveryStatus(this.currentDeliveryId, "dismissed");
    this.currentDeliveryId = null;
  }
}
