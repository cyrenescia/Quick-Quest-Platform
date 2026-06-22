package quest

import "testing"

func TestEvaluateQuestTierAccess(t *testing.T) {
	cases := []struct {
		name       string
		runnerTier string
		questTier  string
		tierStatus string
		accessible bool
	}{
		{name: "Q1 can see Q1", runnerTier: "Q1", questTier: "Q1", tierStatus: "auto_classified", accessible: true},
		{name: "Q1 cannot see Q2", runnerTier: "Q1", questTier: "Q2", tierStatus: "auto_classified", accessible: false},
		{name: "Q2 can see Q2", runnerTier: "Q2", questTier: "Q2", tierStatus: "auto_classified", accessible: true},
		{name: "Q2 cannot see Q3", runnerTier: "Q2", questTier: "Q3", tierStatus: "auto_classified", accessible: false},
		{name: "Q3 can see Q3", runnerTier: "Q3", questTier: "Q3", tierStatus: "auto_classified", accessible: true},
		{name: "pending review stays hidden", runnerTier: "Q3", questTier: "Q1", tierStatus: "pending_review", accessible: false},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			got := evaluateQuestTierAccess(questRecord{
				QuestTier:  tc.questTier,
				TierStatus: tc.tierStatus,
			}, &questMatchingContext{RunnerTier: tc.runnerTier})
			if got.Accessible != tc.accessible {
				t.Fatalf("Accessible = %v, want %v", got.Accessible, tc.accessible)
			}
			if got.Reason == "" {
				t.Fatal("expected access reason")
			}
		})
	}
}
