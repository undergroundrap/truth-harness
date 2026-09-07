import Scratch.Bound

namespace Scratch

theorem budget_bound (persistent frame depth budget : Nat) (tree : Tree)
    (hd : height tree <= depth) (hb : persistent + frame * depth <= budget) :
    persistent + scratch frame tree <= budget := by
  have hs := Nat.le_trans (scratch_bound frame tree) (Nat.mul_le_mul_left frame hd)
  exact Nat.le_trans (Nat.add_le_add_left hs persistent) hb

-- Depth cannot be omitted: even a branch with two leaves retains a parent frame.
theorem depth_free_bound_false :
    Not (scratch 1 (.branch .leaf .leaf) <= 1) := by decide

end Scratch

-- This independent target prevents a renamed/weakened result from passing.
example (persistent frame depth budget : Nat) (tree : Scratch.Tree)
    (hd : Scratch.height tree <= depth) (hb : persistent + frame * depth <= budget) :
    persistent + Scratch.scratch frame tree <= budget :=
  Scratch.budget_bound persistent frame depth budget tree hd hb

/-- info: 'Scratch.budget_bound' depends on axioms: [propext] -/
#guard_msgs in
#print axioms Scratch.budget_bound

/-- info: 'Scratch.depth_free_bound_false' does not depend on any axioms -/
#guard_msgs in
#print axioms Scratch.depth_free_bound_false
