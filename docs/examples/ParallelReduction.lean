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

namespace ValueTree

inductive Tree where
  | leaf : Int -> Tree
  | fork : Tree -> Tree -> Tree

def aggregate : Tree -> Int × Nat
  | .leaf value => (value, 1)
  | .fork l r =>
    let a := aggregate l
    let b := aggregate r
    (a.1 + b.1, a.2 + b.2)

def leaves : Tree -> List Int
  | .leaf value => [value]
  | .fork l r => leaves l ++ leaves r

def listSum : List Int -> Int
  | [] => 0
  | x :: xs => x + listSum xs

theorem listSum_append (xs ys : List Int) :
    listSum (xs ++ ys) = listSum xs + listSum ys := by
  induction xs with
  | nil => simp [listSum]
  | cons x xs ih => simp [listSum, ih, Int.add_assoc]

theorem aggregate_correct (t : Tree) :
    aggregate t = (listSum (leaves t), (leaves t).length) := by
  induction t with
  | leaf value => simp [aggregate, leaves, listSum]
  | fork l r hl hr => simp [aggregate, leaves, hl, hr, listSum_append]

def shape : Tree -> PairTree.Tree
  | .leaf _ => .leaf
  | .fork l r => .fork (shape l) (shape r)

structure Evaluation where
  output : Int × Nat
  work : Int
  span : Nat

def evaluate : Tree -> Evaluation
  | .leaf value => { output := (value, 1), work := 0, span := 0 }
  | .fork l r =>
    let a := evaluate l
    let b := evaluate r
    { output := (a.output.1 + b.output.1, a.output.2 + b.output.2),
      work := a.work + b.work + 2,
      span := max a.span b.span + 1 }

theorem evaluate_refines (t : Tree) :
    (evaluate t).output = aggregate t /\
    (evaluate t).work = PairTree.work (shape t) /\
    (evaluate t).span = PairTree.span (shape t) := by
  induction t with
  | leaf value => simp [evaluate, aggregate, shape, PairTree.work, PairTree.span]
  | fork l r hl hr =>
    simp [evaluate, aggregate, shape, PairTree.work, PairTree.span,
      hl.1, hl.2.1, hl.2.2, hr.1, hr.2.1, hr.2.2]

end ValueTree

namespace TreeScan

def prefixes (offset : Int) : List Int -> List Int
  | [] => []
  | x :: xs => (offset + x) :: prefixes (offset + x) xs

theorem prefixes_append (xs ys : List Int) (offset : Int) :
    prefixes offset (xs ++ ys) =
      prefixes offset xs ++ prefixes (offset + ValueTree.listSum xs) ys := by
  induction xs generalizing offset with
  | nil => simp [prefixes, ValueTree.listSum]
  | cons x xs ih => simp [prefixes, ValueTree.listSum, ih, Int.add_assoc]

def scan (offset : Int) : ValueTree.Tree -> List Int
  | .leaf value => [offset + value]
  | .fork l r => scan offset l ++ scan (offset + (ValueTree.aggregate l).1) r

theorem scan_correct (t : ValueTree.Tree) (offset : Int) :
    scan offset t = prefixes offset (ValueTree.leaves t) := by
  induction t generalizing offset with
  | leaf value => simp [scan, prefixes, ValueTree.leaves]
  | fork l r hl hr =>
    simp [scan, ValueTree.leaves, prefixes_append, hl, hr, ValueTree.aggregate_correct]

end TreeScan

namespace CachedScan

inductive Tree where
  | leaf : Int -> Tree
  | fork : Int -> Tree -> Tree -> Tree

def total : Tree -> Int
  | .leaf value => value
  | .fork value _ _ => value

def build : ValueTree.Tree -> Tree
  | .leaf value => .leaf value
  | .fork l r =>
    let a := build l
    let b := build r
    .fork (total a + total b) a b

theorem build_total (t : ValueTree.Tree) :
    total (build t) = (ValueTree.aggregate t).1 := by
  induction t with
  | leaf value => rfl
  | fork l r hl hr =>
    change total (build l) + total (build r) =
      (ValueTree.aggregate l).1 + (ValueTree.aggregate r).1
    rw [hl, hr]

def scan (offset : Int) : Tree -> List Int
  | .leaf value => [offset + value]
  | .fork _ l r => scan offset l ++ scan (offset + total l) r

theorem scan_build (t : ValueTree.Tree) (offset : Int) :
    scan offset (build t) = TreeScan.scan offset t := by
  induction t generalizing offset with
  | leaf value => rfl
  | fork l r hl hr => simp [build, scan, TreeScan.scan, hl, hr, build_total]

end CachedScan

namespace CachedScan

def buildWork : ValueTree.Tree -> Int
  | .leaf _ => 0
  | .fork l r => buildWork l + buildWork r + 1

def scanWork : Tree -> Int
  | .leaf _ => 1
  | .fork _ l r => scanWork l + scanWork r + 1

theorem build_work (t : ValueTree.Tree) :
    buildWork t = ((ValueTree.leaves t).length : Int) - 1 := by
  induction t with
  | leaf value => simp [buildWork, ValueTree.leaves]
  | fork l r hl hr =>
    change buildWork l + buildWork r + 1 =
      ((ValueTree.leaves (.fork l r)).length : Int) - 1
    simp only [ValueTree.leaves, List.length_append]
    omega

theorem scan_work (t : ValueTree.Tree) :
    scanWork (build t) = 2 * ((ValueTree.leaves t).length : Int) - 1 := by
  induction t with
  | leaf value => simp [build, scanWork, ValueTree.leaves]
  | fork l r hl hr =>
    change scanWork (build l) + scanWork (build r) + 1 =
      2 * ((ValueTree.leaves (.fork l r)).length : Int) - 1
    simp only [ValueTree.leaves, List.length_append]
    omega

end CachedScan

theorem cached_prefix_arithmetic_work (t : ValueTree.Tree) :
    CachedScan.buildWork t + CachedScan.scanWork (CachedScan.build t) =
      3 * ((ValueTree.leaves t).length : Int) - 2 := by
  have hb := CachedScan.build_work t
  have hs := CachedScan.scan_work t
  omega

/-- info: 'cached_prefix_arithmetic_work' depends on axioms: [propext, Quot.sound] -/
#guard_msgs in
#print axioms cached_prefix_arithmetic_work

theorem cached_prefix_scan_correct (t : ValueTree.Tree) (offset : Int) :
    CachedScan.scan offset (CachedScan.build t) =
      TreeScan.prefixes offset (ValueTree.leaves t) := by
  exact (CachedScan.scan_build t offset).trans (TreeScan.scan_correct t offset)

/-- info: 'cached_prefix_scan_correct' depends on axioms: [propext] -/
#guard_msgs in
#print axioms cached_prefix_scan_correct

theorem tree_prefix_scan_correct (t : ValueTree.Tree) (offset : Int) :
    TreeScan.scan offset t = TreeScan.prefixes offset (ValueTree.leaves t) := by
  exact TreeScan.scan_correct t offset

/-- info: 'tree_prefix_scan_correct' depends on axioms: [propext] -/
#guard_msgs in
#print axioms tree_prefix_scan_correct

theorem tree_evaluation_correct (t : ValueTree.Tree) :
    (ValueTree.evaluate t).output =
      (ValueTree.listSum (ValueTree.leaves t), (ValueTree.leaves t).length) /\
    (ValueTree.evaluate t).work = PairTree.work (ValueTree.shape t) /\
    (ValueTree.evaluate t).span = PairTree.span (ValueTree.shape t) := by
  have r := ValueTree.evaluate_refines t
  exact And.intro (r.1.trans (ValueTree.aggregate_correct t)) r.2

theorem tree_evaluation_balanced (t : ValueTree.Tree) (h : Nat)
    (balanced : ValueTree.shape t = PairTree.balanced h) :
    (ValueTree.evaluate t).output =
      (ValueTree.listSum (ValueTree.leaves t), (ValueTree.leaves t).length) /\
    (ValueTree.evaluate t).work = 2 * (2 ^ h - 1) /\
    ((ValueTree.evaluate t).span : Int) = (h : Int) := by
  have r := tree_evaluation_correct t
  have cost := PairTree.balanced_cost h
  rw [balanced] at r
  exact And.intro r.1 (And.intro (r.2.1.trans cost.1)
    ((congrArg (fun n : Nat => (n : Int)) r.2.2).trans cost.2))

/-- info: 'tree_evaluation_correct' depends on axioms: [propext] -/
#guard_msgs in
#print axioms tree_evaluation_correct

/-- info: 'tree_evaluation_balanced' depends on axioms: [propext, Quot.sound] -/
#guard_msgs in
#print axioms tree_evaluation_balanced

theorem tree_aggregation_correct (t : ValueTree.Tree) :
    ValueTree.aggregate t = (ValueTree.listSum (ValueTree.leaves t),
      (ValueTree.leaves t).length) := by
  exact ValueTree.aggregate_correct t

/-- info: 'tree_aggregation_correct' depends on axioms: [propext] -/
#guard_msgs in
#print axioms tree_aggregation_correct

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
