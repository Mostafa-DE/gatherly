# Claude Code Guidelines for Gatherly

## Project Overview

Gatherly is a full-stack TypeScript application built with:
- **Frontend**: React 19, TanStack Router (file-based), TanStack Query, Tailwind CSS, shadcn/ui, Jotai
- **Backend**: TanStack Start, Nitro, tRPC 11, Better Auth, Drizzle ORM, PostgreSQL
- **Validation**: Zod 4

---

## Core Principles

### 1. Never Assume

If any requirement, behavior, naming, or constraint is unclear:
- **STOP** and ask questions before writing code
- Provide clear options with tradeoffs when applicable
- Do NOT guess defaults, infer intent, or fill gaps silently

### 2. Small, Safe Changes

- Prefer small, incremental changes
- Each change must keep the project buildable and runnable
- Avoid large refactors unless explicitly requested
- One concern per change

### 3. Clarity Over Cleverness

- Prefer readable, boring, explicit code
- Avoid over-engineering and unnecessary abstractions
- Optimize for maintainability, not novelty

---

## Project Structure

```
src/
├── auth/              # Better Auth configuration
│   ├── index.ts       # Server-side auth setup
│   └── client.ts      # Client hooks (signIn, signUp, useSession)
├── components/ui/     # shadcn/ui components (Button, Card, Input, etc.)
├── data-access/       # Database query layer (getUserById, updateUser)
├── db/
│   ├── schema.ts      # Drizzle ORM schema definitions
│   └── index.ts       # Database connection
├── exceptions/        # Custom tRPC error classes
├── hooks/             # React hooks (useMobile, etc.)
├── lib/
│   ├── trpc.ts        # tRPC client setup
│   └── utils.ts       # Utilities (cn for class merging)
├── routes/            # File-based routing
│   ├── __root.tsx     # Root layout with providers
│   ├── index.tsx      # Home page
│   ├── (auth)/        # Auth route group
│   └── api/           # API route handlers
├── schemas/           # Zod validation schemas
├── state/             # Jotai atoms
├── trpc/
│   ├── index.ts       # tRPC init, middleware, procedures
│   ├── context.ts     # Request context (db, user)
│   └── routers/       # tRPC routers
└── types/             # TypeScript utility types
```

---

## Key Conventions

### Routing

- File-based routing via TanStack Router in `src/routes/`
- Route groups use parentheses: `(auth)/login.tsx`
- API catchalls use `$.ts`: `api/trpc/$.ts`

### Data Flow

```
Component → trpc.router.procedure.useQuery/useMutation()
         → tRPC HTTP Batch Link
         → /api/trpc/$ handler
         → tRPC procedure (public or protected)
         → data-access layer
         → Drizzle ORM
         → PostgreSQL
```

### State Management

| Type | Solution |
|------|----------|
| Server state | React Query via tRPC |
| Global UI state | Jotai atoms (`src/state/`) |
| Auth state | Better Auth `useSession()` |
| Local state | React `useState` |

### Authentication

- Better Auth handles all auth flows at `/api/auth/*`
- Use `signIn.email()`, `signUp.email()`, `signOut()` from `@/auth/client`
- Protected routes check session via `useSession()`
- tRPC uses `protectedProcedure` for authenticated endpoints

### tRPC Patterns

```typescript
// Public query
export const userRouter = router({
  getById: publicProcedure
    .input(z.object({ id: z.string() }))
    .query(({ input }) => getUserById(input.id)),

  // Protected mutation
  updateProfile: protectedProcedure
    .input(updateProfileSchema)
    .mutation(({ ctx, input }) => updateUser(ctx.user.id, input)),
});
```

### Schema Validation

- Define Zod schemas in `src/schemas/`
- Use `drizzle-zod` for DB-schema sync
- Shared fields in `schemas/shared.ts`

### Error Handling

- Custom errors in `src/exceptions/`
- Use `NotFoundError`, `UnauthorizedError`, `ForbiddenError`, etc.
- All extend `TRPCError` with appropriate codes

### UI Components

- Use shadcn/ui components from `@/components/ui`
- Use `cn()` utility for conditional class merging
- Follow existing component patterns (CVA for variants)

---

## Commands

```bash
# Development
pnpm dev              # Start dev server

# Database
pnpm db:generate      # Generate Drizzle migrations
pnpm db:migrate       # Run migrations
pnpm db:push          # Push schema changes (dev only)
pnpm db:studio        # Open Drizzle Studio

# Build
pnpm build            # Production build
pnpm start            # Start production server
```

---

## Environment Variables

Required in `.env`:
```
DATABASE_URL=postgresql://...
BETTER_AUTH_URL=http://localhost:3000
BETTER_AUTH_SECRET=...
```

---

## Path Aliases

`@/*` maps to `./src/*`

Example: `import { Button } from "@/components/ui/button"`

---

## Workflow Requirements

When working on any task:

1. **Restate** the goal briefly
2. **List questions** if anything is unclear
3. **Propose a plan** before implementing
4. **Implement** in small steps
5. **Summarize**:
   - What changed
   - How to run/verify
   - Known limitations or follow-ups

---

## Do NOT

- Refactor unrelated code "while you're here"
- Introduce new terminology without confirmation
- Mix business logic in UI layers
- Trust user input without validation
- Skip asking when unsure or ambiguous

---

## Adding New Features

### New Route
1. Create file in `src/routes/` following naming convention
2. Export component with `createFileRoute`

### New tRPC Endpoint
1. Add procedure to appropriate router in `src/trpc/routers/`
2. Create Zod schema in `src/schemas/` if needed
3. Add data-access function if DB interaction required
4. Register router in `src/trpc/routers/_app.ts` if new router

### New Database Table
1. Define schema in `src/db/schema.ts`
2. Run `pnpm db:generate` then `pnpm db:migrate`
3. Create data-access functions in `src/data-access/`

### New UI Component
1. Use `npx shadcn@latest add <component>` for shadcn components
2. Custom components go in `src/components/`
