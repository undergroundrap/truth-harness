import Lake
open Lake DSL

package scratch_reuse_pilot

@[default_target]
lean_lib Scratch where
  roots := #[`Scratch.Model, `Scratch.Bound, `Scratch.Final]
