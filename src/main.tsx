import { StrictMode, useEffect, useState } from "react";
import { createRoot } from "react-dom/client";

import { AppRoot } from "./app/app.tsx"; // ClientSide
import { AdministratorRoot } from "./admin/app.tsx"; // AdminSide
import {
  ADMIN_ROUTE_VIEW_STORAGE_KEY,
  AdminRouteProvider,
} from "./admin/route.context.tsx";
import { ROUTE_VIEW_STORAGE_KEY, RouteProvider } from "./app/route.context.tsx";
import { AuthProvider } from "./app/auth.context.tsx";
import { initializeTheme } from "./app/global.theme";
import "./index.css";

// Inisialisasi theme secara global SEBELUM render apapun untuk mencegah reverting ke default DaisyUI
initializeTheme();

// Extreme Single URL Architecture Enforcement
// Jika ada user iseng ngetik /login atau /home di address bar, kita putar balik secara siluman (tanpa reload) ke "/"
if (window.location.pathname !== "/") {
  window.history.replaceState(null, "", "/");
}

// main.tsx

if ("serviceWorker" in navigator && import.meta.env.PROD) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/sw.js");
  });
}

type RootMode = "app" | "admin";
const ROOT_MODE_STORAGE_KEY = "qqm-root-shell-mode";
const ROOT_PAGE_STORAGE_KEY = "qqm-root-shell-page";
const ADMIN_ROOT_PAGE = "admin-side";

function readPersistedRootMode(): RootMode {
  if (typeof window === "undefined") {
    return "app";
  }

  const storedMode = window.localStorage.getItem(ROOT_MODE_STORAGE_KEY)?.trim();
  return storedMode === "admin" ? "admin" : "app";
}

function persistAdminRootState(): void {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem(ROOT_MODE_STORAGE_KEY, "admin");
  window.localStorage.setItem(ROOT_PAGE_STORAGE_KEY, ADMIN_ROOT_PAGE);
  window.localStorage.setItem(ADMIN_ROUTE_VIEW_STORAGE_KEY, "login");
}

function persistUserLoginRootState(): void {
  if (typeof window === "undefined") {
    return;
  }

  window.sessionStorage.clear();
  window.localStorage.removeItem(ROOT_MODE_STORAGE_KEY);
  window.localStorage.removeItem(ROOT_PAGE_STORAGE_KEY);
  window.localStorage.removeItem(ADMIN_ROUTE_VIEW_STORAGE_KEY);
  window.localStorage.setItem(ROUTE_VIEW_STORAGE_KEY, "login");
}

function RootShell() {
  const [rootMode, setRootMode] = useState<RootMode>(readPersistedRootMode);

  useEffect(() => {
    function handleEnterAdminPanel() {
      persistAdminRootState();
      setRootMode("admin");
    }

    function handleExitAdminPanel() {
      persistUserLoginRootState();
      setRootMode("app");
    }

    window.addEventListener("qqm-enter-admin-panel", handleEnterAdminPanel);
    window.addEventListener("qqm-exit-admin-panel", handleExitAdminPanel);
    return () => {
      window.removeEventListener(
        "qqm-enter-admin-panel",
        handleEnterAdminPanel,
      );
      window.removeEventListener(
        "qqm-exit-admin-panel",
        handleExitAdminPanel,
      );
    };
  }, []);

  if (rootMode === "admin") {
    return (
      <AdminRouteProvider>
        <AdministratorRoot />
      </AdminRouteProvider>
    );
  }

  return (
    <RouteProvider>
      <AuthProvider>
        <AppRoot />
      </AuthProvider>
    </RouteProvider>
  );
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <RootShell />
  </StrictMode>,
);
