import { createKioskServer } from "./server/app-server.mjs";
import { createConfiguration } from "./server/config.mjs";
import { KioskService } from "./server/kiosk-service.mjs";

const configuration = createConfiguration();
const kiosk = new KioskService(configuration);
const server = createKioskServer(configuration, kiosk);

server.listen(configuration.port, "0.0.0.0", () => {
  console.log(`Mobile2Screen Kiosk: ${configuration.publicBaseUrl}`);
  console.log(`Pareamento pelo celular: ${kiosk.pairingUrl()}`);
});

setInterval(() => kiosk.heartbeat(), configuration.heartbeatIntervalMs).unref();
setInterval(() => kiosk.pollDeliveries(), configuration.pollIntervalMs).unref();
