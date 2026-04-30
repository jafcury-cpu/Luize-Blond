import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { initErrorTelemetry } from "./lib/error-telemetry";

initErrorTelemetry();

createRoot(document.getElementById("root")!).render(<App />);
