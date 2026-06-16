import { useAdminRoute } from "../route.context.tsx";
import {
  exitAdminToUserLogin,
  getAdminLoginViewText,
  useAdminLoginVM,
} from "./admin-login";

export default function AdminLoginComponent() {
  const { navigate } = useAdminRoute();
  const viewText = getAdminLoginViewText();
  const vm = useAdminLoginVM({
    onAdminAuthenticated: () => navigate("administrator"),
  });

  return (
    <div className="theme-bg min-h-screen bg-base-100 px-4 py-6 text-base-content sm:px-6 lg:px-8">
      <div className="mx-auto flex min-h-[calc(100vh-3rem)] max-w-xl items-center">
        <section className="w-full rounded-lg border border-base-300 bg-base-100 p-6 shadow-sm">
          <div className="border-b border-base-300 pb-5">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-error">
              Administrator
            </p>
            <h1 className="mt-2 text-3xl font-black tracking-normal">
              {viewText.title}
            </h1>
            <p className="mt-2 text-sm leading-relaxed text-base-content/70">
              {viewText.subtitle}
            </p>
          </div>

          <form className="mt-5 flex flex-col gap-4" onSubmit={vm.handleSubmit}>
            <label className="form-control">
              <span className="label pb-1 text-xs font-bold uppercase tracking-[0.12em] text-base-content/50">
                {viewText.identityLabel}
              </span>
              <input
                value={vm.identity}
                onChange={(event) => vm.setIdentity(event.target.value)}
                type="text"
                autoComplete="username"
                className="input input-bordered h-12 rounded-lg bg-base-100 text-sm"
                placeholder="admin@email.com"
              />
            </label>

            <label className="form-control">
              <span className="label pb-1 text-xs font-bold uppercase tracking-[0.12em] text-base-content/50">
                {viewText.passwordLabel}
              </span>
              <input
                value={vm.password}
                onChange={(event) => vm.setPassword(event.target.value)}
                type="password"
                autoComplete="current-password"
                className="input input-bordered h-12 rounded-lg bg-base-100 text-sm"
                placeholder="••••••••"
              />
            </label>

            {vm.formError && (
              <div className="rounded-lg border border-error/25 bg-error/10 px-4 py-3 text-sm font-semibold text-error">
                {vm.formError}
              </div>
            )}

            <div className="grid gap-2 pt-1">
              <button
                type="submit"
                disabled={vm.isSubmitting}
                className="btn h-11 min-h-11 rounded-lg border-none bg-error px-4 text-sm font-black text-error-content shadow-none hover:opacity-90 disabled:opacity-60"
              >
                {vm.isSubmitting ? viewText.submittingLabel : viewText.submitLabel}
              </button>
              <button
                type="button"
                onClick={exitAdminToUserLogin}
                className="btn h-11 min-h-11 rounded-lg border border-base-300 bg-base-100 px-4 text-sm font-bold text-base-content shadow-none hover:bg-base-200"
              >
                {viewText.backToUserLoginLabel}
              </button>
            </div>
          </form>
        </section>
      </div>
    </div>
  );
}
