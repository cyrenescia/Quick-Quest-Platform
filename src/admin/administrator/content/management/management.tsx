import { useState } from "react";
import { MdOutlineEdit, MdOutlineDelete, MdSearch } from "react-icons/md";

// Dummy data for management
const users = [
  { id: 1, name: "Budi Santoso", email: "budi@example.com", role: "Giver", status: "Active", joined: "Oct 24, 2024" },
  { id: 2, name: "Siti Aminah", email: "siti@example.com", role: "Runner", status: "Active", joined: "Oct 25, 2024" },
  { id: 3, name: "Ahmad", email: "ahmad@example.com", role: "Runner", status: "Suspended", joined: "Oct 26, 2024" },
  { id: 4, name: "Rina", email: "rina@example.com", role: "Giver", status: "Active", joined: "Oct 27, 2024" },
  { id: 5, name: "Joko", email: "joko@example.com", role: "Runner", status: "Pending", joined: "Oct 28, 2024" },
];

export function ManagementView() {
  const [searchTerm, setSearchTerm] = useState("");

  const filteredUsers = users.filter((u) => 
    u.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
    u.email.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-xl font-bold text-base-content">User Management</h2>
          <p className="text-sm text-base-content/60">Kelola data master pengguna QuickQuest.</p>
        </div>
        <div className="flex gap-2">
          <div className="relative">
            <MdSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-base-content/50 size-5" />
            <input 
              type="text" 
              placeholder="Cari user..." 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="h-10 pl-10 pr-4 rounded-lg border border-base-300/50 bg-base-100/40 backdrop-blur-xl text-sm focus:outline-none focus:border-primary transition-all duration-300"
            />
          </div>
          <button className="btn h-10 min-h-10 rounded-lg bg-primary text-primary-content border-none shadow-none text-sm font-bold px-4">
            Add User
          </button>
        </div>
      </div>

      <div className="rounded-2xl border border-base-300/50 bg-base-100/40 backdrop-blur-xl shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-base-content/80 whitespace-nowrap">
            <thead className="bg-base-200/50 text-base-content border-b border-base-300">
              <tr>
                <th className="px-6 py-4 font-bold">Name</th>
                <th className="px-6 py-4 font-bold">Email</th>
                <th className="px-6 py-4 font-bold">Role</th>
                <th className="px-6 py-4 font-bold">Status</th>
                <th className="px-6 py-4 font-bold">Joined</th>
                <th className="px-6 py-4 font-bold text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-base-300/50">
              {filteredUsers.map((user) => (
                <tr key={user.id} className="hover:bg-base-200/30 transition-colors">
                  <td className="px-6 py-4 font-medium text-base-content">{user.name}</td>
                  <td className="px-6 py-4">{user.email}</td>
                  <td className="px-6 py-4">
                    <span className="font-semibold text-primary">{user.role}</span>
                  </td>
                  <td className="px-6 py-4">
                    <span className={`inline-flex rounded-full px-3 py-1 text-[11px] font-bold ${
                      user.status === "Active" ? "bg-emerald-500/10 text-emerald-600" :
                      user.status === "Suspended" ? "bg-error/10 text-error" :
                      "bg-warning/10 text-warning"
                    }`}>
                      {user.status}
                    </span>
                  </td>
                  <td className="px-6 py-4">{user.joined}</td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <button className="p-1.5 rounded-md text-info hover:bg-info/10 transition-colors">
                        <MdOutlineEdit className="size-5" />
                      </button>
                      <button className="p-1.5 rounded-md text-error hover:bg-error/10 transition-colors">
                        <MdOutlineDelete className="size-5" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {filteredUsers.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-6 py-8 text-center text-base-content/50">
                    Tidak ada user ditemukan.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
