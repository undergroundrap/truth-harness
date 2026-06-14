namespace TruthHarnessFixture

theorem smoke : True := by
  trivial

theorem one_plus_one : 1 + 1 = 2 := by
  rfl

theorem implication_identity (p : Prop) : p -> p := by
  intro hp
  exact hp

end TruthHarnessFixture
