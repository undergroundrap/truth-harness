import Std

theorem prefix_range_sum (xs : List Int) (lo hi : Nat) (h : lo ≤ hi) :
    (xs.take hi).sum - (xs.take lo).sum = ((xs.drop lo).take (hi - lo)).sum := by
  have split : xs.take hi = xs.take lo ++ (xs.drop lo).take (hi - lo) := by
    simpa only [Nat.add_sub_of_le h] using
      (List.take_add (l := xs) (i := lo) (j := hi - lo))
  rw [split, List.sum_append]
  omega
