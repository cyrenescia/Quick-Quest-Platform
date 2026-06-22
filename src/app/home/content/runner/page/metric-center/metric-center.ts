export type MetricSummaryVM = {
  runnerTier: string;
  runnerPP: number;
  runnerSR: number;
  topSkill: string;
};

export type MetricLedgerVM = {
  id: string;
  questId: string;
  skillScope: string;
  basePP: number;
  multiplier: number;
  bonus: number;
  decay: number;
  finalPP: number;
  createdAt: string;
};
