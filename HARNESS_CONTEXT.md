# HARNESS_CONTEXT.md

This file is read by the harness before any agent runs. It defines the business context, competitive stance, and the context-engineering rules every agent invocation must follow. Treat it as the source of truth — if an agent's behavior contradicts this file, the file wins.

---

## 1. Project Context

We are building a new startup that sells laptops to businesses (B2B laptop procurement).

We are a **very early-stage startup.**

We do **not** have the scale, brand recognition, inventory network, or resources of large laptop companies yet. Our goal is not to pretend we're already competing with giants.

**Our strategy, in order:**
```
SMALL STARTUP
  → win against small/local competitors
  → establish product-market fit
  → improve operations
  → expand regionally
  → eventually compete with larger national/international companies
```

The system must reason from the perspective of a startup that has to outperform smaller, realistic competitors first — not one that's already fighting national brands.

---

## 2. Competitive Thinking

Every agent that reasons about a customer opportunity must think in this order:

1. Identify the customer's actual requirement.
2. Identify realistic small/local competitors that could satisfy it.
3. Determine why the customer would choose us over those competitors.
4. Find our startup's strongest realistic advantage.
5. Only then consider how the strategy could scale toward larger competitors.

**Do not** immediately optimize for competing with giant brands.

**Do not assume we have:**
- huge inventory
- nationwide logistics
- lowest price
- famous brand recognition
- enterprise-scale support
- unlimited budget
- unlimited staff

**Win through realistic advantages instead**, such as:
- better personalization
- faster response
- better customer understanding
- better laptop recommendations
- transparent comparison
- better procurement assistance
- faster quotations
- better follow-up
- more reliable workflow
- niche/SMB focus
- superior service

---

## 3. Context Engineering Rules

**The harness controls what each agent sees.** An agent receives only the information relevant to its current task — never the entire customer record, entire conversation history, every tool description, or every previous agent's raw result.

For every agent invocation, the harness constructs a **task-specific context** containing only:

1. Current task
2. Agent role
3. Relevant customer/company information
4. Relevant verified facts
5. Relevant previous-stage results
6. Required business rules
7. Only the tools required for the current stage
8. Relevant memory/history
9. Current workflow state

Everything else is excluded.

### Context Selection Rule
Before calling an agent, the harness must ask:

> "What information does this specific agent need to perform this specific task?"

Only that information is passed. Nothing more.

---

## 4. Verified vs. Unverified Information

The harness must always distinguish between four categories:

- **VERIFIED FACT**
- **INFERENCE**
- **UNVERIFIED CLAIM**
- **UNKNOWN**

Agents must never treat an unverified claim as a verified fact.

---

## 5. Context Compaction

Long histories must never be repeatedly passed to the model in raw form. Convert completed stages into structured summaries.

Keep the structured state. Discard conversational noise.

---

## 6. Startup Competition Rule

When evaluating any customer opportunity, reason about beating a **realistic** smaller competitor first:

```
CUSTOMER NEED
  → local reseller may compete
  → regional retailer may compete
  → specialized B2B laptop provider may compete
  → THEN consider national/international giants
```

Strategies must be things a small startup can realistically execute.

**Do not produce:** "Become cheaper than every global laptop company."

**Do produce:** "Win this customer by providing a faster customized quote, better configuration matching, transparent comparison, and dedicated procurement support."

When asked for competitive analysis of a laptop company, **start with small and emerging makers / local contract manufacturers / SMB-focused brands** (for example Indian EMS/ODM and student-laptop startups). Name those first. Only mention Dell, HP, Lenovo, Apple after the small-competitor map is complete.

---

## 7. Business Decision Principle

Optimize for:

> **REALISTIC STARTUP ADVANTAGE**

not:

> theoretical maximum scale.

---

## 8. Final Rule

The harnessed agent must always treat context as a controlled resource. It should never assume "more context = better reasoning."

Instead:

> **Relevant context = better reasoning, lower cost, lower noise, and more reliable decisions.**

The harness — not the model, and not habit — is responsible for selecting, filtering, structuring, and updating context before every agent execution.
