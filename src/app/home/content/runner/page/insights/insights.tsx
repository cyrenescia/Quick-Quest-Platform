import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { cn, Surface } from "../../../../home.ui";
import {
  getRunnerInsightsSeed,
  resolveRunnerAvailabilityClass,
  resolveRunnerMemberStatusClass,
  resolveRunnerSkillLevelClass,
} from "./insights";
import { useEffect, useState } from "react";
import {
  fetchRunnerInsightsSkills,
  fetchRunnerInsightsSummary,
} from "./insights.service";

export function RunnerInsightsPage({ onBack }: { onBack: () => void }) {
  const [vm, setVm] = useState(getRunnerInsightsSeed());

  useEffect(() => {
    Promise.all([
      fetchRunnerInsightsSummary().catch(() => null),
      fetchRunnerInsightsSkills().catch(() => null),
    ]).then(([summary, skillsData]) => {
      if (!summary && !skillsData) return;

      setVm((prev) => {
        const next = { ...prev };
        
        if (summary) {
          next.focus = {
            title: prev.focus.title || "Target Area",
            description: `Active Focus: ${summary.stats?.top_skill_scope || "General"}. PP: ${summary.runner_pp} (SR: ${summary.runner_sr})`,
            demandWindow: prev.focus.demandWindow || "Daily",
          };
        }

        if (skillsData?.skills) {
          next.skills = skillsData.skills.map((s: any) => ({
            skill: s.skill_scope,
            level: "Q1", // Fallback if API doesn't provide level
            pp: `${s.total_pp} PP`,
            completionRate: "100%", // Not available in skills endpoint directly
            trend: "Stable",
          }));
        }
        
        return next;
      });
    });
  }, []);

  return (
    <div className="space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-300">
      <Surface className="p-5 sm:p-6 border border-base-300">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-primary/70">
              Runner Insights
            </p>
            <h2 className="mt-1 text-xl font-bold text-base-content">
              Metrics, skill, earning, dan reliability runner
            </h2>
          </div>
          <button
            type="button"
            onClick={onBack}
            className="btn h-10 min-h-10 rounded-[10px] border-none bg-base-200 px-5 text-sm font-bold text-base-content/70 shadow-none"
          >
            Kembali
          </button>
        </div>
      </Surface>

      <div className="grid gap-4 xl:grid-cols-[1fr_1fr]">
        <Surface className="p-4 sm:p-5">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-base-content/45">
            Skill Inventory
          </p>
          <div className="mt-3 space-y-2.5">
            {vm.skills.map((skill) => (
              <div key={skill.skill} className="rounded-[10px] border border-base-300/70 bg-base-100 p-3">
                <div className="mb-1.5 flex items-center justify-between gap-2">
                  <p className="text-sm font-semibold text-base-content">{skill.skill}</p>
                  <span className={cn("rounded-[8px] px-2 py-0.5 text-[11px] font-semibold", resolveRunnerSkillLevelClass(skill.level))}>
                    {skill.level}
                  </span>
                </div>
                <div className="flex flex-wrap items-center gap-2 text-xs text-base-content/65">
                  <span>{skill.pp}</span>
                  <span>|</span>
                  <span>Completion {skill.completionRate}</span>
                  <span>|</span>
                  <span>Trend {skill.trend}</span>
                </div>
              </div>
            ))}
          </div>
          <div className="mt-4 rounded-[10px] border border-base-300/70 bg-base-100 p-3">
            <p className="text-[11px] font-semibold uppercase tracking-[0.06em] text-base-content/55">
              Active Focus
            </p>
            <p className="mt-1 text-sm font-medium text-base-content/80">
              {vm.focus.description}
            </p>
          </div>
        </Surface>

        <Surface className="p-4 sm:p-5">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-base-content/45">
            Availability
          </p>
          <div className="mt-3 space-y-2">
            {vm.availability.map((slot) => (
              <div key={slot.day} className="rounded-[10px] border border-base-300/70 bg-base-100 p-3">
                <div className="mb-2 flex items-center justify-between gap-2">
                  <p className="text-sm font-semibold text-base-content">{slot.day}</p>
                  <span className="text-xs text-base-content/60">Pagi / Siang / Malam</span>
                </div>
                <div className="flex flex-wrap gap-2">
                  <span className={cn("rounded-[8px] px-2 py-1 text-[11px] font-semibold", resolveRunnerAvailabilityClass(slot.morning))}>
                    Pagi: {slot.morning}
                  </span>
                  <span className={cn("rounded-[8px] px-2 py-1 text-[11px] font-semibold", resolveRunnerAvailabilityClass(slot.afternoon))}>
                    Siang: {slot.afternoon}
                  </span>
                  <span className={cn("rounded-[8px] px-2 py-1 text-[11px] font-semibold", resolveRunnerAvailabilityClass(slot.night))}>
                    Malam: {slot.night}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </Surface>
      </div>

      <div className="grid gap-4 xl:grid-cols-[1.1fr_0.9fr]">
        <Surface className="p-4 sm:p-5">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-base-content/45">
            Earning Trajectory
          </p>
          <div className="mt-4 h-[300px] min-h-[300px] w-full min-w-0">
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={vm.earnings} margin={{ top: 8, right: 8, left: -20, bottom: 0 }}>
                <CartesianGrid stroke="rgba(148,163,184,0.15)" vertical={false} />
                <XAxis dataKey="period" tickLine={false} axisLine={false} tick={{ fill: "currentColor", fontSize: 12 }} />
                <YAxis tickLine={false} axisLine={false} tick={{ fill: "currentColor", fontSize: 12 }} />
                <Tooltip />
                <Line type="monotone" dataKey="income" stroke="#A046FF" strokeWidth={3} dot={{ r: 4, fill: "#A046FF" }} />
                <Line type="monotone" dataKey="quests" stroke="#38BDF8" strokeWidth={3} dot={{ r: 4, fill: "#38BDF8" }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
          <div className="mt-3 h-[190px] min-h-[190px] w-full min-w-0">
            <ResponsiveContainer width="100%" height={190}>
              <BarChart data={vm.earnings} margin={{ top: 8, right: 8, left: -20, bottom: 0 }}>
                <CartesianGrid stroke="rgba(148,163,184,0.15)" vertical={false} />
                <XAxis dataKey="period" tickLine={false} axisLine={false} tick={{ fill: "currentColor", fontSize: 11 }} />
                <YAxis tickLine={false} axisLine={false} tick={{ fill: "currentColor", fontSize: 11 }} />
                <Tooltip />
                <Bar dataKey="income" fill="#6B21FF" radius={[8, 8, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Surface>

        <Surface className="p-4 sm:p-5">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-base-content/45">
            Reliability + Roster
          </p>
          <div className="mt-3 space-y-2.5">
            {vm.badges.map((badge) => (
              <div key={badge.name} className="rounded-[10px] border border-base-300/70 bg-base-100 p-3">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm font-semibold text-base-content">{badge.name}</p>
                  <span className={cn("rounded-[8px] px-2 py-0.5 text-[11px] font-semibold", badge.tone)}>Active</span>
                </div>
                <p className="mt-1 text-xs text-base-content/65">{badge.description}</p>
              </div>
            ))}
          </div>

          <div className="mt-4 grid gap-3">
            {vm.members.map((member) => (
              <div key={member.name} className="rounded-[10px] border border-base-300/70 bg-base-100 p-3">
                <div className="mb-2 flex items-center justify-between gap-2">
                  <p className="text-sm font-semibold text-base-content">{member.name}</p>
                  <span className={cn("rounded-[8px] px-2 py-0.5 text-[11px] font-semibold", resolveRunnerMemberStatusClass(member.currentStatus))}>
                    {member.currentStatus}
                  </span>
                </div>
                <p className="text-xs text-base-content/65">{member.primarySkill}</p>
                <p className="mt-1 text-xs text-base-content/65">Area: {member.location}</p>
              </div>
            ))}
          </div>
        </Surface>
      </div>
    </div>
  );
}
