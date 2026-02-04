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

## 7. Practical Decision Rules

- If requirements are unclear, stop and clarify before coding.
- Make small, safe, incremental changes.
- Avoid unrelated refactoring.
- Keep terminology and naming consistent.
