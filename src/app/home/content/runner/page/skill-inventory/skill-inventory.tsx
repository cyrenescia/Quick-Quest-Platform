import { useEffect, useState } from "react";
import { cn, Surface } from "../../../../home.ui";
import { fetchSkillInventory } from "./skill-inventory.service";
import type { SkillInventoryItemVM } from "./skill-inventory";

export function SkillInventoryPage({ onBack }: { onBack: () => void }) {
  const [skills, setSkills] = useState<SkillInventoryItemVM[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetchSkillInventory().then((res) => {
      if (res && res.skills) {
        const totalPP = res.skills.reduce((sum: number, s: any) => sum + (s.total_pp || 0), 0);
        const mapped = res.skills.map((s: any, index: number) => ({
          skill: s.skill_scope || "General",
          totalPP: s.total_pp || 0,
          percentage: totalPP > 0 ? ((s.total_pp || 0) / totalPP) * 100 : 0,
          questCount: s.quest_count || 0,
          avgRating: s.avg_rating || 0,
          lastEarnedAt: s.last_earned_at ? new Date(s.last_earned_at).toLocaleDateString() : "-",
          isTopSkill: index === 0, // Backend already sorts by highest PP
        }));
        setSkills(mapped);
      }
      setIsLoading(false);
    }).catch(() => setIsLoading(false));
  }, []);

  return (
    <div className="space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-300">
      <Surface className="p-5 sm:p-6 border border-base-300">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-primary/70">
              Skill Inventory
            </p>
            <h2 className="mt-1 text-xl font-bold text-base-content">
              Distribusi Penguasaan Skill
            </h2>
          </div>
          <button
            type="button"
            onClick={onBack}
            className="btn h-10 min-h-10 rounded-[10px] border-none bg-base-200 px-5 text-sm font-bold text-base-content/70 shadow-none hover:bg-base-300 transition-colors"
          >
            Kembali
          </button>
        </div>
      </Surface>

      {isLoading ? (
        <Surface className="p-8 text-center text-sm text-base-content/50">
          Loading skill inventory...
        </Surface>
      ) : skills.length === 0 ? (
        <Surface className="p-8 text-center text-sm text-base-content/50">
          Belum ada data penguasaan skill.
        </Surface>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {skills.map((item) => (
            <div
              key={item.skill}
              className="group relative overflow-hidden rounded-[14px] border border-base-300/50 bg-base-100/40 p-5 shadow-sm backdrop-blur-xl transition-all duration-300 hover:-translate-y-1 hover:border-primary/30 hover:shadow-lg"
            >
              <div className="flex items-start justify-between gap-2">
                <div>
                  <h3 className="font-bold text-base-content text-lg">
                    {item.skill}
                  </h3>
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-base-content/50 mt-1">
                    Total {item.questCount} Quest
                  </p>
                </div>
                {item.isTopSkill && (
                  <span className="rounded-full bg-[#A046FF]/10 px-2.5 py-0.5 text-[10px] font-bold text-[#A046FF]">
                    Top Skill
                  </span>
                )}
              </div>

              <div className="mt-5">
                <div className="flex items-end justify-between mb-2">
                  <span className="text-2xl font-bold text-base-content">
                    {item.totalPP.toFixed(1)} <span className="text-sm font-semibold text-base-content/50">PP</span>
                  </span>
                  <span className="text-sm font-bold text-primary">
                    {item.percentage.toFixed(1)}%
                  </span>
                </div>
                <div className="h-2 w-full rounded-full bg-base-200 overflow-hidden">
                  <div
                    className={cn(
                      "h-full rounded-full",
                      item.isTopSkill ? "bg-[#A046FF]" : "bg-primary"
                    )}
                    style={{ width: `${item.percentage}%` }}
                  />
                </div>
              </div>

              <div className="mt-5 pt-4 border-t border-base-300/50 flex items-center justify-between text-xs text-base-content/60 font-medium">
                <span>Avg Rating: ★ {item.avgRating.toFixed(1)}</span>
                <span>Update: {item.lastEarnedAt}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
