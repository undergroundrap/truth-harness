"""Exact bounded polynomial summation checks; no expression parsing or solvers."""
import json
import sys
from fractions import Fraction
from math import comb
import pit_witness as common

VERSION = "truth-harness.polynomial-sum.v0"
RECEIPT = "truth-harness.polynomial-sum-receipt.v0"


def validate(request):
    common.base.keys(request, ["schema_version", "summand", "candidate", "budget"])
    common.base.require(request["schema_version"] == VERSION, "Unknown request version")
    for side in ("summand", "candidate"):
        terms = request[side]
        common.base.require(type(terms) is list and len(terms) <= 32, "Require 0..32 terms per polynomial")
        for term in terms:
            common.base.keys(term, ["coefficient", "exponents"])
            common.base.rational(term["coefficient"])
            common.base.require(type(term["exponents"]) is list and len(term["exponents"]) == 1, "Require one variable")
            common.bounded_int(term["exponents"][0], 0, 12)
    common.base.keys(request["budget"], ["max_n"])
    common.bounded_int(request["budget"]["max_n"], 1, 13)


def coefficients(terms):
    result = [Fraction(0) for _ in range(13)]
    for term in terms:
        result[term["exponents"][0]] += Fraction(term["coefficient"])
    return result


def shifted(values):
    # Exact binomial translation p(n+1), independently of SymPy's expansion.
    return [sum((values[j] * comb(j, i) for j in range(i, 13)), Fraction(0)) for i in range(13)]


def evaluate(values, n):
    result = Fraction(0)
    for coefficient in reversed(values):
        result = result * n + coefficient
    return result


def witness_at(f, s, n):
    return {"n": n, "candidate_value": str(evaluate(s, n)),
            "sum_value": str(sum((evaluate(f, k) for k in range(1, n + 1)), Fraction(0)))}


def construct(request):
    import sympy as sp
    validate(request)
    n = sp.Symbol("n")
    f, s = [sum((sp.Rational(t["coefficient"]) * n ** t["exponents"][0] for t in request[side]), sp.Integer(0))
            for side in ("summand", "candidate")]
    residual = sp.Poly(sp.expand(s.subs(n, n + 1) - s - f.subs(n, n + 1)), n)
    base = s.subs(n, 0)
    trace = [str(residual.nth(i)) for i in range(13)]
    counterexample = None
    status = "identity-checked" if base == 0 and residual.is_zero else "unknown"
    if status == "unknown":
        for point in range(request["budget"]["max_n"] + 1):
            actual = s.subs(n, point)
            expected = sum((f.subs(n, k) for k in range(1, point + 1)), sp.Integer(0))
            if actual != expected:
                counterexample = {"n": point, "candidate_value": str(actual), "sum_value": str(expected)}
                status = "refuted"
                break
    return {"schema_version": RECEIPT, "request": request, "request_sha256": common.digest(request),
            "status": status, "base_value": str(base), "step_residual_coefficients": trace,
            "counterexample": counterexample}


def check(envelope):
    common.base.keys(envelope, ["request_json", "receipt_json"])
    request, receipt = [common.decode(envelope[key]) for key in ("request_json", "receipt_json")]
    validate(request)
    common.base.keys(receipt, ["schema_version", "request", "request_sha256", "status", "base_value",
                               "step_residual_coefficients", "counterexample"])
    common.base.require(receipt["schema_version"] == RECEIPT, "Unknown receipt version")
    common.base.require(common.canonical(request) == common.canonical(receipt["request"]), "Request mismatch")
    common.base.require(receipt["request_sha256"] == common.digest(request), "Request hash mismatch")
    f, s = [coefficients(request[side]) for side in ("summand", "candidate")]
    residual = [a - b - c for a, b, c in zip(shifted(s), s, shifted(f))]
    common.base.require(receipt["base_value"] == str(s[0]), "Incorrect base value")
    common.base.require(receipt["step_residual_coefficients"] == list(map(str, residual)), "Incorrect recurrence trace")
    identity = s[0] == 0 and not any(residual)
    status = receipt["status"]
    if status == "identity-checked":
        common.base.require(identity and receipt["counterexample"] is None, "Invalid induction evidence")
    elif status == "refuted":
        w = receipt["counterexample"]
        common.base.keys(w, ["n", "candidate_value", "sum_value"])
        common.bounded_int(w["n"], 0, request["budget"]["max_n"])
        expected = witness_at(f, s, w["n"])
        common.base.require(common.canonical(w) == common.canonical(expected) and
                            expected["candidate_value"] != expected["sum_value"], "Invalid counterexample")
    else:
        common.base.require(status == "unknown" and not identity and receipt["counterexample"] is None, "Invalid unresolved result")
        # Certify that the configured search was actually exhausted, not just asserted.
        for n in range(request["budget"]["max_n"] + 1):
            w = witness_at(f, s, n)
            common.base.require(w["candidate_value"] == w["sum_value"], "Counterexample exists within budget")
    return {"status": status, "trust": {"identity-checked": "exact-computed", "refuted": "refuted", "unknown": "unverified"}[status],
            "checked": status != "unknown", "proof_checker_backed": False,
            "evidence_class": {"identity-checked": "polynomial-induction-check", "refuted": "exact-finite-sum-counterexample", "unknown": "none"}[status],
            "domain": "all nonnegative integers n; sum from k=1 through n, empty sum at n=0",
            "counterexample": receipt["counterexample"]}


if __name__ == "__main__":
    try:
        common.base.require(sys.argv[1:] in (["construct"], ["check"]), "Expected construct or check")
        raw = sys.stdin.buffer.read(262145)
        common.base.require(len(raw) <= 262144, "Envelope too large")
        text = raw.decode("utf-8")
        value = common.decode(text) if sys.argv[1] == "construct" else json.loads(text, object_pairs_hook=common.base.unique_object)
        print(common.canonical(construct(value) if sys.argv[1] == "construct" else check(value)))
    except Exception as error:
        print(common.canonical({"status": "unverified", "error": str(error)}), file=sys.stderr)
        sys.exit(1)
