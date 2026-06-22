package admin

import (
	"strings"
	"testing"
)

func TestResolveDisputePenaltyAmounts(t *testing.T) {
	cases := []struct {
		name       string
		resolution string
		questTier  string
		wantPP     float64
		wantRisk   int
	}{
		{name: "runner loses Q1", resolution: "resolved_giver", questTier: "Q1", wantPP: -5, wantRisk: 3},
		{name: "runner loses Q2", resolution: "resolved_giver", questTier: "Q2", wantPP: -15, wantRisk: 8},
		{name: "runner loses Q3", resolution: "resolved_giver", questTier: "Q3", wantPP: -40, wantRisk: 20},
		{name: "giver loses Q2 risk only", resolution: "resolved_runner", questTier: "Q2", wantPP: 0, wantRisk: 8},
		{name: "dismissed flat risk", resolution: "dismissed", questTier: "Q3", wantPP: 0, wantRisk: 3},
		{name: "partial no penalty", resolution: "resolved_partial", questTier: "Q3", wantPP: 0, wantRisk: 0},
		{name: "unknown no penalty", resolution: "unknown", questTier: "Q3", wantPP: 0, wantRisk: 0},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			gotPP, gotRisk := resolveDisputePenaltyAmounts(tc.resolution, tc.questTier)
			if gotPP != tc.wantPP {
				t.Fatalf("PP penalty = %.2f, want %.2f", gotPP, tc.wantPP)
			}
			if gotRisk != tc.wantRisk {
				t.Fatalf("risk increase = %d, want %d", gotRisk, tc.wantRisk)
			}
		})
	}
}

func TestResolveAppliedPPPenaltyFloorsAtZero(t *testing.T) {
	cases := []struct {
		name      string
		currentPP float64
		requested float64
		want      float64
	}{
		{name: "normal penalty", currentPP: 100, requested: -40, want: -40},
		{name: "penalty capped by balance", currentPP: 10, requested: -15, want: -10},
		{name: "zero balance skipped", currentPP: 0, requested: -40, want: 0},
		{name: "positive delta rejected", currentPP: 100, requested: 5, want: 0},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			got := resolveAppliedPPPenalty(tc.currentPP, tc.requested)
			if got != tc.want {
				t.Fatalf("applied penalty = %.2f, want %.2f", got, tc.want)
			}
			nextPP := resolveNextRunnerPP(tc.currentPP, got)
			if nextPP < 0 {
				t.Fatalf("next PP = %.2f, must not be negative", nextPP)
			}
		})
	}
}

func TestResolveNextRiskScoreCapsAtHundred(t *testing.T) {
	cases := []struct {
		name        string
		current     int
		increment   int
		wantNext    int
		wantApplied int
	}{
		{name: "normal increase", current: 20, increment: 8, wantNext: 28, wantApplied: 8},
		{name: "cap at 100", current: 95, increment: 20, wantNext: 100, wantApplied: 5},
		{name: "already capped", current: 100, increment: 20, wantNext: 100, wantApplied: 0},
		{name: "negative current normalized", current: -4, increment: 3, wantNext: 3, wantApplied: 3},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			next, applied := resolveNextRiskScore(tc.current, tc.increment)
			if next != tc.wantNext {
				t.Fatalf("next risk = %d, want %d", next, tc.wantNext)
			}
			if applied != tc.wantApplied {
				t.Fatalf("applied increase = %d, want %d", applied, tc.wantApplied)
			}
		})
	}
}

func TestNormalizePenaltyTargetParty(t *testing.T) {
	record := &adminDisputeCaseRecord{
		GiverAuthUserID:    "giver-id",
		RunnerAuthUserID:   "runner-id",
		RaisedByAuthUserID: "runner-id",
		RaisedBy:           "",
	}
	if got := normalizePenaltyTargetParty(record); got != "runner" {
		t.Fatalf("target party = %q, want runner", got)
	}
}

func TestBuildPenaltyEventDescription(t *testing.T) {
	description := buildPenaltyEventDescription("resolved_giver", disputePenaltyResult{
		TargetParty:         "runner",
		QuestTier:           "Q2",
		AppliedPPPenalty:    -15,
		AppliedRiskIncrease: 8,
	})

	expectedParts := []string{
		"pp_penalty_applied",
		"resolution=resolved_giver",
		"target=runner",
		"quest_tier=Q2",
		"pp_delta=-15.00",
		"risk_increase=+8",
	}
	for _, part := range expectedParts {
		if !strings.Contains(description, part) {
			t.Fatalf("description %q missing %q", description, part)
		}
	}
}
