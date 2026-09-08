import Std

namespace DivideConquer

def firstOrder (A : Nat -> Int) : Prop :=
  forall h, A (h + 1) = 2 * A h + 2 ^ (h + 1) - 1

def secondOrder (A : Nat -> Int) : Prop :=
  forall h, A (h + 2) = 4 * A (h + 1) - 4 * A h + 1

theorem power_step (h : Nat) :
    (2 : Int) ^ (h + 1 + 1) = 2 * 2 ^ (h + 1) := by
  rw [Int.pow_succ]
  omega

theorem first_to_second (A : Nat -> Int) (hf : firstOrder A) : secondOrder A := by
  intro h
  have h0 := hf h
  have h1 := hf (h + 1)
  have hp := power_step h
  simp only [Nat.add_assoc, Int.pow_succ, Nat.reduceAdd] at *
  omega

theorem second_to_first (A : Nat -> Int) (ha0 : A 0 = 0) (ha1 : A 1 = 1)
    (hs : secondOrder A) : firstOrder A := by
  intro h
  induction h with
  | zero => simp [ha0, ha1]
  | succ h ih =>
    have hr := hs h
    have hp := power_step h
    simp only [Nat.add_assoc, Int.pow_succ, Nat.reduceAdd] at *
    omega

theorem reduction_iff (A : Nat -> Int) (ha0 : A 0 = 0) (ha1 : A 1 = 1) :
    secondOrder A <-> firstOrder A :=
  Iff.intro (second_to_first A ha0 ha1) (first_to_second A)

theorem missing_second_initial_fails :
    exists A : Nat -> Int, A 0 = 0 /\ secondOrder A /\ Not (firstOrder A) := by
  apply Exists.intro (fun h => 1 - 2 ^ h)
  constructor
  · decide
  constructor
  · intro h
    have hp2 := power_step h
    dsimp
    simp only [Nat.add_assoc, Int.pow_succ, Nat.reduceAdd] at *
    omega
  · intro hf
    have bad := hf 0
    simp at bad

end DivideConquer

-- Restate the target independently of the named recurrence definitions.
theorem divide_conquer_reduction (A : Nat -> Int) (ha0 : A 0 = 0) (ha1 : A 1 = 1) :
    (forall h, A (h + 2) = 4 * A (h + 1) - 4 * A h + 1) <->
      (forall h, A (h + 1) = 2 * A h + 2 ^ (h + 1) - 1) :=
  DivideConquer.reduction_iff A ha0 ha1

/-- info: 'divide_conquer_reduction' depends on axioms: [propext, Quot.sound] -/
#guard_msgs in
#print axioms divide_conquer_reduction

/-- info: 'DivideConquer.missing_second_initial_fails' depends on axioms: [propext, Quot.sound] -/
#guard_msgs in
#print axioms DivideConquer.missing_second_initial_fails
