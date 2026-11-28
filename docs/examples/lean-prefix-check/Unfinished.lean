import Std

theorem prefix_range_sum (xs : List Int) (lo hi : Nat) (h : lo ≤ hi) :
    (xs.take hi).sum - (xs.take lo).sum = ((xs.drop lo).take (hi - lo)).sum := by
  sorry
