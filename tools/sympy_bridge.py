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


if __name__ == "__main__":
    raise SystemExit(main())
