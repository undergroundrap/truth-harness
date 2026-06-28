import Mathlib

namespace TruthHarnessMathlib

theorem finset_card_singleton_template (n : Nat) : ({n} : Finset Nat).card = 1 := by
  simp

theorem nat_add_comm_mathlib_template (a b : Nat) : a + b = b + a := by
  exact Nat.add_comm a b

end TruthHarnessMathlib
