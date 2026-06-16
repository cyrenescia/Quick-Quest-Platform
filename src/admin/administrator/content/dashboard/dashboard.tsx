import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
} from "recharts";

const dataRevenue = [
  { name: "Sep", revenue: 30, sales: 20 },
  { name: "Oct", revenue: 40, sales: 30 },
  { name: "Nov", revenue: 35, sales: 40 },
  { name: "Dec", revenue: 50, sales: 35 },
  { name: "Jan", revenue: 49, sales: 50 },
  { name: "Feb", revenue: 60, sales: 45 },
  { name: "Mar", revenue: 70, sales: 60 },
  { name: "Apr", revenue: 90, sales: 80 },
  { name: "May", revenue: 100, sales: 90 },
];

const dataVisitors = [
  { name: "M", visitors: 40 },
  { name: "T", visitors: 30 },
  { name: "W", visitors: 45 },
  { name: "T", visitors: 50 },
  { name: "F", visitors: 65 },
  { name: "S", visitors: 80 },
  { name: "S", visitors: 90 },
];

export function DashboardView() {
  return (
    <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="grid grid-cols-12 gap-4 md:gap-6">
        <div className="col-span-12 xl:col-span-8 rounded-xl border border-base-300/50 bg-base-100/40 backdrop-blur-xl p-5 shadow-sm">
          <h3 className="mb-5 text-lg font-bold text-base-content">
            Platform Revenue & Escrow Flow
          </h3>
          <div className="h-[350px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={dataRevenue}>
                <defs>
                  <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#3B82F6" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#3B82F6" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="colorSales" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10B981" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#10B981" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <XAxis dataKey="name" stroke="#888888" fontSize={12} tickLine={false} axisLine={false} />
                <YAxis stroke="#888888" fontSize={12} tickLine={false} axisLine={false} tickFormatter={(value) => `$${value}k`} />
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#33333333" />
                <Tooltip
                  contentStyle={{ backgroundColor: "rgba(0,0,0,0.8)", borderRadius: "8px", border: "none", color: "#fff" }}
                  itemStyle={{ color: "#fff" }}
                />
                <Area type="monotone" dataKey="revenue" stroke="#3B82F6" strokeWidth={3} fillOpacity={1} fill="url(#colorRevenue)" />
                <Area type="monotone" dataKey="sales" stroke="#10B981" strokeWidth={3} fillOpacity={1} fill="url(#colorSales)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="col-span-12 xl:col-span-4 rounded-xl border border-base-300/50 bg-base-100/40 backdrop-blur-xl p-5 shadow-sm">
          <h3 className="mb-5 text-lg font-bold text-base-content">
            Active Runners this Week
          </h3>
          <div className="h-[350px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={dataVisitors}>
                <XAxis dataKey="name" stroke="#888888" fontSize={12} tickLine={false} axisLine={false} />
                <YAxis stroke="#888888" fontSize={12} tickLine={false} axisLine={false} />
                <Tooltip
                  cursor={{ fill: "rgba(0,0,0,0.05)" }}
                  contentStyle={{ backgroundColor: "rgba(0,0,0,0.8)", borderRadius: "8px", border: "none", color: "#fff" }}
                />
                <Bar dataKey="visitors" fill="#8B5CF6" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="col-span-12 rounded-xl border border-base-300/50 bg-base-100/40 backdrop-blur-xl p-5 shadow-sm">
          <h3 className="mb-5 text-lg font-bold text-base-content">
            Recent Quests
          </h3>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-base-content/70">
              <thead className="bg-base-200/50 text-base-content">
                <tr>
                  <th className="rounded-l-lg px-4 py-3 font-bold">Quest Title</th>
                  <th className="px-4 py-3 font-bold">Giver</th>
                  <th className="px-4 py-3 font-bold">Reward</th>
                  <th className="rounded-r-lg px-4 py-3 font-bold">Status</th>
                </tr>
              </thead>
              <tbody>
                {[
                  { id: 1, title: "Deliver Package to SCBD", giver: "Budi Santoso", reward: "Rp 50.000", status: "Completed" },
                  { id: 2, title: "Buy Groceries", giver: "Siti Aminah", reward: "Rp 25.000", status: "Active" },
                  { id: 3, title: "Fix Sink", giver: "Ahmad", reward: "Rp 150.000", status: "Pending" },
                ].map((row) => (
                  <tr key={row.id} className="border-b border-base-300/50 hover:bg-base-200/30 transition-colors">
                    <td className="px-4 py-3 font-medium text-base-content">{row.title}</td>
                    <td className="px-4 py-3">{row.giver}</td>
                    <td className="px-4 py-3 font-mono font-bold text-emerald-600">{row.reward}</td>
                    <td className="px-4 py-3">
                      <span className={`rounded-full px-2.5 py-0.5 text-[11px] font-bold ${
                        row.status === "Completed" ? "bg-emerald-500/10 text-emerald-600" :
                        row.status === "Active" ? "bg-blue-500/10 text-blue-600" :
                        "bg-amber-500/10 text-amber-600"
                      }`}>
                        {row.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
