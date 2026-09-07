"""Exact, exhaustive support certificates for one bounded sparse class."""

import json
import sys
from fractions import Fraction
from itertools import combinations
import pit_certificate as base

CLASS = "rational-bivariate-individual-degree-two-sparsity-two"
BASIS = [[a, b] for b in range(3) for a in range(3)]
SUPPORTS = [list(s) for size in (1, 2) for s in combinations(range(9), size)]


def validate_request(request):
    base.keys(request, ["schema_version", "polynomial_class", "points"])
    base.require(request["schema_version"] == "truth-harness.pit-sparse-request.v0", "Unknown sparse version")
    base.require(request["polynomial_class"] == CLASS, "Unsupported sparse class")
    return base.validate_request({"schema_version": "truth-harness.pit-request.v0", "polynomial_class": base.CLASS, "points": request["points"]})


def evaluation_matrix(points):
    return [[Fraction(x ** a * y ** b) for a, b in BASIS] for x, y in points]


def construct(request):
    import sympy as sp

    points = validate_request(request)
    full = sp.Matrix([[int(v) for v in row] for row in evaluation_matrix(points)])
    certificates = []
    for support in SUPPORTS:
        matrix = full[:, support]
        nullspace = matrix.nullspace()
        if nullspace:
            vector = ["0"] * 9
            for i, index in enumerate(support):
                vector[index] = str(nullspace[0][i])
            certificate = {"kind": "sparse_vanishing_polynomial", "coefficients": vector}
            break
        rows = list(matrix.T.rref()[1])
        inverse = matrix[rows, :].inv()
        left = sp.zeros(len(support), len(points))
        for j, row in enumerate(rows):
            left[:, row] = inverse[:, j]
        certificates.append({"support": support, "matrix": [[str(left[i, j]) for j in range(len(points))] for i in range(len(support))]})
    else:
        certificate = {"kind": "all_support_left_inverses", "supports": certificates}
    return {"schema_version": "truth-harness.pit-sparse-certificate.v0", "request": request, "basis": BASIS, "certificate": certificate}


def check(bundle):
    base.keys(bundle, ["schema_version", "request", "basis", "certificate"])
    base.require(bundle["schema_version"] == "truth-harness.pit-sparse-certificate.v0", "Unknown certificate version")
    base.require(json.dumps(bundle["basis"]) == json.dumps(BASIS), "Wrong sparse basis")
    points = validate_request(bundle["request"])
    matrix = evaluation_matrix(points)
    certificate = bundle["certificate"]
    base.require(type(certificate) is dict, "Invalid certificate")
    if certificate.get("kind") == "all_support_left_inverses":
        base.keys(certificate, ["kind", "supports"])
        entries = certificate["supports"]
        base.require(type(entries) is list and len(entries) == len(SUPPORTS), "Require all 45 supports")
        for entry, support in zip(entries, SUPPORTS):
            base.keys(entry, ["support", "matrix"])
            base.require(json.dumps(entry["support"]) == json.dumps(support), "Missing, duplicated, or reordered support")
            left = entry["matrix"]
            base.require(type(left) is list and len(left) == len(support), "Wrong inverse height")
            base.require(all(type(row) is list and len(row) == len(points) for row in left), "Wrong inverse width")
            left = [[base.rational(v) for v in row] for row in left]
            for i in range(len(support)):
                for j, column in enumerate(support):
                    base.require(sum(left[i][k] * matrix[k][column] for k in range(len(points))) == int(i == j), "Support inverse identity failed")
        return {"conclusion": "hits-class", "trust": "exact-computed", "evidence_class": "exhaustive-support-linear-algebra", "supports_checked": len(SUPPORTS)}
    base.require(certificate.get("kind") == "sparse_vanishing_polynomial", "Unsupported certificate kind")
    base.keys(certificate, ["kind", "coefficients"])
    vector = certificate["coefficients"]
    base.require(type(vector) is list and len(vector) == 9, "Wrong coefficient dimension")
    vector = [base.rational(v) for v in vector]
    base.require(1 <= sum(v != 0 for v in vector) <= 2, "Counterexample must have one or two nonzero terms")
    base.require(all(sum(a * b for a, b in zip(row, vector)) == 0 for row in matrix), "Polynomial does not vanish")
    return {"conclusion": "misses-class", "trust": "refuted", "evidence_class": "exact-sparse-counterexample"}


if __name__ == "__main__":
    try:
        base.require(sys.argv[1:] in (["construct"], ["check"]), "Expected construct or check")
        raw = sys.stdin.buffer.read(32769)
        base.require(len(raw) <= 32768, "Input too large")
        data = json.loads(raw.decode("utf-8"), object_pairs_hook=base.unique_object)
        result = construct(data) if sys.argv[1] == "construct" else check(data)
        print(json.dumps(result, sort_keys=True, separators=(",", ":")))
    except Exception as error:
        print(json.dumps({"status": "unverified", "error": str(error)}), file=sys.stderr)
        sys.exit(1)
