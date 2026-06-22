package questclassification

import "testing"

func TestRuleBasedClassifierResolvesQ1(t *testing.T) {
	classifier := NewRuleBasedClassifier()
	result := classifier.Classify(ClassificationInput{
		ContractType:     ContractOneOff,
		ReqEducation:     ReqNone,
		ReqPortfolio:     ReqNone,
		ReqIdentityLevel: IdentityBasic,
		RewardAmount:     200000,
	})

	if result.Tier != TierQ1 {
		t.Fatalf("expected tier %s, got %s", TierQ1, result.Tier)
	}
	if result.Score != 1 {
		t.Fatalf("expected score 1, got %d", result.Score)
	}
	if result.Status != StatusAutoClassified {
		t.Fatalf("expected status %s, got %s", StatusAutoClassified, result.Status)
	}
}

func TestRuleBasedClassifierResolvesQ2(t *testing.T) {
	duration := 7
	classifier := NewRuleBasedClassifier()
	result := classifier.Classify(ClassificationInput{
		ContractType:         ContractFixedTerm,
		ContractDurationDays: &duration,
		ReqEducation:         ReqPreferred,
		ReqPortfolio:         ReqNone,
		ReqIdentityLevel:     IdentityBasic,
		RewardAmount:         100000,
	})

	if result.Tier != TierQ2 {
		t.Fatalf("expected tier %s, got %s", TierQ2, result.Tier)
	}
	if result.Score != 5 {
		t.Fatalf("expected score 5, got %d", result.Score)
	}
	if result.Status != StatusAutoClassified {
		t.Fatalf("expected status %s, got %s", StatusAutoClassified, result.Status)
	}
}

func TestRuleBasedClassifierResolvesQ3AndFlagsBorder(t *testing.T) {
	duration := 30
	classifier := NewRuleBasedClassifier()
	result := classifier.Classify(ClassificationInput{
		ContractType:         ContractLongTerm,
		ContractDurationDays: &duration,
		ReqEducation:         ReqRequired,
		ReqEducationDetail:   "S1 Hukum",
		ReqPortfolio:         ReqNone,
		ReqIdentityLevel:     IdentityBasic,
		RewardAmount:         100000,
	})

	if result.Tier != TierQ3 {
		t.Fatalf("expected tier %s, got %s", TierQ3, result.Tier)
	}
	if result.Score != 9 {
		t.Fatalf("expected score 9, got %d", result.Score)
	}
	if result.Status != StatusPendingReview {
		t.Fatalf("expected status %s, got %s", StatusPendingReview, result.Status)
	}
	if len(result.Flags) == 0 {
		t.Fatal("expected pending review flags")
	}
}

func TestRuleBasedClassifierFlagsContradictoryOneOffFullDocs(t *testing.T) {
	classifier := NewRuleBasedClassifier()
	result := classifier.Classify(ClassificationInput{
		ContractType:     ContractOneOff,
		ReqEducation:     ReqNone,
		ReqPortfolio:     ReqNone,
		ReqIdentityLevel: IdentityFullDocs,
		RewardAmount:     50000,
	})

	if result.Status != StatusPendingReview {
		t.Fatalf("expected status %s, got %s", StatusPendingReview, result.Status)
	}
	if result.Tier != TierQ2 {
		t.Fatalf("expected tier %s from full_docs score, got %s", TierQ2, result.Tier)
	}
}

func TestCanRunnerAccessQuestTier(t *testing.T) {
	cases := []struct {
		name       string
		runnerTier string
		questTier  string
		want       bool
	}{
		{name: "Q1 can access Q1", runnerTier: TierQ1, questTier: TierQ1, want: true},
		{name: "Q1 cannot access Q2", runnerTier: TierQ1, questTier: TierQ2, want: false},
		{name: "Q1 cannot access Q3", runnerTier: TierQ1, questTier: TierQ3, want: false},
		{name: "Q2 can access Q1", runnerTier: TierQ2, questTier: TierQ1, want: true},
		{name: "Q2 can access Q2", runnerTier: TierQ2, questTier: TierQ2, want: true},
		{name: "Q2 cannot access Q3", runnerTier: TierQ2, questTier: TierQ3, want: false},
		{name: "Q3 can access Q3", runnerTier: TierQ3, questTier: TierQ3, want: true},
		{name: "blank runner defaults Q1", runnerTier: "", questTier: TierQ2, want: false},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			got := CanRunnerAccessQuestTier(tc.runnerTier, tc.questTier)
			if got != tc.want {
				t.Fatalf("CanRunnerAccessQuestTier(%q, %q) = %v, want %v", tc.runnerTier, tc.questTier, got, tc.want)
			}
		})
	}
}
