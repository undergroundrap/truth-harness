import Scratch.Model

namespace Scratch

theorem reuse_step (frame left right depth : Nat)
    (hl : left <= frame * depth) (hr : right <= frame * depth) :
    frame + max left right <= frame * (depth + 1) := by
  have hm : max left right <= frame * depth := Nat.max_le_of_le_of_le hl hr
  calc
    frame + max left right <= frame + frame * depth := Nat.add_le_add_left hm frame
    _ = frame * (depth + 1) := by rw [Nat.mul_add, Nat.mul_one, Nat.add_comm]

theorem scratch_bound (frame : Nat) (tree : Tree) :
    scratch frame tree <= frame * height tree := by
  induction tree with
  | leaf => simp [scratch, height]
  | branch left right ihl ihr =>
    apply reuse_step
    · exact Nat.le_trans ihl (Nat.mul_le_mul_left frame (Nat.le_max_left _ _))
    · exact Nat.le_trans ihr (Nat.mul_le_mul_left frame (Nat.le_max_right _ _))

end Scratch
