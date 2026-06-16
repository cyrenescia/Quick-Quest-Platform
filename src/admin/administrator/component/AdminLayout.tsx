import { type ReactNode, useState } from "react";
import {
  MdSpaceDashboard,
  MdOutlineSecurity,
  MdOutlineGavel,
  MdOutlineManageAccounts,
  MdOutlineAccountCircle,
  MdOutlineMenu,
} from "react-icons/md";

type MenuId = "dashboard" | "verification" | "dispute" | "management" | "account";

interface AdminLayoutProps {
  activeMenu: MenuId;
  onMenuChange: (menu: MenuId) => void;
  children: ReactNode;
  onLogout: () => void;
  onUserSwitch: () => void;
}

export function AdminLayout({
  activeMenu,
  onMenuChange,
  children,
  onLogout,
  onUserSwitch,
}: AdminLayoutProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const menus = [
    { id: "dashboard" as MenuId, label: "Dashboard", icon: MdSpaceDashboard },
    { id: "verification" as MenuId, label: "Verification", icon: MdOutlineSecurity },
    { id: "dispute" as MenuId, label: "Disputes", icon: MdOutlineGavel },
    { id: "management" as MenuId, label: "Management", icon: MdOutlineManageAccounts },
    { id: "account" as MenuId, label: "Account", icon: MdOutlineAccountCircle },
  ];

  return (
    <div className="flex h-screen overflow-hidden theme-bg bg-base-100 text-base-content">
      {/* Sidebar Overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`absolute left-0 top-0 z-50 flex h-screen w-64 flex-col overflow-y-hidden bg-base-100/40 backdrop-blur-xl border-r border-base-300/50 duration-300 ease-linear lg:static lg:translate-x-0 ${
          sidebarOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="flex items-center justify-center gap-2 px-6 py-5 lg:py-6">
          <span className="text-2xl font-black text-primary">QQA</span>
          <span className="text-xl font-bold">Admin</span>
        </div>

        <div className="no-scrollbar flex flex-col overflow-y-auto duration-300 ease-linear">
          <nav className="mt-5 px-4 py-4 lg:mt-9 lg:px-6">
            <div>
              <h3 className="mb-4 ml-4 text-xs font-semibold text-base-content/50 uppercase tracking-widest">
                Menu
              </h3>
              <ul className="mb-6 flex flex-col gap-1.5">
                {menus.map((menu) => (
                  <li key={menu.id}>
                    <button
                      type="button"
                      onClick={() => {
                        onMenuChange(menu.id);
                        setSidebarOpen(false);
                      }}
                      className={`group relative flex w-full items-center gap-2.5 rounded-sm px-4 py-2 font-medium duration-300 ease-in-out ${
                        activeMenu === menu.id
                          ? "bg-primary/10 text-primary"
                          : "text-base-content/70 hover:bg-base-300 hover:text-base-content"
                      }`}
                    >
                      <menu.icon className="size-5" />
                      {menu.label}
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          </nav>
        </div>
      </aside>

      {/* Content Area */}
      <div className="relative flex flex-1 flex-col overflow-y-auto overflow-x-hidden">
        {/* Header */}
        <header className="sticky top-0 z-30 flex w-full bg-base-100/40 backdrop-blur-xl border-b border-base-300/50">
          <div className="flex flex-grow items-center justify-between px-4 py-4 md:px-6 2xl:px-11">
            <div className="flex items-center gap-2 lg:hidden">
              <button
                type="button"
                onClick={() => setSidebarOpen(true)}
                className="z-50 block rounded-sm border border-base-300 bg-base-100 p-1.5 shadow-sm"
              >
                <MdOutlineMenu className="size-6 text-base-content" />
              </button>
            </div>

            <div className="hidden sm:block">
              <h1 className="text-lg font-bold">
                {menus.find((m) => m.id === activeMenu)?.label}
              </h1>
            </div>

            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={onLogout}
                className="btn btn-sm min-h-8 h-8 rounded-lg border border-error/25 bg-error/10 px-3 text-xs text-error shadow-none hover:bg-error/15"
              >
                Logout
              </button>
              <button
                type="button"
                onClick={onUserSwitch}
                className="btn btn-sm min-h-8 h-8 rounded-lg border border-base-300 bg-base-100 px-3 text-xs shadow-none hover:bg-base-200"
              >
                User App
              </button>
            </div>
          </div>
        </header>

        {/* Main Content */}
        <main>
          <div className="p-4 mx-auto max-w-screen-2xl md:p-6 2xl:p-10">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
