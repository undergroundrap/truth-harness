"""Bounded Q[x,y] degree-two experiment; no expression evaluation or network."""

import json
import re
import sys
from fractions import Fraction

CLASS = "rational-bivariate-total-degree-at-most-two"
BASIS = [[0, 0], [1, 0], [0, 1], [2, 0], [1, 1], [0, 2]]


def require(condition, message):
    if not condition:
        raise ValueError(message)


def keys(value, expected):
    require(type(value) is dict and set(value) == set(expected), "Unexpected fields")


def validate_request(request):
    keys(request, ["schema_version", "polynomial_class", "points"])
    require(request["schema_version"] == "truth-harness.pit-request.v0", "Unknown version")
    require(request["polynomial_class"] == CLASS, "Unsupported polynomial class")
    points = request["points"]
    require(type(points) is list and 1 <= len(points) <= 16, "Require 1..16 points")
    for point in points:
        require(type(point) is list and len(point) == 2, "Require coordinate pairs")
        require(all(type(x) is int and -10 <= x <= 10 for x in point), "Require bounded integer coordinates")
    require(len(set(map(tuple, points))) == len(points), "Duplicate points")
    return points


def evaluation_matrix(points):
    return [[Fraction(x ** a * y ** b) for a, b in BASIS] for x, y in points]


def construct(request):
    # SymPy constructs certificates. The checker below uses only stdlib fractions.
    import sympy as sp

    points = validate_request(request)
    matrix = sp.Matrix([[int(v) for v in row] for row in evaluation_matrix(points)])
    nullspace = matrix.nullspace()
    if nullspace:
        certificate = {"kind": "vanishing_polynomial", "coefficients": [str(v) for v in nullspace[0]]}
    else:
        rows = list(matrix.T.rref()[1])
        inverse = matrix[rows, :].inv()
        left = sp.zeros(6, len(points))
        for j, row in enumerate(rows):
            left[:, row] = inverse[:, j]
        certificate = {"kind": "left_inverse", "matrix": [[str(left[i, j]) for j in range(len(points))] for i in range(6)]}
    return {"schema_version": "truth-harness.pit-certificate.v0", "request": request, "basis": BASIS, "certificate": certificate}


def rational(value):
    require(type(value) is str and len(value) <= 48, "Invalid rational encoding")
    require(re.fullmatch(r"-?(0|[1-9][0-9]{0,20})(/[1-9][0-9]{0,20})?", value) is not None, "Invalid rational")
    result = Fraction(value)
    require(str(result) == value, "Noncanonical rational")
    return result


def check(bundle):
    keys(bundle, ["schema_version", "request", "basis", "certificate"])
    require(bundle["schema_version"] == "truth-harness.pit-certificate.v0", "Unknown certificate version")
    require(json.dumps(bundle["basis"]) == json.dumps(BASIS), "Wrong monomial basis")
    points = validate_request(bundle["request"])
    matrix = evaluation_matrix(points)
    certificate = bundle["certificate"]
    require(type(certificate) is dict, "Invalid certificate")
    if certificate.get("kind") == "left_inverse":
        keys(certificate, ["kind", "matrix"])
        left = certificate["matrix"]
        require(type(left) is list and len(left) == 6, "Wrong left inverse height")
        require(all(type(row) is list and len(row) == len(points) for row in left), "Wrong left inverse width")
        left = [[rational(v) for v in row] for row in left]
        for i in range(6):
            for j in range(6):
                require(sum(left[i][k] * matrix[k][j] for k in range(len(points))) == int(i == j), "Left inverse identity failed")
        return {"conclusion": "hits-class", "trust": "exact-computed", "evidence_class": "exact-linear-algebra-certificate"}
    require(certificate.get("kind") == "vanishing_polynomial", "Unsupported certificate kind")
    keys(certificate, ["kind", "coefficients"])
    vector = certificate["coefficients"]
    require(type(vector) is list and len(vector) == 6, "Wrong coefficient dimension")
    vector = [rational(v) for v in vector]
    require(any(vector), "Zero polynomial is not a counterexample")
    require(all(sum(a * b for a, b in zip(row, vector)) == 0 for row in matrix), "Polynomial does not vanish at all points")
    return {"conclusion": "misses-class", "trust": "refuted", "evidence_class": "exact-counterexample"}


def unique_object(pairs):
    result = {}
    for key, value in pairs:
        require(key not in result, "Duplicate JSON field")
        result[key] = value
    return result


if __name__ == "__main__":
    try:
        require(sys.argv[1:] in (["construct"], ["check"]), "Expected construct or check")
        raw = sys.stdin.buffer.read(32769)
        require(len(raw) <= 32768, "Input too large")
        data = json.loads(raw.decode("utf-8"), object_pairs_hook=unique_object)
        result = construct(data) if sys.argv[1] == "construct" else check(data)
        print(json.dumps(result, sort_keys=True, separators=(",", ":")))
    except Exception as error:
        print(json.dumps({"status": "unverified", "error": str(error)}), file=sys.stderr)
        sys.exit(1)
