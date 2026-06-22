package giverquest

import "testing"

func TestRequiresTierReview(t *testing.T) {
	cases := []struct {
		name   string
		record *questRecord
		want   bool
	}{
		{name: "nil record", record: nil, want: false},
		{name: "auto classified", record: &questRecord{TierStatus: "auto_classified"}, want: false},
		{name: "admin verified", record: &questRecord{TierStatus: "admin_verified"}, want: false},
		{name: "overridden", record: &questRecord{TierStatus: "overridden"}, want: false},
		{name: "pending review", record: &questRecord{TierStatus: "pending_review"}, want: true},
		{name: "pending review case insensitive", record: &questRecord{TierStatus: " PENDING_REVIEW "}, want: true},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			got := requiresTierReview(tc.record)
			if got != tc.want {
				t.Fatalf("requiresTierReview() = %v, want %v", got, tc.want)
			}
		})
	}
}
