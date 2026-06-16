import Lake
open Lake DSL

package truth_harness_fixture where
  version := v!"0.1.0"

lean_lib TruthHarnessFixture where
  roots := #[`TruthHarnessFixture.Trivial]
