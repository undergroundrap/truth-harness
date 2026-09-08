import Std

theorem parallel_reduction_work (W : Nat -> Int) (branch : Int)
    (w0 : W 0 = 0)
    (ws : forall h, W (h + 1) = branch * W h + (branch - 1)) :
    forall h, W h = branch ^ h - 1 := by
  intro h
  induction h with
  | zero => simp [w0, Int.pow_zero]
  | succ h ih =>
    rw [ws h, ih, Int.mul_sub, Int.mul_one, Int.pow_succ]
    rw [Int.mul_comm (branch ^ h) branch]
    omega

theorem parallel_reduction_span (S : Nat -> Int) (branch : Int)
    (s0 : S 0 = 0)
    (ss : forall h, S (h + 1) = S h + (branch - 1)) :
    forall h, S h = (branch - 1) * (h : Int) := by
  intro h
  induction h with
  | zero => simp [s0]
  | succ h ih =>
    have hc : ((h + 1 : Nat) : Int) = (h : Int) + 1 := by omega
    rw [ss h, ih, hc, Int.mul_add, Int.mul_one]

theorem parallel_reduction_four_way (W S : Nat -> Int)
    (w0 : W 0 = 0) (ws : forall h, W (h + 1) = 4 * W h + 3)
    (s0 : S 0 = 0) (ss : forall h, S (h + 1) = S h + 3) :
    forall h, W h = 4 ^ h - 1 /\ S h = 3 * (h : Int) := by
  intro h
  constructor
  · exact parallel_reduction_work W 4 w0 ws h
  · exact parallel_reduction_span S 4 s0 ss h

theorem parallel_reduction_span_not_work : Not ((4 : Int) ^ 2 - 1 = 3 * (2 : Int)) := by
  decide

theorem binary_pair_aggregation (X Y S : Nat -> Int)
    (x0 : X 0 = 0) (xs : forall h, X (h + 1) = 2 * X h + 1)
    (y0 : Y 0 = 0) (ys : forall h, Y (h + 1) = 2 * Y h + 1)
    (s0 : S 0 = 0) (ss : forall h, S (h + 1) = S h + 1) :
    forall h, X h + Y h = 2 * (2 ^ h - 1) /\ S h = (h : Int) := by
  intro h
  have hx := parallel_reduction_work X 2 x0 xs h
  have hy := parallel_reduction_work Y 2 y0 ys h
  have hs := parallel_reduction_span S 2 s0 ss h
  constructor <;> omega

/-- info: 'binary_pair_aggregation' depends on axioms: [propext, Quot.sound] -/
#guard_msgs in
#print axioms binary_pair_aggregation

namespace PairTree

inductive Tree where
  | leaf : Tree
  | fork : Tree -> Tree -> Tree

def additions : Tree -> Int
  | .leaf => 0
  | .fork l r => additions l + additions r + 1

def work : Tree -> Int
  | .leaf => 0
  | .fork l r => work l + work r + 2

def span : Tree -> Nat
  | .leaf => 0
  | .fork l r => max (span l) (span r) + 1

def balanced : Nat -> Tree
  | 0 => .leaf
  | h + 1 => .fork (balanced h) (balanced h)

theorem work_components (t : Tree) : work t = additions t + additions t := by
  induction t with
  | leaf => rfl
  | fork l r hl hr =>
    simp only [work, additions]
    omega

theorem additions_step (h : Nat) :
    additions (balanced (h + 1)) = 2 * additions (balanced h) + 1 := by
  simp only [balanced, additions]
  omega

theorem span_step (h : Nat) :
    (span (balanced (h + 1)) : Int) = (span (balanced h) : Int) + 1 := by
  simp [balanced, span]

theorem balanced_cost (h : Nat) :
    work (balanced h) = 2 * (2 ^ h - 1) /\ (span (balanced h) : Int) = (h : Int) := by
  have result := binary_pair_aggregation
    (fun k => additions (balanced k)) (fun k => additions (balanced k))
    (fun k => (span (balanced k) : Int))
    rfl additions_step rfl additions_step rfl span_step h
  rw [work_components]
  exact result

end PairTree

theorem pair_tree_balanced_cost (h : Nat) :
    PairTree.work (PairTree.balanced h) = 2 * (2 ^ h - 1) /\
    (PairTree.span (PairTree.balanced h) : Int) = (h : Int) := by
  exact PairTree.balanced_cost h

/-- info: 'pair_tree_balanced_cost' depends on axioms: [propext, Quot.sound] -/
#guard_msgs in
#print axioms pair_tree_balanced_cost

/-- info: 'PairTree.balanced_cost' depends on axioms: [propext, Quot.sound] -/
#guard_msgs in
#print axioms PairTree.balanced_cost

/-- info: 'parallel_reduction_work' depends on axioms: [propext, Quot.sound] -/
#guard_msgs in
#print axioms parallel_reduction_work

/-- info: 'parallel_reduction_span' depends on axioms: [propext, Quot.sound] -/
#guard_msgs in
#print axioms parallel_reduction_span

/-- info: 'parallel_reduction_four_way' depends on axioms: [propext, Quot.sound] -/
#guard_msgs in
#print axioms parallel_reduction_four_way

/-- info: 'parallel_reduction_span_not_work' does not depend on any axioms -/
#guard_msgs in
#print axioms parallel_reduction_span_not_work
