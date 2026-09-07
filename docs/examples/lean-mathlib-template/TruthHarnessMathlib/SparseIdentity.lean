import TruthHarnessMathlib.Moments

open scoped BigOperators

namespace TruthHarnessMathlib

theorem prime_encoding_coordinate {n : Nat} (p : Fin n -> Nat)
    (hp : forall i, Nat.Prime (p i)) (distinct : Function.Injective p)
    (d : Fin n -> Nat) (j : Fin n) :
    (∏ i, p i ^ d i).factorization (p j) = d j := by
  classical
  rw [Nat.factorization_prod (fun i _ => pow_ne_zero _ (hp i).ne_zero)]
  simp only [Finsupp.finset_sum_apply]
  simp_rw [Nat.Prime.factorization_pow (hp _)]
  simp [Finsupp.single_apply, distinct.eq_iff]

theorem prime_encoding_injective {n : Nat} (p : Fin n -> Nat)
    (hp : forall i, Nat.Prime (p i)) (distinct : Function.Injective p) :
    Function.Injective (fun d : Fin n →₀ Nat => (∏ i, p i ^ d i : Nat)) := by
  intro a b h
  ext j
  have hfac := congrArg (fun x : Nat => x.factorization (p j)) h
  simpa only [prime_encoding_coordinate p hp distinct] using hfac

theorem eval_prime_moments {n : Nat} (p : Fin n -> Nat)
    (f : MvPolynomial (Fin n) Rat) (k : Nat) :
    MvPolynomial.eval (fun i => (p i : Rat) ^ k) f =
      ∑ d ∈ f.support, f.coeff d * ((∏ i, p i ^ d i : Nat) : Rat) ^ k := by
  classical
  rw [MvPolynomial.eval_eq']
  apply Finset.sum_congr rfl
  intro d _
  congr 1
  simp only [Nat.cast_prod, Nat.cast_pow]
  rw [← Finset.prod_pow]
  apply Finset.prod_congr rfl
  intro i _
  simp only [← pow_mul, Nat.mul_comm]

theorem sparse_prime_identity {n t : Nat} (p : Fin n -> Nat)
    (hp : forall i, Nat.Prime (p i)) (distinct : Function.Injective p)
    (f : MvPolynomial (Fin n) Rat) (nonzero : f ≠ 0)
    (sparse : f.support.card ≤ t) :
    ∃ k : Nat, k < t ∧ MvPolynomial.eval (fun i => (p i : Rat) ^ k) f ≠ 0 := by
  classical
  by_contra! vanishes
  let e := f.support.equivFin.symm
  let nodes : Fin f.support.card -> Rat := fun i => (∏ j, p j ^ (e i).val j : Nat)
  let coefficients : Fin f.support.card -> Rat := fun i => f.coeff (e i).val
  have distinct_nodes : Function.Injective nodes := by
    intro i j h
    apply e.injective
    apply Subtype.ext
    apply prime_encoding_injective p hp distinct
    dsimp [nodes] at h
    exact_mod_cast h
  have moments : forall k : Fin f.support.card,
      (∑ i, coefficients i * nodes i ^ (k : Nat)) = 0 := by
    intro k
    have hz := vanishes k.val (lt_of_lt_of_le k.isLt sparse)
    rw [eval_prime_moments] at hz
    change (∑ i, (fun d : {d // d ∈ f.support} =>
      f.coeff d.val * ((∏ j, p j ^ d.val j : Nat) : Rat) ^ k.val) (e i)) = 0
    calc
      _ = ∑ d : {d // d ∈ f.support},
          f.coeff d.val * ((∏ j, p j ^ d.val j : Nat) : Rat) ^ k.val := e.sum_comp _
      _ = 0 := by
        change (∑ d ∈ f.support.attach,
          f.coeff d.val * ((∏ j, p j ^ d.val j : Nat) : Rat) ^ k.val) = 0
        exact (Finset.sum_attach f.support (fun d =>
          f.coeff d * ((∏ j, p j ^ d j : Nat) : Rat) ^ k.val)).trans hz
  have all_zero := moment_coefficients_zero nodes coefficients distinct_nodes moments
  obtain ⟨d, hd⟩ := MvPolynomial.support_nonempty.mpr nonzero
  have hd_zero := congrFun all_zero (e.symm ⟨d, hd⟩)
  have : f.coeff d = 0 := by simpa [coefficients] using hd_zero
  exact (MvPolynomial.mem_support_iff.mp hd) this

-- Independently restate M2 with the positive variable and sample-count hypotheses.
example (n t : Nat) (_hn : 0 < n) (_ht : 0 < t)
    (primes : Fin n -> Nat) (prime : forall j, Nat.Prime (primes j))
    (pairwise_distinct : Function.Injective primes)
    (poly : MvPolynomial (Fin n) Rat) (nonzero : poly ≠ 0)
    (support_bound : poly.support.card ≤ t) :
    ∃ sample : Nat, sample < t ∧
      MvPolynomial.eval (fun j => (primes j : Rat) ^ sample) poly ≠ 0 := by
  exact sparse_prime_identity primes prime pairwise_distinct poly nonzero support_bound

theorem repeated_primes_fail :
    (MvPolynomial.X (0 : Fin 2) - MvPolynomial.X 1 : MvPolynomial (Fin 2) Rat) ≠ 0 ∧
    (forall k : Nat, MvPolynomial.eval (fun _ : Fin 2 => (2 : Rat) ^ k)
      (MvPolynomial.X 0 - MvPolynomial.X 1) = 0) := by
  constructor
  · intro h
    have he := congrArg (MvPolynomial.eval (![0, 1] : Fin 2 -> Rat)) h
    norm_num at he
  · intro k
    simp

theorem nonprime_bases_fail :
    (MvPolynomial.X (0 : Fin 2) ^ 2 - MvPolynomial.X 1 : MvPolynomial (Fin 2) Rat) ≠ 0 ∧
    (forall k : Nat, MvPolynomial.eval (fun i => (![2, 4] : Fin 2 -> Rat) i ^ k)
      (MvPolynomial.X 0 ^ 2 - MvPolynomial.X 1) = 0) := by
  constructor
  · intro h
    have he := congrArg (MvPolynomial.eval (![0, 1] : Fin 2 -> Rat)) h
    norm_num at he
  · intro k
    simp only [map_sub, map_pow, MvPolynomial.eval_X, Matrix.cons_val_zero,
      Matrix.cons_val_one, Matrix.head_cons]
    rw [show (4 : Rat) = 2 ^ 2 by norm_num]
    simp [← pow_mul, Nat.mul_comm]

theorem two_samples_insufficient :
    ((MvPolynomial.X (0 : Fin 1) - 1) * (MvPolynomial.X 0 - MvPolynomial.C 2) :
      MvPolynomial (Fin 1) Rat) ≠ 0 ∧
    (forall k : Nat, k < 2 -> MvPolynomial.eval (fun _ : Fin 1 => (2 : Rat) ^ k)
      ((MvPolynomial.X 0 - 1) * (MvPolynomial.X 0 - MvPolynomial.C 2)) = 0) := by
  constructor
  · intro h
    have he := congrArg (MvPolynomial.eval (fun _ : Fin 1 => (3 : Rat))) h
    norm_num at he
  · intro k hk
    interval_cases k <;> norm_num

/-- info: 'TruthHarnessMathlib.sparse_prime_identity' depends on axioms: [propext, Classical.choice, Quot.sound] -/
#guard_msgs in
#print axioms sparse_prime_identity

end TruthHarnessMathlib
