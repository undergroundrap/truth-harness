namespace BfsCertificate

/-- A directed walk from `source` to an endpoint, indexed by its edge count. -/
inductive Walk {Vertex : Type u} (edge : Vertex → Vertex → Prop) (source : Vertex) :
    Vertex → Nat → Prop where
  | empty : Walk edge source source 0
  | extend {u v : Vertex} {length : Nat} :
      Walk edge source u length → edge u v → Walk edge source v (length + 1)

end BfsCertificate
