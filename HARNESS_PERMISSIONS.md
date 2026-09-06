# HARNESS_PERMISSIONS.md

TLDR. Context = what to see. Loop = whether to act again. This file = what an agent is allowed to do.

Default deny. If a write or tool is not listed, it is blocked.

## Contract

```
READ   only the current run's data
WRITE  only proposed fields for this stage
TOOLS  only the listed tools
ACTIONS propose only — Action Gate executes
```

## Database / CRM

```
ALLOWED     read records, backup, fill missing fields
BLOCKED     delete database, drop tables, delete users, recreate from scratch
```

Missing rows are not a reason to delete people. Backup first. Repair in place. Keep every customer id.

## Action gate

```
agent proposes → permission check → verified state? → execute → verify
```

Delete / send / pay / drop never run because the model feels stuck.

## If blocked

Record the violation. Do not retry the same forbidden action. Find a safe repair.
