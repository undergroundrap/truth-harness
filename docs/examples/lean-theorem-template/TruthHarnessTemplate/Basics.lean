namespace TruthHarnessTemplate

theorem identity_implication (p : Prop) : p -> p := by
  intro hp
  exact hp

theorem and_commutative (p q : Prop) : p /\ q -> q /\ p := by
  intro hpq
  exact And.intro hpq.right hpq.left

theorem exists_self_nat (n : Nat) : Exists (fun m : Nat => m = n) := by
  exact Exists.intro n rfl

theorem nat_zero_add_template (n : Nat) : 0 + n = n := by
  exact Nat.zero_add n

theorem nat_add_zero_template (n : Nat) : n + 0 = n := by
  exact Nat.add_zero n

theorem equality_substitution_template {alpha : Sort u} {x y : alpha} (h : x = y) : y = x := by
  exact Eq.symm h

end TruthHarnessTemplate
