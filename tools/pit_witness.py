"""Bounded prime-power witness construction and fresh-process exact checking."""

import hashlib
import json
import sys
from fractions import Fraction
import pit_certificate as base

PRIMES = (2, 3, 5, 7, 11, 13, 17, 19)
REQUEST_VERSION = "truth-harness.pit-witness-request.v0"
RECEIPT_VERSION = "truth-harness.pit-witness.v0"


def canonical(value):
    return json.dumps(value, sort_keys=True, separators=(",", ":"), ensure_ascii=True)


def digest(value):
    return hashlib.sha256(canonical(value).encode("ascii")).hexdigest()


def decode(raw):
    base.require(type(raw) is str and len(raw.encode("utf-8")) <= 65536, "Input too large")
    return json.loads(raw, object_pairs_hook=base.unique_object)


def bounded_int(value, low, high):
    base.require(type(value) is int and low <= value <= high, "Integer outside supported bounds")


def validate(request):
    base.keys(request, ["schema_version", "variables", "terms", "budget"])
    base.require(request["schema_version"] == REQUEST_VERSION, "Unknown request version")
    bounded_int(request["variables"], 1, len(PRIMES))
    terms = request["terms"]
    base.require(type(terms) is list and 1 <= len(terms) <= 128, "Require 1..128 terms")
    for term in terms:
        base.keys(term, ["coefficient", "exponents"])
        base.rational(term["coefficient"])
        exponents = term["exponents"]
        base.require(type(exponents) is list and len(exponents) == request["variables"], "Wrong exponent dimension")
        for exponent in exponents:
            bounded_int(exponent, 0, 1000000)
    base.keys(request["budget"], ["max_samples", "max_bits"])
    bounded_int(request["budget"]["max_samples"], 1, 128)
    bounded_int(request["budget"]["max_bits"], 128, 4096)


def normalized_fractions(request):
    terms = {}
    for term in request["terms"]:
        key = tuple(term["exponents"])
        terms[key] = terms.get(key, Fraction(0)) + Fraction(term["coefficient"])
    return {key: value for key, value in terms.items() if value}


def within_bits(terms, k, primes, limit):
    # Conservative upper bound for powers, term numerators and a common-denominator
    # sum. Reject before constructing any prime power. Parsing/normalization has
    # separate fixed input limits; this is not a bound on Python process memory.
    if any(k * p.bit_length() + 1 > limit for p in primes):
        return False
    denominators = sum(c.denominator.bit_length() for c in terms.values())
    numerator = max((abs(c.numerator).bit_length() +
                     sum(k * e * p.bit_length() for e, p in zip(d, primes))
                     for d, c in terms.items()), default=0)
    return numerator + denominators + len(terms).bit_length() + 1 <= limit


def construct(request):
    import sympy as sp

    validate(request)
    coefficients = {}
    for term in request["terms"]:
        key = tuple(term["exponents"])
        coefficients[key] = coefficients.get(key, sp.Rational(0)) + sp.Rational(term["coefficient"])
    # Keep sparse storage: dense polynomial representations can allocate by degree.
    coefficients = {d: c for d, c in coefficients.items() if c}
    terms = {d: Fraction(int(c.p), int(c.q)) for d, c in coefficients.items()}
    primes = PRIMES[:request["variables"]]
    result = {
        "schema_version": RECEIPT_VERSION, "request": request,
        "request_sha256": digest(request), "status": "unknown", "trust": "unverified",
        "evidence_class": "none", "reason": "zero_polynomial" if not terms else "sample_budget",
        "samples_checked": 0, "witness": None,
    }
    for k in range(min(len(terms), request["budget"]["max_samples"])):
        if not within_bits(terms, k, primes, request["budget"]["max_bits"]):
            result["reason"] = "bit_budget"
            return result
        point = [p ** k for p in primes]
        value = sp.Rational(0)
        for degrees, coefficient in coefficients.items():
            term = coefficient
            for x, exponent in zip(point, degrees):
                term *= sp.Integer(x) ** exponent
            value += term
        result["samples_checked"] += 1
        if value:
            result.update(status="witness-found", trust="exact-computed",
                          evidence_class="exact-polynomial-evaluation", reason="nonzero_evaluation",
                          witness={"sample_index": k, "point": list(map(str, point)), "value": str(value)})
            return result
    if terms and result["samples_checked"] == len(terms):
        result["reason"] = "no_witness"
    return result


def check(envelope):
    # This mode deliberately never imports SymPy and binds to the caller's request.
    base.keys(envelope, ["request_json", "receipt_json"])
    request = decode(envelope["request_json"])
    result = decode(envelope["receipt_json"])
    validate(request)
    base.keys(result, ["schema_version", "request", "request_sha256", "status", "trust",
                       "evidence_class", "reason", "samples_checked", "witness"])
    base.require(result["schema_version"] == RECEIPT_VERSION, "Unknown receipt version")
    base.require(canonical(result["request"]) == canonical(request), "Request mismatch")
    base.require(result["request_sha256"] == digest(request), "Request hash mismatch")
    bounded_int(result["samples_checked"], 0, request["budget"]["max_samples"])
    if result["status"] == "unknown":
        base.require(result["trust"] == "unverified" and result["evidence_class"] == "none" and
                     result["witness"] is None and result["reason"] in
                     ("zero_polynomial", "sample_budget", "bit_budget", "no_witness"), "Invalid unresolved receipt")
        return {"status": "unknown", "trust": "unverified", "checked": False}
    base.require(result["status"] == "witness-found" and result["trust"] == "exact-computed" and
                 result["evidence_class"] == "exact-polynomial-evaluation" and
                 result["reason"] == "nonzero_evaluation", "Invalid witness status")
    witness = result["witness"]
    base.keys(witness, ["sample_index", "point", "value"])
    k = witness["sample_index"]
    terms = normalized_fractions(request)
    bounded_int(k, 0, min(len(terms), request["budget"]["max_samples"]) - 1)
    base.require(result["samples_checked"] == k + 1, "Invalid sample count")
    primes = PRIMES[:request["variables"]]
    base.require(within_bits(terms, k, primes, request["budget"]["max_bits"]), "Witness exceeds bit budget")
    point = [p ** k for p in primes]
    base.require(witness["point"] == list(map(str, point)), "Incorrect sample point")
    value = Fraction(0)
    for d, c in terms.items():
        term = c
        for x, exponent in zip(point, d):
            term *= x ** exponent
        value += term
    base.require(value != 0 and witness["value"] == str(value), "Incorrect nonzero evaluation")
    return {"status": "witness-found", "trust": "exact-computed", "checked": True}


if __name__ == "__main__":
    try:
        base.require(sys.argv[1:] in (["construct"], ["check"]), "Expected construct or check")
        # The check envelope holds two bounded JSON strings plus escaping overhead.
        raw = sys.stdin.buffer.read(262145)
        base.require(len(raw) <= 262144, "Envelope too large")
        data = json.loads(raw.decode("utf-8"), object_pairs_hook=base.unique_object)
        if sys.argv[1] == "construct":
            base.require(len(raw) <= 65536, "Input too large")
        output = construct(data) if sys.argv[1] == "construct" else check(data)
        print(canonical(output))
    except Exception as error:
        print(canonical({"status": "unverified", "error": str(error)}), file=sys.stderr)
        sys.exit(1)
