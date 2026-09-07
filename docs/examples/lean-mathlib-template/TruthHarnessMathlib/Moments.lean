import Mathlib

open scoped BigOperators

namespace TruthHarnessMathlib

-- Reuse the pinned library theorem rather than rebuilding Vandermonde theory.
theorem moment_coefficients_zero {m : Nat} (nodes coefficients : Fin m -> Rat)
    (distinct : Function.Injective nodes)
    (moments : forall k : Fin m,
      (Finset.univ.sum fun i : Fin m => coefficients i * nodes i ^ (k : Nat)) = 0) :
    coefficients = 0 := by
  exact Matrix.eq_zero_of_forall_pow_sum_mul_pow_eq_zero distinct moments

-- Independently restate the selected rational target, including its positive size.
example (m : Nat) (_positive : 0 < m) (u c : Fin m -> Rat)
    (hu : Function.Injective u)
    (hc : forall k : Fin m,
      (Finset.univ.sum fun i : Fin m => c i * u i ^ (k : Nat)) = 0) :
    forall i : Fin m, c i = 0 := by
  have h : c = 0 := moment_coefficients_zero u c hu hc
  intro i
  exact congrFun h i

theorem coincident_nodes_cancel :
    (forall k : Fin 2,
      (Finset.univ.sum fun i : Fin 2 =>
        (![1, -1] : Fin 2 -> Rat) i * (0 : Rat) ^ (k : Nat)) = 0) ∧
    (![1, -1] : Fin 2 -> Rat) ≠ 0 := by
  constructor
  · intro k
    simp [Fin.sum_univ_two]
  · intro h
    have h0 := congrFun h 0
    norm_num at h0

theorem one_moment_insufficient :
    Function.Injective (![0, 1] : Fin 2 -> Rat) ∧
    (Finset.univ.sum fun i : Fin 2 =>
      (![1, -1] : Fin 2 -> Rat) i * (![0, 1] : Fin 2 -> Rat) i ^ 0) = 0 ∧
    (![1, -1] : Fin 2 -> Rat) ≠ 0 := by
  constructor
  · intro i j hij
    fin_cases i <;> fin_cases j <;> norm_num at *
  · constructor
    · norm_num [Fin.sum_univ_two]
    · intro h
      have h0 := congrFun h 0
      norm_num at h0

/-- info: 'TruthHarnessMathlib.moment_coefficients_zero' depends on axioms: [propext, Classical.choice, Quot.sound] -/
#guard_msgs in
#print axioms moment_coefficients_zero

end TruthHarnessMathlib
