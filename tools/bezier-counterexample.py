"""Fixed cubic Bezier mutation experiment; no user expression evaluator."""
import json
import sys
from fractions import Fraction
import pit_witness as witness

REQUEST = {
    "schema_version": "truth-harness.pit-witness-request.v0",
    "variables": 1,
    "terms": [{"coefficient": "1", "exponents": [0]},
              {"coefficient": "-1", "exponents": [1]}],
    "budget": {"max_samples": 2, "max_bits": 128},
}


def check(receipt):
    checked = witness.check({"request_json": json.dumps(REQUEST), "receipt_json": json.dumps(receipt)})
    witness.base.require(checked["checked"], "A checked nonzero witness is required")
    x = Fraction(receipt["witness"]["point"][0])
    t = 1 / x
    witness.base.require(0 < t < 1, "Counterexample must be inside the curve interval")
    # De Casteljau blending is independent of the expanded coefficient formula.
    values = [Fraction(0), Fraction(1), Fraction(0), Fraction(0)]
    while len(values) > 1:
        values = [(1 - t) * a + t * b for a, b in zip(values, values[1:])]
    correct = values[0]
    faulty = ((2 * t - 5) * t + 3) * t
    difference = correct - faulty
    witness.base.require(difference != 0, "Original formulas agree at the witness")
    witness.base.require(difference * x ** 3 == Fraction(receipt["witness"]["value"]), "Cleared denominator mapping mismatch")
    return {"schema_version": "truth-harness.bezier-counterexample.v0", "status": "refuted",
            "evidence_class": "exact-rational-counterexample", "proof_checker_backed": False,
            "controls": ["0", "1", "0", "0"], "parameter": str(t),
            "de_casteljau": str(correct), "faulty_horner": str(faulty), "difference": str(difference)}


if __name__ == "__main__":
    try:
        witness.base.require(sys.argv[1:] == [], "No arguments accepted")
        raw = sys.stdin.buffer.read(65537)
        witness.base.require(len(raw) <= 65536, "Input too large")
        print(witness.canonical(check(witness.decode(raw.decode("utf-8")))))
    except Exception as error:
        print(json.dumps({"status": "unverified", "error": str(error)}), file=sys.stderr)
        sys.exit(1)
