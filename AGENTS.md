# Repository Guidelines


## 1. Never Assume

If any requirement, behavior, naming, or constraint is unclear:
- STOP.
- Ask questions before writing code.
- Provide clear options with tradeoffs when applicable.

Do NOT guess defaults.
Do NOT infer intent.
Do NOT “fill the gaps” silently.

---

## 2. Small, Safe Changes

- Prefer small, incremental changes.
- Each change should keep the project buildable and runnable.
- Avoid large refactors unless explicitly requested.
- One concern per change.

---

## 3. Clarity Over Cleverness

- Prefer readable, boring, explicit code.
- Avoid over-engineering.
- Avoid unnecessary abstractions.
- Optimize for maintainability, not novelty.

---

## 4. Structure & Boundaries

- Keep clear separation of concerns.
- Avoid mixing unrelated responsibilities in the same module.
- Business logic must not live in UI layers.
- IO (network, DB, filesystem) should be isolated where possible.

---

## 5. Types & Validation

- TypeScript-first mindset.
- Strong typing at boundaries (inputs / outputs).
- Validate external input explicitly.
- Do not trust user input or external systems.

---

## 6. Data Integrity First

- Prefer enforcing invariants at the data layer when possible.
- Use transactions where consistency matters.
- Do not rely on frontend checks for correctness.

---

## 7. Naming & Consistency

- Use consistent terminology throughout the codebase.
- Do not introduce new terms without confirmation.
- Prefer explicit names over short or clever ones.

---

## 8. Testing Expectations

- Add tests for critical logic when feasible.
- If tests are skipped, explain why and suggest follow-up.
- Tests should reflect real use cases, not implementation details.

---

## 9. Refactoring Rules

- No refactoring unless:
  - It improves correctness, or
  - It is explicitly requested.
- Do not refactor “while you’re here”.
- Avoid touching unrelated code.

---

## 10. Agent Workflow (Required)

When working on any task:

1. Restate the goal briefly.
2. List questions if anything is unclear.
3. Propose a clear plan before implementing.
4. Implement in small steps.
5. Summarize:
   - What changed
   - How to run
   - How to verify
   - Known limitations or follow-ups

---

## 11. Default Behavior

- If unsure → ask.
- If ambiguous → ask.
- If risky → explain first.

