import json
import re
import sys

try:
    import sympy as sp
    from sympy.parsing.sympy_parser import (
        convert_xor,
        implicit_multiplication_application,
        parse_expr,
        standard_transformations,
    )
except Exception as import_error:
    sp = None
    parse_expr = None
    convert_xor = None
    implicit_multiplication_application = None
    standard_transformations = ()
    IMPORT_ERROR = import_error
else:
    IMPORT_ERROR = None


ALLOWED_PATTERN = re.compile(r"^[A-Za-z0-9_+\-*/^().,\s]+$")
SAFE_GLOBAL_DICT = dict(sp.__dict__) if sp is not None else {}
SAFE_GLOBAL_DICT["__builtins__"] = {}
TRANSFORMATIONS = standard_transformations + tuple(
    transformation
    for transformation in (convert_xor, implicit_multiplication_application)
    if transformation is not None
)


def main() -> int:
    try:
        if IMPORT_ERROR is not None:
            raise RuntimeError(f"SymPy is not available: {IMPORT_ERROR}")

        request = json.load(sys.stdin)
        operation = str(request["operation"]).lower()
        expression_source = str(request["expression"])
        variable_name = str(request.get("variable") or "x")

        expression = parse_safe_expr(expression_source)
        variable = sp.Symbol(variable_name)

        if operation == "simplify":
            result = sp.simplify(expression)
        elif operation == "factor":
            result = sp.factor(expression)
        elif operation == "expand":
            result = sp.expand(expression)
        elif operation == "differentiate":
            result = sp.diff(expression, variable)
        elif operation == "integrate":
            result = sp.integrate(expression, variable)
        else:
            raise ValueError(f"Unsupported operation: {operation}")

        print(
            json.dumps(
                {
                    "ok": True,
                    "operation": operation,
                    "expression": expression_source,
                    "variable": variable_name,
                    "result": str(result),
                    "srepr": sp.srepr(result),
                    "latex": sp.latex(result),
                    "checks": build_checks(operation, expression, result, variable),
                    "sympyVersion": sp.__version__,
                },
                sort_keys=True,
            )
        )
        return 0
    except Exception as error:
        print(
            json.dumps(
                {
                    "ok": False,
                    "error": str(error),
                    "errorType": type(error).__name__,
                },
                sort_keys=True,
            )
        )
        return 1


def parse_safe_expr(source: str):
    if sp is None or parse_expr is None:
        raise RuntimeError("SymPy is not available")

    if "__" in source or not ALLOWED_PATTERN.match(source):
        raise ValueError("Expression contains unsupported characters")

    names = set(re.findall(r"[A-Za-z_][A-Za-z0-9_]*", source))
    local_dict = {name: sp.Symbol(name) for name in names}
    local_dict.update(
        {
            "sin": sp.sin,
            "cos": sp.cos,
            "tan": sp.tan,
            "exp": sp.exp,
            "log": sp.log,
            "sqrt": sp.sqrt,
            "pi": sp.pi,
            "E": sp.E,
        }
    )

    return parse_expr(
        source,
        local_dict=local_dict,
        global_dict=SAFE_GLOBAL_DICT,
        transformations=TRANSFORMATIONS,
        evaluate=True,
    )


def build_checks(operation: str, expression, result, variable):
    if operation in {"simplify", "factor", "expand"}:
        return [
            symbolic_zero_check("symbolic-equivalence", expression - result),
            numeric_sample_check("numeric-sample-equivalence", expression, result, variable),
        ]

    if operation == "differentiate":
        derived = sp.diff(expression, variable)
        return [
            symbolic_zero_check("derivative-equivalence", derived - result),
            numeric_sample_check("numeric-derivative-equivalence", derived, result, variable),
        ]

    if operation == "integrate":
        derived = sp.diff(result, variable)
        return [
            symbolic_zero_check("integral-derivative-equivalence", derived - expression),
            numeric_sample_check("numeric-integral-derivative-equivalence", derived, expression, variable),
        ]

    return [
        {
            "id": "unsupported-operation-check",
            "status": "warning",
            "detail": f"No sanity check implemented for operation {operation}.",
        }
    ]


def symbolic_zero_check(check_id: str, residual):
    try:
        simplified = sp.simplify(residual)
        if simplified == 0 or simplified.is_zero is True:
            return {
                "id": check_id,
                "status": "passed",
                "detail": "Symbolic residual simplified to 0.",
                "residual": str(simplified),
            }

        status = "warning" if simplified.is_zero is None else "failed"
        return {
            "id": check_id,
            "status": status,
            "detail": "Symbolic residual did not simplify to 0.",
            "residual": str(simplified),
        }
    except Exception as error:
        return {
            "id": check_id,
            "status": "warning",
            "detail": f"Symbolic residual check could not run: {error}",
        }


def numeric_sample_check(check_id: str, left, right, variable):
    samples = []
    skipped = 0
    failures = []

    for value in [-3, -2, -1, 0, 1, 2, 3]:
        try:
            left_value = sp.N(left.subs(variable, value), 30)
            right_value = sp.N(right.subs(variable, value), 30)
            residual = sp.N(sp.simplify(left_value - right_value), 30)
            if not residual.is_number or has_invalid_number(left_value, right_value, residual):
                skipped += 1
                continue

            passed = residual == 0 or abs(complex(residual)) <= 1e-9
            sample = {
                "variable": str(variable),
                "value": str(value),
                "left": str(left_value),
                "right": str(right_value),
                "residual": str(residual),
                "passed": passed,
            }
            samples.append(sample)
            if not passed:
                failures.append(sample)
        except Exception:
            skipped += 1

    if failures:
        return {
            "id": check_id,
            "status": "failed",
            "detail": f"{len(failures)} numeric sample(s) disagreed.",
            "samples": samples,
            "skipped": skipped,
        }

    if len(samples) >= 3:
        return {
            "id": check_id,
            "status": "passed",
            "detail": f"{len(samples)} deterministic numeric sample(s) agreed.",
            "samples": samples,
            "skipped": skipped,
        }

    return {
        "id": check_id,
        "status": "warning",
        "detail": "Fewer than three safe numeric samples were available.",
        "samples": samples,
        "skipped": skipped,
    }


def has_invalid_number(*values) -> bool:
    invalids = (sp.zoo, sp.oo, -sp.oo, sp.nan)
    return any(value.has(*invalids) for value in values)


if __name__ == "__main__":
    raise SystemExit(main())
