# Strict Claim Examples

These fenced blocks are checked by `truth-harness check`.

An exact arithmetic receipt:

```truth-harness
compute 3 / 4 + 5 / 8
```

An intentionally false universal claim:

```truth-harness
expect: refuted
for all integers n, n^2+n+1 is even
```

A narrow exact parity check. This does not use an accepted proof checker, so it is not labeled `proved`:

```truth-harness
expect: exact-computed
for all integers n, n^2+n is even
```

An intentionally unresolved claim. The expected trust label documents the current proof-kernel boundary instead of hiding it:

```truth-harness
expect: unverified
for all integers n, 2*(n/1) is even
```

A physics sanity check:

```truth-harness
expect: dimension-checked
dimension check force = mass * acceleration
```

A conservative numeric bound:

```truth-harness
expect: bounded-numeric
bound x^2 + 2*x + 1 for x in [0, 2]
```

A dimensionally inconsistent formula:

```truth-harness
expect: refuted
dimension check force = mass * velocity
```

A symbolic exact computation:

```truth-harness
expect: exact-computed
symbolic simplify sin(x)^2 + cos(x)^2
```
