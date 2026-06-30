import Mathlib

namespace TruthHarnessMathlib

theorem finset_card_singleton_template (n : Nat) : ({n} : Finset Nat).card = 1 := by
  simp

theorem nat_add_comm_mathlib_template (a b : Nat) : a + b = b + a := by
  exact Nat.add_comm a b

theorem int_add_comm_mathlib_template (a b : Int) : a + b = b + a := by
  simpa using add_comm a b

theorem nat_le_add_right_mathlib_template (a b : Nat) : a <= a + b := by
  omega

theorem real_sq_nonneg_mathlib_template (x : Real) : 0 <= x ^ 2 := by
  positivity

end TruthHarnessMathlib
