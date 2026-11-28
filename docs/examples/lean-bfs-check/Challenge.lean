import BfsModel

open BfsCertificate

-- Reference statement only. The checker must reject this as a solution.
theorem bfs_certificate_sound {Vertex : Type u} (edge : Vertex → Vertex → Prop)
    (source : Vertex) (label : Vertex → Option Nat)
    (sourceZero : label source = some 0)
    (zeroIsSource : ∀ v, label v = some 0 → v = source)
    (edgeBound : ∀ u v n, edge u v → label u = some n →
      ∃ m, label v = some m ∧ m ≤ n + 1)
    (predecessor : ∀ v n, label v = some (n + 1) →
      ∃ u, edge u v ∧ label u = some n) :
    ∀ v, match label v with
      | none => ∀ length, ¬ Walk edge source v length
      | some n => Walk edge source v n ∧
          ∀ length, Walk edge source v length → n ≤ length := by
  sorry
