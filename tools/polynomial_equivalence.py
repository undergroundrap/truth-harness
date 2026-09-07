"""Bounded sparse polynomial equality over Q, with independently checked evidence."""
import json
import sys
from fractions import Fraction
import pit_witness as witness

VERSION = "truth-harness.polynomial-equivalence.v0"
RECEIPT = "truth-harness.polynomial-equivalence-receipt.v0"


def side_request(request, terms):
    return {"schema_version": witness.REQUEST_VERSION, "variables": request["variables"],
            "terms": terms or [{"coefficient": "0", "exponents": [0] * request["variables"]}],
            "budget": request["budget"]}


def validate(request):
    witness.base.keys(request, ["schema_version", "variables", "left", "right", "budget"])
    witness.base.require(request["schema_version"] == VERSION, "Unknown request version")
    witness.bounded_int(request["variables"], 1, 8)
    for side in ("left", "right"):
        terms = request[side]
        witness.base.require(type(terms) is list and len(terms) <= 64, "Each side requires 0..64 sparse terms")
        witness.validate(side_request(request, terms))


def difference_request(request):
    # Retain original terms rather than passing potentially larger normalized
    # coefficients through the witness input's 21-digit rational limit.
    negative = [{"coefficient": str(-Fraction(t["coefficient"])), "exponents": t["exponents"]}
                for t in request["right"]]
    return side_request(request, request["left"] + negative)


def trace(left, right):
    return [{"exponents": list(degrees), "left": str(left.get(degrees, 0)), "right": str(right.get(degrees, 0))}
            for degrees in sorted(set(left) | set(right))]


def construct(request):
    import sympy as sp
    validate(request)
    sides = []
    for side in ("left", "right"):
        coefficients = {}
        for term in request[side]:
            degrees = tuple(term["exponents"])
            coefficients[degrees] = coefficients.get(degrees, sp.Rational(0)) + sp.Rational(term["coefficient"])
        sides.append({d: c for d, c in coefficients.items() if c})
    equal = sides[0] == sides[1]
    witness_receipt = None if equal else witness.construct(difference_request(request))
    status = "equivalent" if equal else "refuted" if witness_receipt["status"] == "witness-found" else "unknown"
    return {"schema_version": RECEIPT, "request": request, "request_sha256": witness.digest(request),
            "status": status, "trust": {"equivalent": "exact-computed", "refuted": "refuted", "unknown": "unverified"}[status],
            "evidence_class": {"equivalent": "coefficient-normalization", "refuted": "exact-polynomial-counterexample", "unknown": "none"}[status],
            "coefficient_trace": trace(*sides), "witness_receipt": witness_receipt}


def check(envelope):
    # This acceptance path uses only the Python standard library, never SymPy.
    witness.base.keys(envelope, ["request_json", "receipt_json"])
    request = witness.decode(envelope["request_json"])
    receipt = witness.decode(envelope["receipt_json"])
    validate(request)
    witness.base.keys(receipt, ["schema_version", "request", "request_sha256", "status", "trust", "evidence_class", "coefficient_trace", "witness_receipt"])
    witness.base.require(receipt["schema_version"] == RECEIPT, "Unknown receipt version")
    witness.base.require(witness.canonical(receipt["request"]) == witness.canonical(request), "Request mismatch")
    witness.base.require(receipt["request_sha256"] == witness.digest(request), "Request hash mismatch")
    sides = [witness.normalized_fractions(side_request(request, request[side])) for side in ("left", "right")]
    witness.base.require(witness.canonical(receipt["coefficient_trace"]) == witness.canonical(trace(*sides)), "Incorrect coefficient trace")
    equal = sides[0] == sides[1]
    if equal:
        witness.base.require(receipt["status"] == "equivalent" and receipt["trust"] == "exact-computed" and
                             receipt["evidence_class"] == "coefficient-normalization" and receipt["witness_receipt"] is None, "Invalid equivalence evidence")
        checked = True
    else:
        nested = witness.check({"request_json": witness.canonical(difference_request(request)),
                                "receipt_json": witness.canonical(receipt["witness_receipt"])})
        checked = nested["checked"]
        status, trust, evidence = ("refuted", "refuted", "exact-polynomial-counterexample") if checked else ("unknown", "unverified", "none")
        witness.base.require((receipt["status"], receipt["trust"], receipt["evidence_class"]) == (status, trust, evidence), "Invalid inequality evidence")
    return {"status": receipt["status"], "trust": receipt["trust"], "checked": checked,
            "proof_checker_backed": False, "evidence_class": receipt["evidence_class"]}


if __name__ == "__main__":
    try:
        witness.base.require(sys.argv[1:] in (["construct"], ["check"]), "Expected construct or check")
        raw = sys.stdin.buffer.read(262145)
        witness.base.require(len(raw) <= 262144, "Envelope too large")
        text = raw.decode("utf-8")
        value = witness.decode(text) if sys.argv[1] == "construct" else json.loads(text, object_pairs_hook=witness.base.unique_object)
        print(witness.canonical(construct(value) if sys.argv[1] == "construct" else check(value)))
    except Exception as error:
        print(witness.canonical({"status": "unverified", "error": str(error)}), file=sys.stderr)
        sys.exit(1)
