import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import "./index.css";

// Check if we're in a Tauri window by looking for the specific IPC protocol
// Tauri windows use `ipc://` or have `__TAURI__` injected
function isTauriWindow(): boolean {
  // Method 1: Check for __TAURI__ object
  if (typeof window !== "undefined" && !!(window as any).__TAURI__) {
    return true;
  }
  // Method 2: Check if running from file:// or tauri:// protocol
  if (typeof window !== "undefined" && window.location) {
    const protocol = window.location.protocol;
    // Tauri v2 uses https://tauri.localhost/ in production, but in dev it's http://localhost:1420
    // The key difference: in Tauri window, we can access window.__TAURI_INTERNALS__
    if ((window as any).__TAURI_INTERNALS__) {
      return true;
    }
  }
  return false;
}

// More reliable: check if we can access Tauri-specific APIs
async function checkTauriAvailable(): Promise<boolean> {
  // If __TAURI__ exists, we're definitely in Tauri
  if ((window as any).__TAURI__) return true;
  // Wait a bit for Tauri to inject
  await new Promise(r => setTimeout(r, 100));
  return !!(window as any).__TAURI__;
}

const root = document.getElementById("root") as HTMLElement;

// Show loading state first
root.innerHTML = `
  <div style="
    display: flex;
    align-items: center;
    justify-content: center;
    height: 100vh;
    background: #0f0f0f;
    color: #888;
    font-family: system-ui, sans-serif;
  ">
    正在启动...
  </div>
`;

// Check Tauri availability
let tauriCheckAttempts = 0;
const maxAttempts = 10;

function tryMountApp() {
  tauriCheckAttempts++;
  
  if ((window as any).__TAURI__ || (window as any).__TAURI_INTERNALS__) {
    // Tauri is available, mount the app
    root.innerHTML = "";
    ReactDOM.createRoot(root).render(
      <React.StrictMode>
        <App />
      </React.StrictMode>,
    );
    return;
  }
  
  if (tauriCheckAttempts >= maxAttempts) {
    // After multiple attempts, still no Tauri - show browser warning
    root.innerHTML = `
      <div style="
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        height: 100vh;
        font-family: system-ui, -apple-system, sans-serif;
        background: #0f0f0f;
        color: #e0e0e0;
        text-align: center;
        padding: 2rem;
      ">
        <div style="font-size: 4rem; margin-bottom: 1rem;">🖥️</div>
        <h1 style="font-size: 1.5rem; margin-bottom: 1rem; color: #fff;">DevDash 是桌面应用</h1>
        <p style="font-size: 1rem; color: #888; max-width: 400px; line-height: 1.6;">
          请不要在浏览器中打开此页面。<br>
          请通过 Tauri 桌面窗口运行应用。
        </p>
        <div style="margin-top: 2rem; padding: 1rem; background: #1a1a1a; border-radius: 8px; font-family: monospace; font-size: 0.875rem; color: #666;">
          npm run tauri dev
        </div>
      </div>
    `;
    return;
  }
  
  // Try again in 100ms
  setTimeout(tryMountApp, 100);
}

tryMountApp();
