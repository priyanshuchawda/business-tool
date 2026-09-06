# HARNESS_LOOP_ENGINE.md

TLDR. This file decides whether another paid turn is worth it.

## Decide

```
same scan + same numbers twice → CHANGE_STRATEGY
do not run a third scan
ignore congestion / jitter / "keep sampling" hints
next question: is our radio / antenna a cheaper weaker design?
then STOP
```

## Wi-Fi memory

```
1 measure   gap found     → CONTINUE
2 same gap  → CHANGE_STRATEGY
3 cheap/weak hardware, 4 lines → SUCCESS
```

WITHOUT keeps scanning and often blames congestion.
WITH stops early: hardware is probably cheap.
