"""Bounded rational exponential-polynomial candidates; no expression parsing."""
from fractions import Fraction
import pit_witness as common
import polynomial_recurrence as polynomial
from polynomial_sum import coefficients, evaluate

VERSION = "truth-harness.exponential-recurrence.v0"
RECEIPT = "truth-harness.exponential-recurrence-receipt.v0"


def validate(request):
    common.base.keys(request, ["schema_version", "recurrence_coefficients", "initial_values", "forcing", "candidate", "budget"])
    common.base.require(request["schema_version"] == VERSION, "Unknown request version")
    terms = request["candidate"]
    common.base.require(type(terms) is list and len(terms) <= 32, "Require 0..32 candidate terms")
    bases = set()
    for term in terms:
        common.base.keys(term, ["coefficient", "exponents", "base"])
        base = common.base.rational(term["base"])
        common.base.require(Fraction(1, 16) <= abs(base) <= 16, "Require nonzero rational base with magnitude 1/16..16")
        bases.add(base)
    common.base.require(len(bases) <= 4, "Require at most four distinct candidate bases")
    # Reuse unchanged V0 structural bounds for coefficients, degrees and budget.
    polynomial.validate({**request, "schema_version": polynomial.VERSION,
                         "candidate": [{k: t[k] for k in ("coefficient", "exponents")} for t in terms]})


def groups(request):
    result = {Fraction(1): [Fraction(0) for _ in range(13)]}
    for term in request["candidate"]:
        base = Fraction(term["base"])
        result.setdefault(base, [Fraction(0) for _ in range(13)])[term["exponents"][0]] += Fraction(term["coefficient"])
    return dict(sorted(result.items()))


def candidate_at(grouped, index):
    return sum((base ** index * evaluate(poly, index) for base, poly in grouped.items()), Fraction(0))


def construct(request):
    import sympy as sp
    validate(request)
    n = sp.Symbol("n")
    bases = sorted({Fraction(t["base"]) for t in request["candidate"]} | {Fraction(1)})
    polys = {b: sum((sp.Rational(t["coefficient"]) * n ** t["exponents"][0]
                    for t in request["candidate"] if Fraction(t["base"]) == b), sp.Integer(0)) for b in bases}
    forcing = sum((sp.Rational(t["coefficient"]) * n ** t["exponents"][0] for t in request["forcing"]), sp.Integer(0))
    weights = list(map(sp.Rational, request["recurrence_coefficients"]))
    values = list(map(sp.Rational, request["initial_values"]))
    order = len(weights)
    at = lambda i: sum((sp.Rational(str(b)) ** i * p.subs(n, i) for b, p in polys.items()), sp.Integer(0))
    initial = [str(at(i)) for i in range(order)]
    trace = []
    for b, p in polys.items():
        base = sp.Rational(str(b))
        residual = sp.Poly(sp.expand(base ** order * p.subs(n, n + order) -
                            sum((a * base ** j * p.subs(n, n + j) for j, a in enumerate(weights)), sp.Integer(0)) -
                            (forcing if b == 1 else 0)), n)
        trace.append({"base": str(b), "coefficients": [str(residual.nth(i)) for i in range(13)]})
    identity = initial == request["initial_values"] and all(c == "0" for row in trace for c in row["coefficients"])
    status, witness = ("identity-checked" if identity else "unknown"), None
    if not identity:
        for index in range(request["budget"]["max_index"] + 1):
            if index >= order:
                k = index - order
                values.append(sum((a * values[k + j] for j, a in enumerate(weights)), sp.Integer(0)) + forcing.subs(n, k))
            if at(index) != values[index]:
                status = "refuted"
                witness = {"index": index, "candidate_value": str(at(index)), "sequence_value": str(values[index])}
                break
    return {"schema_version": RECEIPT, "request": request, "request_sha256": common.digest(request),
            "status": status, "candidate_initial_values": initial, "residual_by_base": trace, "counterexample": witness}


def check(request, receipt):
    validate(request)
    common.base.keys(receipt, ["schema_version", "request", "request_sha256", "status", "candidate_initial_values", "residual_by_base", "counterexample"])
    common.base.require(receipt["schema_version"] == RECEIPT, "Unknown receipt version")
    common.base.require(common.canonical(receipt["request"]) == common.canonical(request), "Request mismatch")
    common.base.require(receipt["request_sha256"] == common.digest(request), "Request hash mismatch")
    grouped = groups(request)
    weights = list(map(Fraction, request["recurrence_coefficients"]))
    order = len(weights)
    forcing = coefficients(request["forcing"])
    initial = [str(candidate_at(grouped, i)) for i in range(order)]
    trace = []
    for b, p in grouped.items():
        shifts = [polynomial.shifted(p, j) for j in range(order + 1)]
        residual = [b ** order * shifts[order][i] - sum((a * b ** j * shifts[j][i] for j, a in enumerate(weights)), Fraction(0)) -
                    (forcing[i] if b == 1 else 0) for i in range(13)]
        trace.append({"base": str(b), "coefficients": list(map(str, residual))})
    common.base.require(receipt["candidate_initial_values"] == initial, "Incorrect initial-value trace")
    common.base.require(receipt["residual_by_base"] == trace, "Incorrect per-base recurrence trace")
    identity = initial == request["initial_values"] and all(c == "0" for row in trace for c in row["coefficients"])
    status = receipt["status"]
    if status == "identity-checked":
        common.base.require(identity and receipt["counterexample"] is None, "Invalid induction evidence")
    elif status == "refuted":
        witness = receipt["counterexample"]
        common.base.keys(witness, ["index", "candidate_value", "sequence_value"])
        index = witness["index"]
        common.bounded_int(index, 0, request["budget"]["max_index"])
        actual, candidate = polynomial.sequence_values(request)[index], candidate_at(grouped, index)
        common.base.require(actual != candidate and witness["candidate_value"] == str(candidate) and witness["sequence_value"] == str(actual), "Invalid sequence counterexample")
    else:
        common.base.require(status == "unknown" and not identity and receipt["counterexample"] is None, "Invalid unresolved result")
        common.base.require(all(candidate_at(grouped, i) == v for i, v in enumerate(polynomial.sequence_values(request))), "Counterexample exists within budget")
    return {"status": status, "trust": {"identity-checked": "exact-computed", "refuted": "refuted", "unknown": "unverified"}[status],
            "checked": status != "unknown", "proof_checker_backed": False, "recurrence_order": order,
            "candidate_class": "rational-exponential-polynomial",
            "evidence_class": {"identity-checked": "exponential-polynomial-induction-check", "refuted": "exact-sequence-counterexample", "unknown": "none"}[status],
            "domain": "all nonnegative integer indices; u(n+r)=sum(a[j]*u(n+j),j=0..r-1)+f(n)", "counterexample": receipt["counterexample"]}
