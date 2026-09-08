"""Bounded constant-coefficient recurrences with exact polynomial candidates."""
import json
import sys
from fractions import Fraction
from math import comb
import pit_witness as common
from polynomial_sum import coefficients, evaluate

VERSION = "truth-harness.polynomial-recurrence.v0"
RECEIPT = "truth-harness.polynomial-recurrence-receipt.v0"


def validate(request):
    common.base.keys(request, ["schema_version", "recurrence_coefficients", "initial_values", "forcing", "candidate", "budget"])
    common.base.require(request["schema_version"] == VERSION, "Unknown request version")
    weights = request["recurrence_coefficients"]
    common.base.require(type(weights) is list and 1 <= len(weights) <= 4, "Require recurrence order 1..4")
    initial = request["initial_values"]
    common.base.require(type(initial) is list and len(initial) == len(weights), "Require one initial value per recurrence order")
    for value in weights + initial:
        common.base.rational(value)
    for side in ("forcing", "candidate"):
        terms = request[side]
        common.base.require(type(terms) is list and len(terms) <= 32, "Require 0..32 polynomial terms")
        for term in terms:
            common.base.keys(term, ["coefficient", "exponents"])
            common.base.rational(term["coefficient"])
            common.base.require(type(term["exponents"]) is list and len(term["exponents"]) == 1, "Require one polynomial variable")
            common.bounded_int(term["exponents"][0], 0, 12)
    common.base.keys(request["budget"], ["max_index"])
    common.bounded_int(request["budget"]["max_index"], 0, 16)


def shifted(values, offset):
    # Full binomial translation, not sampling of the recurrence identity.
    return [sum((values[j] * comb(j, i) * offset ** (j - i) for j in range(i, 13)), Fraction(0)) for i in range(13)]


def sequence_values(request):
    values = list(map(Fraction, request["initial_values"]))
    weights = list(map(Fraction, request["recurrence_coefficients"]))
    forcing = coefficients(request["forcing"])
    order = len(weights)
    for index in range(order, request["budget"]["max_index"] + 1):
        n = index - order
        values.append(sum((a * values[n + j] for j, a in enumerate(weights)), Fraction(0)) + evaluate(forcing, n))
    return values[:request["budget"]["max_index"] + 1]


def construct(request):
    if type(request) is dict and request.get("schema_version") == "truth-harness.exponential-recurrence.v0":
        import exponential_recurrence
        return exponential_recurrence.construct(request)
    import sympy as sp
    validate(request)
    n = sp.Symbol("n")
    f, s = [sum((sp.Rational(t["coefficient"]) * n ** t["exponents"][0] for t in request[side]), sp.Integer(0))
            for side in ("forcing", "candidate")]
    weights = list(map(sp.Rational, request["recurrence_coefficients"]))
    values = list(map(sp.Rational, request["initial_values"]))
    order = len(weights)
    base = [s.subs(n, i) for i in range(order)]
    residual = sp.Poly(sp.expand(s.subs(n, n + order) - sum((a * s.subs(n, n + j) for j, a in enumerate(weights)), sp.Integer(0)) - f), n)
    status = "identity-checked" if base == values and residual.is_zero else "unknown"
    counterexample = None
    if status == "unknown":
        for index in range(request["budget"]["max_index"] + 1):
            if index >= order:
                k = index - order
                values.append(sum((a * values[k + j] for j, a in enumerate(weights)), sp.Integer(0)) + f.subs(n, k))
            candidate = s.subs(n, index)
            if candidate != values[index]:
                counterexample = {"index": index, "candidate_value": str(candidate), "sequence_value": str(values[index])}
                status = "refuted"
                break
    return {"schema_version": RECEIPT, "request": request, "request_sha256": common.digest(request),
            "status": status, "candidate_initial_values": list(map(str, base)),
            "recurrence_residual_coefficients": [str(residual.nth(i)) for i in range(13)], "counterexample": counterexample}


def check(envelope):
    common.base.keys(envelope, ["request_json", "receipt_json"])
    request, receipt = [common.decode(envelope[key]) for key in ("request_json", "receipt_json")]
    if type(request) is dict and request.get("schema_version") == "truth-harness.exponential-recurrence.v0":
        import exponential_recurrence
        return exponential_recurrence.check(request, receipt)
    validate(request)
    common.base.keys(receipt, ["schema_version", "request", "request_sha256", "status", "candidate_initial_values",
                               "recurrence_residual_coefficients", "counterexample"])
    common.base.require(receipt["schema_version"] == RECEIPT, "Unknown receipt version")
    common.base.require(common.canonical(receipt["request"]) == common.canonical(request), "Request mismatch")
    common.base.require(receipt["request_sha256"] == common.digest(request), "Request hash mismatch")
    weights = list(map(Fraction, request["recurrence_coefficients"]))
    order = len(weights)
    f, s = [coefficients(request[side]) for side in ("forcing", "candidate")]
    base = [str(evaluate(s, i)) for i in range(order)]
    right = [shifted(s, j) for j in range(order)]
    residual = [c - f[i] - sum((a * right[j][i] for j, a in enumerate(weights)), Fraction(0))
                for i, c in enumerate(shifted(s, order))]
    common.base.require(receipt["candidate_initial_values"] == base, "Incorrect initial-value trace")
    common.base.require(receipt["recurrence_residual_coefficients"] == list(map(str, residual)), "Incorrect recurrence trace")
    identity = base == request["initial_values"] and not any(residual)
    status = receipt["status"]
    if status == "identity-checked":
        common.base.require(identity and receipt["counterexample"] is None, "Invalid induction evidence")
    elif status == "refuted":
        w = receipt["counterexample"]
        common.base.keys(w, ["index", "candidate_value", "sequence_value"])
        common.bounded_int(w["index"], 0, request["budget"]["max_index"])
        actual = sequence_values(request)[w["index"]]
        candidate = evaluate(s, w["index"])
        common.base.require(candidate != actual and w["candidate_value"] == str(candidate) and w["sequence_value"] == str(actual), "Invalid sequence counterexample")
    else:
        common.base.require(status == "unknown" and not identity and receipt["counterexample"] is None, "Invalid unresolved result")
        common.base.require(all(evaluate(s, i) == v for i, v in enumerate(sequence_values(request))), "Counterexample exists within budget")
    return {"status": status, "trust": {"identity-checked": "exact-computed", "refuted": "refuted", "unknown": "unverified"}[status],
            "checked": status != "unknown", "proof_checker_backed": False, "recurrence_order": order,
            "evidence_class": {"identity-checked": "polynomial-recurrence-induction-check", "refuted": "exact-sequence-counterexample", "unknown": "none"}[status],
            "domain": "all nonnegative integer indices; u(n+r)=sum(a[j]*u(n+j),j=0..r-1)+f(n)",
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
