import {
  createContext,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";

export type AdminRouteView = "administrator" | "login";
export const ADMIN_ROUTE_VIEW_STORAGE_KEY = "qqm-admin-route-view";

function isAdminRouteView(value: string | null): value is AdminRouteView {
  return value === "administrator" || value === "login";
}

function resolveInitialAdminRouteView(
  defaultView: AdminRouteView,
): AdminRouteView {
  if (typeof window === "undefined") {
    return defaultView;
  }

  const storedView = window.localStorage.getItem(ADMIN_ROUTE_VIEW_STORAGE_KEY);
  return isAdminRouteView(storedView) ? storedView : defaultView;
}

interface AdminRouteContextType {
  currentView: AdminRouteView;
  navigate: (view: AdminRouteView) => void;
}

const AdminRouteContext = createContext<AdminRouteContextType | undefined>(
  undefined,
);

export function AdminRouteProvider({
  children,
  initialView = "login",
}: {
  children: ReactNode;
  initialView?: AdminRouteView;
}) {
  const [currentView, setCurrentView] = useState<AdminRouteView>(() =>
    resolveInitialAdminRouteView(initialView),
  );

  const contextValue = useMemo<AdminRouteContextType>(
    () => ({
      currentView,
      navigate: (view: AdminRouteView) => {
        setCurrentView(view);
        if (typeof window !== "undefined") {
          window.localStorage.setItem(ADMIN_ROUTE_VIEW_STORAGE_KEY, view);
        }
      },
    }),
    [currentView],
  );

  return (
    <AdminRouteContext.Provider value={contextValue}>
      {children}
    </AdminRouteContext.Provider>
  );
}

export function useAdminRoute() {
  const context = useContext(AdminRouteContext);
  if (!context) {
    throw new Error(
      "useAdminRoute harus digunakan di dalam AdminRouteProvider",
    );
  }

  return context;
}
