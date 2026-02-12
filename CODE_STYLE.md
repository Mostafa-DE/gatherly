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
- Preserve separation between UI, business logic, and IO.

## 3. Frontend Rules

- Use Tailwind CSS, shadcn/ui, and Jotai.
- Avoid custom CSS unless explicitly required.
- Do not use React Context for app state.
- Avoid `useState` for shared/client state; model it in atoms.
- Treat `useEffect` as last resort; prefer action-driven state changes.
- Use TanStack Query for server state; do not mirror server data into Jotai atoms.
- **No `"use client"` or `"use server"` directives.** This project uses TanStack Start + Nitro, not Next.js. There are no React Server Components — all components are client components by default.

## 4. TypeScript, Naming, and Formatting

- Language: TypeScript (strict).
- Formatting: 2-space indentation, no semicolons.
- Use `@/` path alias where configured.
- File naming: `kebab-case` for files; React components in `PascalCase.tsx`.
- Use `pnpm` for package management and scripts.

## 5. Testing Standards

- Ship tests with every feature (before or alongside implementation, never after release).
- Prefer integration/E2E tests over unit tests.
- Unit tests are for complex pure logic only.
- Avoid UI tests except for critical business behavior.
- Prefer real integrations and shared fixtures over mocks/fake harnesses.
- Use Arrange -> Act -> Assert structure.
- Keep tests focused on observable behavior.
- For server/data paths, test with real DB infrastructure (e.g., Testcontainers).

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
