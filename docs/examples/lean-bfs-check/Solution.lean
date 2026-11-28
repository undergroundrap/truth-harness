import BfsModel

open BfsCertificate

private theorem walk_from_label {Vertex : Type u} {edge : Vertex → Vertex → Prop}
    {source : Vertex} {label : Vertex → Option Nat}
    (zeroIsSource : ∀ v, label v = some 0 → v = source)
    (predecessor : ∀ v n, label v = some (n + 1) →
      ∃ u, edge u v ∧ label u = some n)
    {v : Vertex} {n : Nat} (labeled : label v = some n) : Walk edge source v n := by
  induction n generalizing v with
  | zero =>
    have isSource := zeroIsSource v labeled
    subst v
    exact .empty
  | succ n ih =>
    obtain ⟨_, incoming, previous⟩ := predecessor v n labeled
    exact .extend (ih previous) incoming

private theorem label_bounded_by_walk {Vertex : Type u} {edge : Vertex → Vertex → Prop}
    {source : Vertex} {label : Vertex → Option Nat}
    (sourceZero : label source = some 0)
    (edgeBound : ∀ u v n, edge u v → label u = some n →
      ∃ m, label v = some m ∧ m ≤ n + 1)
    {v : Vertex} {length : Nat} (walk : Walk edge source v length) :
    ∃ n, label v = some n ∧ n ≤ length := by
  induction walk with
  | empty => exact ⟨0, sourceZero, Nat.le_refl 0⟩
  | extend _ next ih =>
    obtain ⟨n, labeled, bound⟩ := ih
    obtain ⟨m, nextLabel, nextBound⟩ := edgeBound _ _ n next labeled
    exact ⟨m, nextLabel, Nat.le_trans nextBound (Nat.succ_le_succ bound)⟩

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
  intro v
  cases actual : label v with
  | none =>
    intro length walk
    obtain ⟨_, labeled, _⟩ := label_bounded_by_walk sourceZero edgeBound walk
    rw [actual] at labeled
    contradiction
  | some n =>
    refine ⟨walk_from_label zeroIsSource predecessor actual, ?_⟩
    intro length walk
    obtain ⟨m, labeled, bound⟩ := label_bounded_by_walk sourceZero edgeBound walk
    have same := Option.some.inj (actual.symm.trans labeled)
    exact same ▸ bound
