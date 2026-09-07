"""Exact scalar cubic coefficient contract; construction and independent checking."""
import hashlib
import json
import sys
from fractions import Fraction
import pit_certificate as base

VERSION = "truth-harness.bezier-coefficients.v0"
RECEIPT = "truth-harness.bezier-coefficients-receipt.v0"


def canonical(value):
    return json.dumps(value, sort_keys=True, separators=(",", ":"), ensure_ascii=True)


def decode(raw):
    base.require(type(raw) is str and len(raw.encode("utf-8")) <= 65536, "Input too large")
    return json.loads(raw, object_pairs_hook=base.unique_object)


def validate(request):
    base.keys(request, ["schema_version", "controls", "candidate_coefficients"])
    base.require(request["schema_version"] == VERSION, "Unknown request version")
    for name in ("controls", "candidate_coefficients"):
        base.require(type(request[name]) is list and len(request[name]) == 4, "Require exactly four rational values")
        for value in request[name]:
            base.rational(value)


def expected_coefficients(controls):
    # Polynomial de Casteljau: repeated affine blends, not the producer's expansion.
    level = [[Fraction(value)] for value in controls]
    while len(level) > 1:
        following = []
        for left, right in zip(level, level[1:]):
            result = left + [Fraction(0)]
            for i, (a, b) in enumerate(zip(left, right)):
                result[i + 1] += b - a
            following.append(result)
        level = following
    return level[0]


def evaluate(controls, coefficients, t):
    level = [Fraction(value) for value in controls]
    while len(level) > 1:
        level = [(1 - t) * a + t * b for a, b in zip(level, level[1:])]
    candidate = Fraction(0)
    for c in reversed(coefficients):
        candidate = candidate * t + Fraction(c)
    return level[0], candidate


def construct(request):
    import sympy as sp
    validate(request)
    t = sp.Symbol("t")
    a, b, c, d = map(sp.Rational, request["controls"])
    expression = sp.Poly(sp.expand(a * (1 - t) ** 3 + 3 * b * t * (1 - t) ** 2 + 3 * c * t ** 2 * (1 - t) + d * t ** 3), t)
    coefficients = [str(expression.nth(i)) for i in range(4)]
    equal = coefficients == request["candidate_coefficients"]
    counterexample = None
    if not equal:
        candidate = sum(sp.Rational(value) * t ** i for i, value in enumerate(request["candidate_coefficients"]))
        for point in (sp.Rational(0), sp.Rational(1, 3), sp.Rational(2, 3), sp.Rational(1)):
            left, right = expression.eval(point), candidate.subs(t, point)
            if left != right:
                counterexample = {"parameter": str(point), "curve": str(left), "candidate": str(right)}
                break
        base.require(counterexample is not None, "Unable to construct cubic counterexample")
    return {"schema_version": RECEIPT, "request": request,
            "request_sha256": hashlib.sha256(canonical(request).encode("ascii")).hexdigest(),
            "status": "equivalent" if equal else "refuted", "trust": "exact-computed" if equal else "refuted",
            "expected_coefficients": coefficients, "counterexample": counterexample}


def check(envelope):
    base.keys(envelope, ["request_json", "receipt_json"])
    request, receipt = decode(envelope["request_json"]), decode(envelope["receipt_json"])
    validate(request)
    base.keys(receipt, ["schema_version", "request", "request_sha256", "status", "trust", "expected_coefficients", "counterexample"])
    base.require(receipt["schema_version"] == RECEIPT, "Unknown receipt version")
    base.require(canonical(receipt["request"]) == canonical(request), "Request mismatch")
    base.require(receipt["request_sha256"] == hashlib.sha256(canonical(request).encode("ascii")).hexdigest(), "Request hash mismatch")
    expected = list(map(str, expected_coefficients(request["controls"])))
    base.require(receipt["expected_coefficients"] == expected, "Incorrect coefficient trace")
    equal = expected == request["candidate_coefficients"]
    if equal:
        base.require(receipt["status"] == "equivalent" and receipt["trust"] == "exact-computed" and receipt["counterexample"] is None, "Invalid equivalence receipt")
    else:
        base.require(receipt["status"] == "refuted" and receipt["trust"] == "refuted", "Invalid refutation receipt")
        counterexample = receipt["counterexample"]
        base.keys(counterexample, ["parameter", "curve", "candidate"])
        t = base.rational(counterexample["parameter"])
        base.require(0 <= t <= 1, "Parameter outside curve interval")
        left, right = evaluate(request["controls"], request["candidate_coefficients"], t)
        base.require(left != right and counterexample["curve"] == str(left) and counterexample["candidate"] == str(right), "Incorrect counterexample")
    return {"status": receipt["status"], "trust": receipt["trust"], "checked": True, "proof_checker_backed": False}


if __name__ == "__main__":
    try:
        base.require(sys.argv[1:] in (["construct"], ["check"]), "Expected construct or check")
        raw = sys.stdin.buffer.read(262145)
        base.require(len(raw) <= 262144, "Envelope too large")
        text = raw.decode("utf-8")
        value = decode(text) if sys.argv[1] == "construct" else json.loads(text, object_pairs_hook=base.unique_object)
        print(canonical(construct(value) if sys.argv[1] == "construct" else check(value)))
    except Exception as error:
        print(canonical({"status": "unverified", "error": str(error)}), file=sys.stderr)
        sys.exit(1)
