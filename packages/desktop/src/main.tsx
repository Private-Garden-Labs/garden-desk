import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./app.js";
import { productionCapabilities } from "./capabilities.js";
import { DemoDesktopApi } from "./demo/demo-api.js";
import { prefillComposerOnFocus } from "./demo/demo-prompt.js";
import { initLocale } from "./i18n/index.js";
import "./styles.css";
import { tauriDesktopApi } from "./tauri-api.js";

const root = document.getElementById("root");
if (root === null) throw new Error("Desktop root element is missing.");

const api = new DemoDesktopApi(Date.now, tauriDesktopApi.listenForDroppedPaths);

prefillComposerOnFocus();
void initLocale().then(() =>
  createRoot(root).render(
    <StrictMode>
      <App api={api} capabilities={productionCapabilities} />
    </StrictMode>,
  ),
);
