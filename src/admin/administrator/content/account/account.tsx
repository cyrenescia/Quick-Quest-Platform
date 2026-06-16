import { MdOutlineMail, MdOutlinePhone, MdOutlineLocationOn, MdOutlineCameraAlt } from "react-icons/md";

export function AccountView() {
  return (
    <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="mb-6">
        <h2 className="text-xl font-bold text-base-content">Profile & Settings</h2>
        <p className="text-sm text-base-content/60">Kelola informasi akun administrator Anda.</p>
      </div>

      <div className="grid gap-6 xl:grid-cols-3">
        {/* Profile Card */}
        <div className="xl:col-span-1 space-y-6">
          <div className="rounded-2xl border border-base-300/50 bg-base-100/40 backdrop-blur-xl p-6 shadow-sm text-center">
            <div className="relative mx-auto mb-4 size-32 rounded-full ring-4 ring-base-200">
              <img 
                src="https://api.dicebear.com/9.x/avataaars/svg?seed=Admin" 
                alt="Admin Profile" 
                className="rounded-full bg-base-200 object-cover"
              />
              <button className="absolute bottom-0 right-0 flex size-8 items-center justify-center rounded-full bg-primary text-white shadow-md hover:scale-105 transition-transform">
                <MdOutlineCameraAlt className="size-4" />
              </button>
            </div>
            <h3 className="text-lg font-bold text-base-content">Admin System</h3>
            <p className="text-sm font-semibold text-primary mb-4">Super Administrator</p>
            
            <div className="flex justify-center gap-4 border-t border-base-200 pt-4">
              <div className="text-center">
                <p className="text-xl font-bold">1.2K</p>
                <p className="text-[10px] uppercase tracking-wider text-base-content/50">Verifications</p>
              </div>
              <div className="w-px bg-base-200"></div>
              <div className="text-center">
                <p className="text-xl font-bold">342</p>
                <p className="text-[10px] uppercase tracking-wider text-base-content/50">Disputes</p>
              </div>
            </div>
          </div>
        </div>

        {/* Settings Form */}
        <div className="xl:col-span-2">
          <div className="rounded-2xl border border-base-300/50 bg-base-100/40 backdrop-blur-xl shadow-sm">
            <div className="border-b border-base-200 px-6 py-4">
              <h3 className="font-bold text-base-content">Personal Information</h3>
            </div>
            <div className="p-6">
              <form className="space-y-5" onSubmit={(e) => e.preventDefault()}>
                <div className="grid gap-5 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold uppercase text-base-content/70">Full Name</label>
                    <div className="relative">
                      <input 
                        type="text" 
                        defaultValue="Admin System"
                        className="w-full rounded-lg border border-base-300/50 bg-base-100/40 backdrop-blur-md px-4 py-2.5 text-sm focus:border-primary focus:outline-none transition-all duration-300"
                      />
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold uppercase text-base-content/70">Phone Number</label>
                    <div className="relative">
                      <MdOutlinePhone className="absolute left-3 top-1/2 -translate-y-1/2 text-base-content/40" />
                      <input 
                        type="tel" 
                        defaultValue="+62 812 3456 7890"
                        className="w-full rounded-lg border border-base-300/50 bg-base-100/40 backdrop-blur-md py-2.5 pl-10 pr-4 text-sm focus:border-primary focus:outline-none transition-all duration-300"
                      />
                    </div>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold uppercase text-base-content/70">Email Address</label>
                  <div className="relative">
                    <MdOutlineMail className="absolute left-3 top-1/2 -translate-y-1/2 text-base-content/40" />
                    <input 
                      type="email" 
                      defaultValue="admin@quickquest.com"
                      className="w-full rounded-lg border border-base-300/50 bg-base-100/40 backdrop-blur-md py-2.5 pl-10 pr-4 text-sm focus:border-primary focus:outline-none transition-all duration-300"
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold uppercase text-base-content/70">Address</label>
                  <div className="relative">
                    <MdOutlineLocationOn className="absolute left-3 top-3 text-base-content/40" />
                    <textarea 
                      rows={3}
                      defaultValue="Gedung Cyber, Jl. Kuningan Barat No.8, Jakarta Selatan"
                      className="w-full rounded-lg border border-base-300/50 bg-base-100/40 backdrop-blur-md py-2.5 pl-10 pr-4 text-sm focus:border-primary focus:outline-none transition-all duration-300"
                    />
                  </div>
                </div>

                <div className="flex justify-end gap-3 pt-4 border-t border-base-200">
                  <button type="button" className="btn h-10 min-h-10 border border-base-300 bg-base-100 px-6 text-sm hover:bg-base-200">
                    Cancel
                  </button>
                  <button type="button" className="btn h-10 min-h-10 bg-primary border-none text-white px-6 text-sm shadow-md hover:bg-primary/90">
                    Save Changes
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
