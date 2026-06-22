package runnertier

import (
	"strings"
	"testing"
	"time"

	questclassification "Stream-StrictMode/routes/quest-classification"
)

func TestBuildTierStatusIdentityGateBlocksQ2(t *testing.T) {
	status := BuildTierStatus(ProgressionDecisionInput{
		AuthUserID:         "runner-1",
		CurrentTier:        questclassification.TierQ1,
		RunnerPP:           700,
		RunnerSR:           3,
		Risk:               RiskAssessment{Score: 20, Band: RiskBandLow},
		IdentityApproved:   false,
		VerificationStatus: "submitted",
		Thresholds:         testThresholds(),
	})

	if status.EligibleTier != questclassification.TierQ1 {
		t.Fatalf("EligibleTier = %s, want Q1", status.EligibleTier)
	}
	if status.CanUpgradeQ2 {
		t.Fatal("CanUpgradeQ2 = true, want false without identity approval")
	}
	if !strings.Contains(status.BlockedReason, "identitas") {
		t.Fatalf("BlockedReason = %q, want identity gate reason", status.BlockedReason)
	}
}

func TestBuildTierStatusAllowsQ2AfterIdentityGate(t *testing.T) {
	status := BuildTierStatus(ProgressionDecisionInput{
		AuthUserID:         "runner-1",
		CurrentTier:        questclassification.TierQ1,
		RunnerPP:           700,
		RunnerSR:           3,
		Risk:               RiskAssessment{Score: 20, Band: RiskBandLow},
		IdentityApproved:   true,
		VerificationStatus: "approved",
		Thresholds:         testThresholds(),
	})

	if status.EligibleTier != questclassification.TierQ2 {
		t.Fatalf("EligibleTier = %s, want Q2", status.EligibleTier)
	}
	if !status.CanUpgradeQ2 {
		t.Fatal("CanUpgradeQ2 = false, want true")
	}
	if status.BlockedReason == "" {
		t.Fatal("expected Q3 next-step blocked reason")
	}
}

func TestBuildTierStatusAllowsQ3WhenRiskLow(t *testing.T) {
	status := BuildTierStatus(ProgressionDecisionInput{
		AuthUserID:         "runner-1",
		CurrentTier:        questclassification.TierQ2,
		RunnerPP:           2200,
		RunnerSR:           6.5,
		Risk:               RiskAssessment{Score: 18, Band: RiskBandLow},
		IdentityApproved:   true,
		VerificationStatus: "approved",
		Thresholds:         testThresholds(),
	})

	if status.EligibleTier != questclassification.TierQ3 {
		t.Fatalf("EligibleTier = %s, want Q3", status.EligibleTier)
	}
	if !status.CanUpgradeQ3 {
		t.Fatal("CanUpgradeQ3 = false, want true")
	}
	if status.BlockedReason != "" {
		t.Fatalf("BlockedReason = %q, want empty", status.BlockedReason)
	}
}

func TestBuildTierStatusBlocksQ3OnModerateRisk(t *testing.T) {
	status := BuildTierStatus(ProgressionDecisionInput{
		AuthUserID:         "runner-1",
		CurrentTier:        questclassification.TierQ2,
		RunnerPP:           2200,
		RunnerSR:           6.5,
		Risk:               RiskAssessment{Score: 45, Band: RiskBandModerate, RequiredStableQuestCount: 3},
		IdentityApproved:   true,
		VerificationStatus: "approved",
		Thresholds:         testThresholds(),
	})

	if status.EligibleTier != questclassification.TierQ2 {
		t.Fatalf("EligibleTier = %s, want Q2", status.EligibleTier)
	}
	if status.CanUpgradeQ3 {
		t.Fatal("CanUpgradeQ3 = true, want false for moderate risk")
	}
	if status.RequiredStableQuestCount != 3 {
		t.Fatalf("RequiredStableQuestCount = %d, want 3", status.RequiredStableQuestCount)
	}
	if !strings.Contains(status.BlockedReason, "risk assessment") {
		t.Fatalf("BlockedReason = %q, want risk reason", status.BlockedReason)
	}
}

func TestCalculateServiceReliabilityReachesQ3Threshold(t *testing.T) {
	sr := CalculateServiceReliability(2000, 2000, []RatingSnapshot{
		{Score: 5},
		{Score: 4.8},
	})

	if sr < 6 {
		t.Fatalf("SR = %.2f, want >= 6", sr)
	}
}

func TestCalculateRiskLowForStableHistory(t *testing.T) {
	createdAt := time.Now().Add(-90 * 24 * time.Hour)
	risk := CalculateRisk(RiskInput{
		AccountCreatedAt: &createdAt,
		Assignments: []AssignmentSnapshot{
			{Status: "finished"},
			{Status: "finished"},
			{Status: "finished"},
			{Status: "finished"},
			{Status: "finished"},
		},
		Ratings: []RatingSnapshot{
			{Score: 5},
			{Score: 4.8},
			{Score: 4.7},
			{Score: 4.9},
			{Score: 5},
		},
		Ledgers: []LedgerSnapshot{
			{PPDelta: 200, SkillScope: "delivery"},
			{PPDelta: 180, SkillScope: "event"},
			{PPDelta: 220, SkillScope: "repair"},
			{PPDelta: 240, SkillScope: "assistant"},
		},
		Thresholds: testThresholds(),
	})

	if risk.Band != RiskBandLow {
		t.Fatalf("Risk band = %s, want low (score %d)", risk.Band, risk.Score)
	}
	if risk.RequiredStableQuestCount != 0 {
		t.Fatalf("RequiredStableQuestCount = %d, want 0", risk.RequiredStableQuestCount)
	}
}

func TestCalculateRiskUsesVerificationRiskFloor(t *testing.T) {
	createdAt := time.Now().Add(-90 * 24 * time.Hour)
	risk := CalculateRisk(RiskInput{
		AccountCreatedAt: &createdAt,
		VerificationRisk: 72,
		Assignments: []AssignmentSnapshot{
			{Status: "finished"},
			{Status: "finished"},
			{Status: "finished"},
			{Status: "finished"},
			{Status: "finished"},
		},
		Ratings: []RatingSnapshot{
			{Score: 5},
			{Score: 5},
			{Score: 5},
		},
		Ledgers: []LedgerSnapshot{
			{PPDelta: 200, SkillScope: "delivery"},
			{PPDelta: 200, SkillScope: "event"},
			{PPDelta: 200, SkillScope: "repair"},
		},
		Thresholds: testThresholds(),
	})

	if risk.Band != RiskBandHigh {
		t.Fatalf("Risk band = %s, want high (score %d)", risk.Band, risk.Score)
	}
}

func testThresholds() ProgressionThresholds {
	return ProgressionThresholds{
		Q2MinPP:         500,
		Q3MinPP:         2000,
		Q3MinSR:         6,
		RiskLowMax:      30,
		RiskModerateMax: 60,
	}
}
