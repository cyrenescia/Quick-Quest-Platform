package rating

import (
	"math"
	"testing"
	"time"
)

func TestTierMultiplier(t *testing.T) {
	cases := []struct {
		tier string
		want float64
	}{
		{tier: "Q1", want: 1.0},
		{tier: "Q2", want: 1.5},
		{tier: "Q3", want: 2.5},
		{tier: "", want: 1.0},
	}

	for _, tc := range cases {
		t.Run(tc.tier, func(t *testing.T) {
			assertFloatEqual(t, tierMultiplier(tc.tier), tc.want)
		})
	}
}

func TestChallengeBonus(t *testing.T) {
	cases := []struct {
		name       string
		runnerTier string
		questTier  string
		want       float64
	}{
		{name: "same tier", runnerTier: "Q2", questTier: "Q2", want: 1.0},
		{name: "one above", runnerTier: "Q1", questTier: "Q2", want: 1.2},
		{name: "two above", runnerTier: "Q1", questTier: "Q3", want: 1.5},
		{name: "below tier", runnerTier: "Q3", questTier: "Q1", want: 0.6},
		{name: "default runner tier", runnerTier: "", questTier: "Q1", want: 1.0},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			assertFloatEqual(t, challengeBonus(tc.runnerTier, tc.questTier), tc.want)
		})
	}
}

func TestValueMultiplier(t *testing.T) {
	cases := []struct {
		name   string
		reward float64
		want   float64
	}{
		{name: "under 100k", reward: 50000, want: 0.8},
		{name: "150k", reward: 150000, want: 1.0},
		{name: "750k", reward: 750000, want: 1.1},
		{name: "3m", reward: 3000000, want: 1.3},
		{name: "6m", reward: 6000000, want: 1.5},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			assertFloatEqual(t, valueMultiplier(tc.reward), tc.want)
		})
	}
}

func TestTimeDecayFactor(t *testing.T) {
	now := time.Now()
	cases := []struct {
		name       string
		finishedAt *time.Time
		want       float64
	}{
		{name: "nil", finishedAt: nil, want: 1.0},
		{name: "two days", finishedAt: timePtr(now.Add(-48 * time.Hour)), want: 1.0},
		{name: "five days", finishedAt: timePtr(now.Add(-5 * 24 * time.Hour)), want: 0.97},
		{name: "ten days", finishedAt: timePtr(now.Add(-10 * 24 * time.Hour)), want: 0.93},
		{name: "twenty days", finishedAt: timePtr(now.Add(-20 * 24 * time.Hour)), want: 0.88},
		{name: "sixty days", finishedAt: timePtr(now.Add(-60 * 24 * time.Hour)), want: 0.80},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			assertFloatEqual(t, timeDecayFactor(tc.finishedAt), tc.want)
		})
	}
}

func TestComputeWeightedPPQ2Example(t *testing.T) {
	finishedAt := time.Now().Add(-48 * time.Hour)
	got := computeWeightedPP(ppWeightedInput{
		RatingScore:  4.5,
		QuestTier:    "Q2",
		RunnerTier:   "Q1",
		RewardAmount: 750000,
		FinishedAt:   &finishedAt,
	})

	assertFloatEqual(t, got.BasePP, 90)
	assertFloatEqual(t, got.TierMultiplier, 1.5)
	assertFloatEqual(t, got.ChallengeBonus, 1.2)
	assertFloatEqual(t, got.ValueMultiplier, 1.1)
	assertFloatEqual(t, got.TimeDecay, 1.0)
	assertFloatEqual(t, got.PPDelta, 178.2)
	if got.MinPPFloorApplied {
		t.Fatal("MinPPFloorApplied = true, want false")
	}
}

func TestComputeWeightedPPFarmingGuard(t *testing.T) {
	finishedAt := time.Now().Add(-60 * 24 * time.Hour)
	got := computeWeightedPP(ppWeightedInput{
		RatingScore:  5,
		QuestTier:    "Q1",
		RunnerTier:   "Q3",
		RewardAmount: 50000,
		FinishedAt:   &finishedAt,
	})

	assertFloatEqual(t, got.ChallengeBonus, 0.6)
	assertFloatEqual(t, got.ValueMultiplier, 0.8)
	assertFloatEqual(t, got.TimeDecay, 0.80)
	assertFloatEqual(t, got.PPDelta, 38.4)
}

func TestComputeWeightedPPDefaults(t *testing.T) {
	got := computeWeightedPP(ppWeightedInput{
		RatingScore:  4,
		QuestTier:    "",
		RunnerTier:   "",
		RewardAmount: 0,
		FinishedAt:   nil,
	})

	assertFloatEqual(t, got.TierMultiplier, 1.0)
	assertFloatEqual(t, got.ChallengeBonus, 1.0)
	assertFloatEqual(t, got.ValueMultiplier, 0.8)
	assertFloatEqual(t, got.TimeDecay, 1.0)
	assertFloatEqual(t, got.PPDelta, 64)
}

func timePtr(value time.Time) *time.Time {
	return &value
}

func assertFloatEqual(t *testing.T, got float64, want float64) {
	t.Helper()
	if math.Abs(got-want) > 0.001 {
		t.Fatalf("got %.4f, want %.4f", got, want)
	}
}
