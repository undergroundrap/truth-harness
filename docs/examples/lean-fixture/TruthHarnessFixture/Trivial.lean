namespace TruthHarnessFixture

theorem smoke : True := by
  trivial

theorem one_plus_one : 1 + 1 = 2 := by
  rfl

theorem implication_identity (p : Prop) : p -> p := by
  intro hp
  exact hp

theorem modus_ponens (p q : Prop) : (p -> q) -> p -> q := by
  intro hpq hp
  exact hpq hp

theorem and_swap (p q : Prop) : p ∧ q -> q ∧ p := by
  intro hpq
  exact And.intro hpq.right hpq.left

theorem equality_reflexive {alpha : Sort u} (x : alpha) : x = x := by
  rfl

theorem nat_zero_add (n : Nat) : 0 + n = n := by
  rfl

theorem nat_add_zero (n : Nat) : n + 0 = n := by
  exact Nat.add_zero n

end TruthHarnessFixture
