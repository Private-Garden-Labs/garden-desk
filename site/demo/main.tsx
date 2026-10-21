import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "../../packages/desktop/src/app.js";
import type { DesktopCapabilities } from "../../packages/desktop/src/capabilities.js";
import { initLocale } from "../../packages/desktop/src/i18n/index.js";
import "../../packages/desktop/src/styles.css";
import "./demo.css";
import { DemoDesktopApi } from "../../packages/desktop/src/demo/demo-api.js";
import { prefillComposerOnFocus } from "../../packages/desktop/src/demo/demo-prompt.js";

if (new URLSearchParams(window.location.search).has("embedded")) {
  document.body.classList.add("embedded-demo");
  document.querySelector(".demo-frame")?.remove();
}

const root = document.getElementById("root");
if (root === null) throw new Error("Demo root element is missing.");

const capabilities: DesktopCapabilities = { nativeActions: true };

prefillComposerOnFocus();
void initLocale().then(() =>
  createRoot(root).render(
    <StrictMode>
      <App api={new DemoDesktopApi()} capabilities={capabilities} />
    </StrictMode>,
  ),
);
