package runnerquest

import "testing"

func TestEvaluateRunnerQuestTierAccess(t *testing.T) {
	cases := []struct {
		name       string
		runnerTier string
		questTier  string
		want       bool
	}{
		{name: "Q1 can apply Q1", runnerTier: "Q1", questTier: "Q1", want: true},
		{name: "Q1 cannot apply Q2", runnerTier: "Q1", questTier: "Q2", want: false},
		{name: "Q2 can apply Q1", runnerTier: "Q2", questTier: "Q1", want: true},
		{name: "Q2 cannot apply Q3", runnerTier: "Q2", questTier: "Q3", want: false},
		{name: "Q3 can apply Q3", runnerTier: "Q3", questTier: "Q3", want: true},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			got := evaluateRunnerQuestTierAccess(questRecord{
				QuestTier: tc.questTier,
			}, &runnerQuestMatchingContext{RunnerTier: tc.runnerTier})
			if got.Accessible != tc.want {
				t.Fatalf("Accessible = %v, want %v", got.Accessible, tc.want)
			}
			if got.Reason == "" {
				t.Fatal("expected access reason")
			}
		})
	}
}
