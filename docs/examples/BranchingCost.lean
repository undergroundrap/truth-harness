import Std

namespace BranchingCost

def geometricSum (branch : Int) : Nat -> Int
  | 0 => 0
  | h + 1 => geometricSum branch h + branch ^ h

theorem geometricSum_step (branch : Int) (h : Nat) :
    geometricSum branch (h + 1) = branch * geometricSum branch h + 1 := by
  induction h with
  | zero => simp [geometricSum, Int.pow_zero]
  | succ h ih =>
    simp only [geometricSum] at *
    rw [Int.mul_add, Int.pow_succ, Int.mul_comm (branch ^ h) branch]
    omega

def cost (branch leaf slope extra : Int) (h : Nat) : Int :=
  (leaf + slope * (h : Int)) * branch ^ h + extra * geometricSum branch h

theorem cost_initial (branch leaf slope extra : Int) : cost branch leaf slope extra 0 = leaf := by
  simp [cost, geometricSum, Int.pow_zero]

theorem cost_step (branch leaf slope extra : Int) (h : Nat) :
    cost branch leaf slope extra (h + 1) =
      branch * cost branch leaf slope extra h + slope * branch ^ (h + 1) + extra := by
  have hc : ((h + 1 : Nat) : Int) = (h : Int) + 1 := by omega
  simp only [cost, hc, geometricSum_step, Int.pow_succ, Int.mul_add, Int.add_mul, Int.mul_one]
  ac_rfl

end BranchingCost

-- Integer algebra; physical equal-split models require their own justification.
theorem divide_conquer_branching_cost (A : Nat -> Int) (branch leaf slope extra : Int)
    (ha0 : A 0 = leaf)
    (hs : forall h, A (h + 1) = branch * A h + slope * branch ^ (h + 1) + extra) :
    forall h, A h = (leaf + slope * (h : Int)) * branch ^ h + extra * BranchingCost.geometricSum branch h := by
  intro h
  change A h = BranchingCost.cost branch leaf slope extra h
  induction h with
  | zero => rw [ha0, BranchingCost.cost_initial]
  | succ h ih => rw [hs h, ih, BranchingCost.cost_step]

theorem divide_conquer_three_way (A : Nat -> Int) (ha0 : A 0 = 2)
    (hs : forall h, A (h + 1) = 3 * A h + 4 * 3 ^ (h + 1) + 5) :
    forall h, A h = (2 + 4 * (h : Int)) * 3 ^ h + 5 * BranchingCost.geometricSum 3 h :=
  divide_conquer_branching_cost A 3 2 4 5 ha0 hs

/-- info: 'divide_conquer_branching_cost' depends on axioms: [propext, Quot.sound] -/
#guard_msgs in
#print axioms divide_conquer_branching_cost

/-- info: 'divide_conquer_three_way' depends on axioms: [propext, Quot.sound] -/
#guard_msgs in
#print axioms divide_conquer_three_way
