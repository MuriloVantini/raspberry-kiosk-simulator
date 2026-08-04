const screen = document.querySelector("#screen");
const idleContent = document.querySelector("#idle-content");
const alertContent = document.querySelector("#alert-content");
const connectionStatus = document.querySelector("#connection-status");
const pairingContent = document.querySelector("#pairing-content");
const connectedTitle = document.querySelector("#connected-title");
const pairingQr = document.querySelector(".pairing-qr");
const clock = document.querySelector("#clock");
const alertType = document.querySelector("#alert-type");
const alertTitle = document.querySelector("#alert-title");
const alertMessage = document.querySelector("#alert-message");
const alertDuration = document.querySelector("#alert-duration");

let dismissTimer;

function showPaired() {
  pairingContent.hidden = true;
  connectedTitle.hidden = false;
}

function updateClock() {
  clock.textContent = new Intl.DateTimeFormat("pt-BR", { dateStyle: "full", timeStyle: "medium" }).format(new Date());
}

function showIdle() {
  clearTimeout(dismissTimer);
  screen.className = "screen screen--idle";
  alertContent.hidden = true;
  idleContent.hidden = false;
}

async function finishAlert() {
  try {
    await fetch("/api/complete-alert", { method: "POST" });
  } finally {
    showIdle();
  }
}

function showAlert(delivery) {
  const alert = delivery.alert ?? {};
  const durationSeconds = Number(alert.duration_seconds) || 10;
  clearTimeout(dismissTimer);

  screen.className = `screen screen--${alert.type ?? "info"}`;
  alertType.textContent = alert.type ?? "informação";
  alertTitle.textContent = alert.title ?? "Novo alerta";
  alertMessage.textContent = alert.message ?? "";
  alertDuration.textContent = `Exibindo por ${durationSeconds} segundos`;
  idleContent.hidden = true;
  alertContent.hidden = false;
  dismissTimer = setTimeout(finishAlert, durationSeconds * 1000);
}

const events = new EventSource("/events");
events.addEventListener("connection", ({ data }) => {
  const status = JSON.parse(data);
  if (status.connected) showPaired();
  if (status.connected) {
    connectionStatus.textContent = "Conectada à API mobile2screen";
  } else if (status.lastError) {
    connectionStatus.textContent = `Aguardando conexão: ${status.lastError}`;
  }
});
events.addEventListener("paired", showPaired);
events.addEventListener("pairing", () => {
  pairingQr.src = `/pairing-qr.svg?t=${Date.now()}`;
});
events.addEventListener("alert", ({ data }) => showAlert(JSON.parse(data)));

document.addEventListener("dblclick", () => {
  document.documentElement.requestFullscreen?.();
});

updateClock();
setInterval(updateClock, 1000);
