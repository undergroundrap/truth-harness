# Strict Claim Examples

These fenced blocks are checked by `theorem check`.

An exact arithmetic receipt:

```theorem-workbench
compute 3 / 4 + 5 / 8
```

An intentionally false universal claim:

```theorem-workbench
expect: refuted
for all integers n, n^2+n+1 is even
```

An intentionally unresolved claim. The expected trust label documents the current limitation instead of hiding it:

```theorem-workbench
expect: unverified
for all integers n, n^2+n is even
```

A physics sanity check:

```theorem-workbench
expect: dimension-checked
dimension check force = mass * acceleration
```

A dimensionally inconsistent formula:

```theorem-workbench
expect: refuted
dimension check force = mass * velocity
```

A symbolic exact computation:

```theorem-workbench
expect: exact-computed
symbolic simplify sin(x)^2 + cos(x)^2
```
