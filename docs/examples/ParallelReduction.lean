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
