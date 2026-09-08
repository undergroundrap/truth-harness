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

namespace DivideConquer

def closedCount (h : Nat) : Int := ((h : Int) - 1) * 2 ^ h + 1

theorem closedCount_step (h : Nat) :
    closedCount (h + 1) = 2 * closedCount h + 2 ^ (h + 1) - 1 := by
  have hc : ((h + 1 : Nat) : Int) = (h : Int) + 1 := by omega
  have hm : (h : Int) * (2 ^ h * 2) = 2 * ((h : Int) * 2 ^ h) := by
    rw [<- Int.mul_assoc, Int.mul_comm _ 2]
  dsimp [closedCount]
  rw [hc, Int.pow_succ]
  simp only [Int.add_sub_cancel, Int.sub_mul, Int.one_mul, Int.mul_add, Int.mul_sub]
  omega

theorem firstOrder_closed_form (A : Nat -> Int) (ha0 : A 0 = 0)
    (hf : firstOrder A) : forall h, A h = closedCount h := by
  intro h
  induction h with
  | zero => simp [closedCount, ha0]
  | succ h ih =>
    calc
      A (h + 1) = 2 * A h + 2 ^ (h + 1) - 1 := hf h
      _ = 2 * closedCount h + 2 ^ (h + 1) - 1 := by rw [ih]
      _ = closedCount (h + 1) := (closedCount_step h).symm

theorem closedCount_realizes_model :
    closedCount 0 = 0 /\ closedCount 1 = 1 /\ secondOrder closedCount :=
  And.intro (by decide) (And.intro (by decide) (first_to_second closedCount closedCount_step))

theorem tempting_candidate_false :
    Not (forall h : Nat, (h : Int) * 2 ^ h = closedCount h) := by
  intro hf
  have bad := hf 1
  simp [closedCount] at bad

end DivideConquer

-- The public target spells out both the recurrence and the answer.
theorem divide_conquer_closed_form (A : Nat -> Int) (ha0 : A 0 = 0) (ha1 : A 1 = 1)
    (hs : forall h, A (h + 2) = 4 * A (h + 1) - 4 * A h + 1) :
    forall h, A h = ((h : Int) - 1) * 2 ^ h + 1 :=
  DivideConquer.firstOrder_closed_form A ha0 (DivideConquer.second_to_first A ha0 ha1 hs)

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

/-- info: 'divide_conquer_closed_form' depends on axioms: [propext, Quot.sound] -/
#guard_msgs in
#print axioms divide_conquer_closed_form

/-- info: 'DivideConquer.tempting_candidate_false' depends on axioms: [propext] -/
#guard_msgs in
#print axioms DivideConquer.tempting_candidate_false

namespace DivideConquer

def costFamily (leaf slope extra : Int) (h : Nat) : Int :=
  (leaf + extra + slope * (h : Int)) * 2 ^ h - extra

theorem costFamily_step (leaf slope extra : Int) (h : Nat) :
    costFamily leaf slope extra (h + 1) =
      2 * costFamily leaf slope extra h + slope * 2 ^ (h + 1) + extra := by
  have hc : ((h + 1 : Nat) : Int) = (h : Int) + 1 := by omega
  have hg : leaf + extra + slope * ((h : Int) + 1) =
      (leaf + extra + slope * (h : Int)) + slope := by
    rw [Int.mul_add, Int.mul_one]
    omega
  have hm : (leaf + extra + slope * (h : Int)) * (2 ^ h * 2) =
      2 * ((leaf + extra + slope * (h : Int)) * 2 ^ h) := by
    rw [<- Int.mul_assoc, Int.mul_comm _ 2]
  dsimp [costFamily]
  rw [hc, Int.pow_succ, hg, Int.add_mul]
  omega

theorem costFamily_initial (leaf slope extra : Int) : costFamily leaf slope extra 0 = leaf := by
  simp [costFamily]

theorem costFamily_solution (A : Nat -> Int) (leaf slope extra : Int)
    (ha0 : A 0 = leaf)
    (hs : forall h, A (h + 1) = 2 * A h + slope * 2 ^ (h + 1) + extra) :
    forall h, A h = costFamily leaf slope extra h := by
  intro h
  induction h with
  | zero => rw [ha0, costFamily_initial]
  | succ h ih =>
    calc
      A (h + 1) = 2 * A h + slope * 2 ^ (h + 1) + extra := hs h
      _ = 2 * costFamily leaf slope extra h + slope * 2 ^ (h + 1) + extra := by rw [ih]
      _ = costFamily leaf slope extra (h + 1) := (costFamily_step leaf slope extra h).symm

end DivideConquer

-- Integer parameters are algebraic costs, not automatically physical counts.
theorem divide_conquer_cost_family (A : Nat -> Int) (leaf slope extra : Int)
    (ha0 : A 0 = leaf)
    (hs : forall h, A (h + 1) = 2 * A h + slope * 2 ^ (h + 1) + extra) :
    forall h, A h = (leaf + extra + slope * (h : Int)) * 2 ^ h - extra :=
  DivideConquer.costFamily_solution A leaf slope extra ha0 hs

theorem divide_conquer_merge_specialization (A : Nat -> Int) (ha0 : A 0 = 0)
    (hs : forall h, A (h + 1) = 2 * A h + 2 ^ (h + 1) - 1) :
    forall h, A h = ((h : Int) - 1) * 2 ^ h + 1 := by
  have hf : forall h, A (h + 1) = 2 * A h + (1 : Int) * 2 ^ (h + 1) + (-1) := by
    intro h
    have hr := hs h
    omega
  intro h
  have result := divide_conquer_cost_family A 0 1 (-1) ha0 hf h
  have hc : (0 : Int) + (-1) + 1 * (h : Int) = (h : Int) - 1 := by omega
  rw [hc] at result
  simpa using result

theorem divide_conquer_constant_specialization (A : Nat -> Int) (ha0 : A 0 = 3)
    (hs : forall h, A (h + 1) = 2 * A h + 5) :
    forall h, A h = 8 * 2 ^ h - 5 := by
  have hf : forall h, A (h + 1) = 2 * A h + (0 : Int) * 2 ^ (h + 1) + 5 := by
    simpa using hs
  intro h
  simpa using divide_conquer_cost_family A 3 0 5 ha0 hf h

/-- info: 'divide_conquer_cost_family' depends on axioms: [propext, Quot.sound] -/
#guard_msgs in
#print axioms divide_conquer_cost_family

/-- info: 'divide_conquer_merge_specialization' depends on axioms: [propext, Quot.sound] -/
#guard_msgs in
#print axioms divide_conquer_merge_specialization

/-- info: 'divide_conquer_constant_specialization' depends on axioms: [propext, Quot.sound] -/
#guard_msgs in
#print axioms divide_conquer_constant_specialization
