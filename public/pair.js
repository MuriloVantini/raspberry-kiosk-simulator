const session = new URLSearchParams(window.location.search).get("session");
const loginForm = document.querySelector("#login-form");
const deviceForm = document.querySelector("#device-form");
const deviceSelect = document.querySelector("#device-select");
const expired = document.querySelector("#expired");
const success = document.querySelector("#success");
const errorMessage = document.querySelector("#error");

async function request(path, body) {
  const response = await fetch(path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ session, ...body }),
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload.message || "Não foi possível concluir a operação.");
  return payload;
}

function setBusy(form, busy) {
  form.querySelector("button").disabled = busy;
}

if (!session) {
  loginForm.hidden = true;
  expired.hidden = false;
}

loginForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  errorMessage.textContent = "";
  setBusy(loginForm, true);
  const data = new FormData(loginForm);
  try {
    const payload = await request("/api/pair/login", { email: data.get("email"), password: data.get("password") });
    const devicesPayload = await request("/api/pair/devices", {});
    document.querySelector("#welcome").textContent = `Olá, ${payload.user?.name || "usuário"}. Selecione onde esta tela está instalada.`;
    devicesPayload.data.forEach((device) => {
      const option = document.createElement("option");
      option.value = device.id;
      option.textContent = `${device.name}${device.location ? ` — ${device.location}` : ""} (${device.type || "dispositivo"})`;
      deviceSelect.append(option);
    });
    loginForm.hidden = true;
    deviceForm.hidden = false;
  } catch (error) {
    errorMessage.textContent = error.message;
  } finally {
    setBusy(loginForm, false);
  }
});

deviceForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  errorMessage.textContent = "";
  if (!deviceSelect.value) return;
  setBusy(deviceForm, true);
  try {
    const payload = await request("/api/pair/select", { device_id: Number(deviceSelect.value) });
    document.querySelector("#success-message").textContent = `${payload.data.name} foi conectado com sucesso.`;
    deviceForm.hidden = true;
    success.hidden = false;
  } catch (error) {
    errorMessage.textContent = error.message;
    setBusy(deviceForm, false);
  }
});
