import Lake
open Lake DSL

package truth_harness_theorem_template where
  version := v!"0.1.0"

lean_lib TruthHarnessTemplate where
  roots := #[`TruthHarnessTemplate.Basics]
