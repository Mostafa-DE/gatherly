# CODE_STYLE

This guide consolidates coding conventions from `~/code/spank/AGENTS.md`, `~/code/spank/CLAUDE.md`, and SPANK code-guidance docs (`docs/testing-guide.md`, architecture notes).

## 1. Core Principles

- Prefer explicit, declarative code over clever or implicit behavior.
- Keep implementations boring and maintainable.
- Use strong typing everywhere; avoid weak types and `any`.
- Prefer `type` over `interface` unless implementing a class.

## 2. Architecture Boundaries

- Keep business logic in use-case functions using native data structures.
- Use repository functions (injected via context) for database access.
- Simple CRUD-only tRPC endpoints may access DB directly.
- Keep DB schema/config isolated; do not scatter DB concerns across features.
- Shared/core DB tables belong in `src/db/schema.ts`; plugin-owned DB tables may live in plugin modules (for example, `src/plugins/<plugin>/schema.ts`) when they are plugin-specific.
- It is acceptable to compose plugin DB schemas in central wiring (for example, `drizzle.config.ts` and `src/db/index.ts`) when this is the project architecture.
- Shared validation schemas belong in `src/schemas`; plugin-specific validation schemas may live in plugin-owned modules.
- Preserve separation between UI, business logic, and IO.

## 3. Frontend Rules

- Use Tailwind CSS, shadcn/ui, and Jotai.
- Avoid custom CSS unless explicitly required.
- Do not use React Context for app state.
- Avoid `useState` for shared/client state; model it in atoms.
- Treat `useEffect` as last resort; prefer action-driven state changes.
- Use TanStack Query for server state; do not mirror server data into Jotai atoms.
- **No `"use client"` or `"use server"` directives.** This project uses TanStack Start + Nitro, not Next.js. There are no React Server Components — all components are client components by default.

### 3.1 `useEffect` Rules (High Priority)

Use `useEffect` only for syncing React with **external systems**. If there is no external system, do not use it.

Allowed `useEffect` cases:
- Subscribing/unsubscribing to external event sources.
- Managing timers/intervals with cleanup.
- Syncing to browser APIs (`localStorage`, `document`, `window`, URL APIs) when needed.
- Integrating imperative third-party libraries that require lifecycle hooks.

Not allowed `useEffect` cases:
- Deriving state from props/state (compute inline, use memoization, or reducers).
- Handling user actions (`onClick`, `onChange`, form submit) that should be handled directly in event handlers.
- Fetching server data manually (use TanStack Query).
- Mirroring server data into local/Jotai state without a hard requirement.
- Triggering business logic chains that should live in explicit actions/use-cases.

Required standards when `useEffect` is used:
- Include all real dependencies (do not silence `exhaustive-deps` without strong justification).
- Make effects idempotent and safe on re-run.
- Always return cleanup for subscriptions, listeners, timers, and imperative integrations.
- For async work, handle cancellation/race conditions (for example with `AbortController` or stale guards).
- Add a one-line comment for non-obvious effects explaining the external system being synchronized.

Quick decision check before adding `useEffect`:
1. Is this syncing with an external system?
2. Can this be done in render, an event handler, TanStack Query, or a derived value instead?
3. Do I have correct dependencies and cleanup?
If any answer is "no", do not add the effect.

## 4. TypeScript, Naming, and Formatting

- Language: TypeScript (strict).
- Formatting: 2-space indentation, no semicolons.
- Use `@/` path alias where configured.
- File naming: `kebab-case` for files; React components in `PascalCase.tsx`.
- Use `pnpm` for package management and scripts.

## 5. Testing Standards

Testing is required for behavior changes. If code changes behavior and no test is added/updated, explain why.

Mandatory rules:
- Ship tests with every feature or bug fix (before or alongside implementation, never after release).
- Prefer integration/E2E tests for user-facing and API behavior.
- Use unit tests only for complex pure logic that is hard to validate via integration tests.
- Test observable behavior, not internal implementation details.
- Use Arrange -> Act -> Assert structure.
- Keep tests deterministic and isolated (no timing races, no hidden cross-test state).

Test type guidance:
- Integration tests: default choice for routes, tRPC procedures, DB behavior, permissions, and workflows.
- E2E tests: use for critical user journeys and release-critical flows.
- Unit tests: use for pure domain logic, parsers, transformers, and utilities with meaningful branching.
- UI component tests: only for critical business behavior that cannot be covered effectively elsewhere.

Data and infra requirements:
- For server/data paths, use real DB-backed testing infrastructure (for example Testcontainers) where feasible.
- Prefer shared fixtures/builders over ad-hoc mocks.
- Mock only true external boundaries (third-party APIs, email/SMS providers, payment gateways).
- Do not mock your own domain logic or repository behavior unless explicitly justified.

What every test PR should include:
- Happy-path coverage for the changed behavior.
- At least one failure/edge case for the changed behavior.
- Authorization/validation checks when relevant.
- Regression coverage for bug fixes (test fails before fix, passes after fix).

When tests are skipped:
- State the reason explicitly in the PR/summary.
- State risk introduced by missing coverage.
- Provide a concrete follow-up test task.

## 6. Generated Files

- Never edit generated files directly (e.g., Better Auth schema outputs, router generated files).
- Modify source configuration and regenerate instead.

## 7. Performance & Scalability

- Always design database queries with performance and scalability in mind.
- Use proper indexes, avoid N+1 queries, prefer single aggregated queries over multiple round-trips.
- For analytics or aggregate queries, use SQL-level aggregation (`COUNT`, `SUM`, `AVG`, `GROUP BY`) — never fetch all rows and compute in application code.
- Consider query performance at scale (thousands of members, thousands of sessions) when writing data-access functions.
- Use `EXPLAIN ANALYZE` mentally — if a query would do a full table scan at scale, add an index or restructure.

## 8. Research Before Solving

- Before assuming a solution, use available tools to research first:
  - **Web search** for current best practices, library docs, and patterns.
  - **Context7** for up-to-date documentation of libraries used in the project.
  - **Available skills** (frontend-design, code-review, webapp-testing, etc.) to validate and improve solutions.
- Do not rely solely on training knowledge — verify against current docs and community patterns.

## 9. Design & UX Process

- For any new UI work, use sub-agents to help plan and design before implementing:
  - Explore existing UI patterns in the codebase for consistency.
  - Review the design system (`docs/DESIGN_SYSTEM.md`) for colors, typography, spacing, and component conventions.
  - Use the frontend-design skill for layout and visual decisions.
  - Ensure new UI aligns with the rest of the application in look, feel, and interaction patterns.
- Never build UI in isolation — always check how similar pages/components are built in the project first.

## 10. Practical Decision Rules

- If requirements are unclear, stop and clarify before coding.
- Make small, safe, incremental changes.
- Avoid unrelated refactoring.
- Keep terminology and naming consistent.

## 11. Reuse Existing Code First (Mandatory)

Before introducing any new component, hook, utility, schema, query, or pattern:

- Search the existing codebase for similar behavior and reuse it when possible.
- Extend or compose existing implementations before creating new ones.
- Do not add near-duplicate logic with different names.
- Keep existing terminology and naming patterns consistent.
- If you must introduce something new, document why existing code could not be reused.

Quick check before writing code:
1. Did I search for an existing implementation?
2. Can I reuse or extend it safely?
3. If not, is the reason explicit and justified?
