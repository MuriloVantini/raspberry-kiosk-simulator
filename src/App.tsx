import { KioskScreen } from "./pages/KioskScreen";
import { PairingScreen } from "./pages/PairingScreen";

export function App() {
  return window.location.pathname.startsWith("/pair") ? <PairingScreen /> : <KioskScreen />;
}
