namespace Scratch

inductive Tree where
  | leaf
  | branch (left right : Tree)

def height : Tree -> Nat
  | .leaf => 1
  | .branch left right => max (height left) (height right) + 1

-- Models sequential children sharing scratch, with one retained frame per level.
def scratch (frame : Nat) : Tree -> Nat
  | .leaf => frame
  | .branch left right => frame + max (scratch frame left) (scratch frame right)

theorem leaf_cost (frame : Nat) : scratch frame .leaf = frame := rfl

theorem branch_cost (frame : Nat) (left right : Tree) :
    scratch frame (.branch left right) =
      frame + max (scratch frame left) (scratch frame right) := rfl

end Scratch
