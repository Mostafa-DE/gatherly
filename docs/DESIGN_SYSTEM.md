# DESIGN_SYSTEM.md

## Overview

This is the design system for **Gatherly**, a people-coordination app that replaces WhatsApp + Excel chaos for organizers of recurring real-world activities. Every design decision should serve two goals: **feel reliable** (this tool handles capacity correctly) and **feel human** (this is about people showing up together).

---

## Design Principles

### 1. Calm Confidence
The product promise is "we handle the chaos so you don't have to." The UI should embody that — no visual noise, no clutter, no overwhelming dashboards. Everything should feel like the chaos has already been solved.

### 2. Domain-Neutral Warmth
Gatherly works for padel groups, book clubs, yoga classes, board game nights, running crews — anything. The design must never feel tied to a specific domain. Warm but not cute. Professional but not enterprise.

### 3. Clarity Over Decoration
Organizers are coming from WhatsApp and Excel. They need to glance at a roster and instantly know: who's in, who's waitlisted, who showed up. Every design decision should serve scanability. The data IS the interface.

### 4. Trust Through Structure
Capacity enforcement is the core feature. The design should visually communicate reliability — clear status indicators, definitive states (not ambiguous), strong visual hierarchy between joined vs waitlisted vs cancelled.

---

## Color System

### Primary — Deep Teal
- **Purpose**: Brand identity, navigation, interactive elements, links, selected states
- **Light mode**: `#0D7377`
- **Dark mode**: `#3FB5B9` (lighter tint for contrast against dark backgrounds)
- **Tailwind**: Define as `primary` in config, swap via CSS variables
- **Usage**: Navigation bar, active/selected states, links, section accents on landing page
- **Why**: Teal sits between blue (trust, reliability) and green (growth, go-ahead). Warm enough to not feel corporate, professional enough to not feel like a toy. Distinctive — not another blue SaaS app.
- **Dark mode rule**: Primary color shifts lighter so it remains readable against dark surfaces. Never use the dark `#0D7377` value on dark backgrounds — it disappears.

### Semantic Status Colors (Critical)
These are used everywhere in the app — session cards, roster rows, participation badges. Consistency is non-negotiable.

| Status | Light | Dark | Usage |
|--------|-------|------|-------|
| Joined / Confirmed / Show | `#16A34A` | `#4ADE80` | "You're in" — unambiguous positive |
| Waitlisted / Pending | `#CA8A04` | `#FACC15` | "Not confirmed yet" — clearly pending |
| Cancelled / No-show | `#DC2626` | `#F87171` | Negative state — use with restraint |
| Draft / Inactive | `#6B7280` | `#9CA3AF` | "Not live yet" — clearly dormant |
| Paid | Same as joined | Same as joined | Consistent with "confirmed/done" |
| Unpaid | Muted gray or amber | Context-dependent | Not urgent unless organizer needs it |

**Dark mode rule for status colors**: Use slightly lighter/brighter tints so they pop against dark surfaces. The hue stays the same — only the lightness shifts.

**Rule**: Green always means confirmed/positive. Amber always means pending/waiting. Red always means cancelled/negative. Gray always means inactive/draft. Never deviate from this anywhere in the app, in either theme.

### Neutrals

Light mode uses **warm** off-whites. Dark mode uses **cool navy** backgrounds — deep blue-blacks that feel alive and comfortable, not flat brown-blacks.

| Role | Light | Dark | Usage |
|------|-------|------|-------|
| Page background | `#FAFAF8` | `#0A0E1A` | Main app background |
| Card/surface | `#FFFFFF` | `#151B2E` | Cards, modals, dropdowns |
| Elevated surface | `#FFFFFF` | `#1A2138` | Nested cards, popovers, tooltips |
| Subtle background | `#F5F3F0` | `#151B2E` | Table row alternates, hover states, section bg |
| Border | `#E5E2DD` | `#1E2740` | Card borders, dividers, input borders |
| Muted text | `#78756F` | `#8892A4` | Secondary labels, timestamps, helper text |
| Body text | `#3D3D3B` | `#C1C5D0` | Primary body copy |
| Heading text | `#1C1C1A` | `#F5F5F7` | Headings, important labels |

**Rules**:
- Never use pure `#000000` or pure `#FFFFFF` as primary background/text in either theme.
- Light mode: warm off-whites with subtle yellow undertone.
- Dark mode: deep navy with subtle blue undertone. Not brown-black, not pure black.
- Text contrast must meet WCAG AA (4.5:1 for body text, 3:1 for large text) in both themes.

### Teal at Low Opacity (In-App Utility)
Use teal at low opacity for subtle interactive states inside the dashboard:

| State | Light | Dark |
|-------|-------|------|
| Hover background | `primary/5` | `primary/10` |
| Selected row | `primary/10` | `primary/15` |
| Active sidebar item | `primary/15` | `primary/20` |

These create brand presence without competing with status colors. Dark mode needs slightly higher opacity to be visible against dark surfaces.

---

## Typography

### Font Family

**Primary**: **DM Sans** (Google Fonts)
- Geometric, friendly, slightly rounded
- Excellent weight range (400, 500, 600, 700)
- Distinctly "not Inter" while remaining highly readable
- Used for everything: headings, body, labels, buttons

**Alternative** (if you prefer): **Plus Jakarta Sans** — similar qualities, slightly more modern feel.

**Monospaced Accent**: **JetBrains Mono** or **IBM Plex Mono**
- Used for: capacity numbers (`8/12`), waitlist position (`#3`), attendance counts, stats
- Numbers are central to the app — mono treatment makes them feel precise and reliable

### Type Scale

| Role | Size | Weight | Usage |
|------|------|--------|-------|
| Page title | 24–30px | 700 (Bold) | Dashboard page titles, landing page section heads |
| Section title | 20–24px | 600 (Semibold) | Card group headers, settings sections |
| Card title | 16–18px | 600 (Semibold) | Session card title, profile section title |
| Body | 14–16px | 400 (Regular) | Descriptions, paragraphs, form labels |
| Small / Caption | 12–13px | 400–500 | Timestamps, helper text, badge labels |
| Mono numbers | 14–20px | 500 (Medium) | Capacity counters, stats, waitlist position |

**Landing page exception**: Display headings can go up to 48–64px bold for hero sections. The marketing page is more expressive.

### Type Rules
- Line height: 1.5 for body text, 1.2–1.3 for headings
- Letter spacing: Default for body, slightly tight (`-0.01em` to `-0.02em`) for large headings
- Never use ALL CAPS for body text. Acceptable for small labels/badges only.
- Headings use `heading text` color (`#1C1C1A`), body uses `body text` color (`#3D3D3B`)

---

## Spacing & Layout

### Spacing Scale
Use Tailwind's default scale. Key values:
- `4px` (1) — tight internal padding (badge padding, icon gaps)
- `8px` (2) — compact spacing (between related elements)
- `12px` (3) — default gap between list items, form fields
- `16px` (4) — card internal padding, section gaps
- `24px` (6) — between card groups, major sections
- `32px` (8) — page-level section separation
- `48–64px` (12–16) — landing page section spacing

### Layout Principles

**Cards are the primary container.** Sessions are cards. Roster entries are rows within cards. The card metaphor maps naturally to "a session is a thing."

**Density varies by context:**

| Context | Density | Notes |
|---------|---------|-------|
| Landing page | Spacious | Big whitespace, generous margins, breathing room |
| Dashboard overview | Medium | Cards with comfortable padding, clear separation |
| Roster / tables | Medium-compact | Tighter rows but still scannable, no cramming |
| Mobile | Compact | Stack everything, reduce padding slightly |

**Max content width**: `1200px` for dashboard, `1280px` for landing page. Always centered.

**Responsive breakpoints**: Follow Tailwind defaults (`sm: 640px`, `md: 768px`, `lg: 1024px`, `xl: 1280px`). Mobile-first approach.

---

## Components

### Buttons

| Variant | Light | Dark | Usage |
|---------|-------|------|-------|
| Primary | Teal bg, white text | Lighter teal bg, dark text | Main CTAs: Join, Create, Get Started |
| Secondary | Teal outline, teal text | Lighter teal outline + text | Secondary actions: Save, Confirm |
| Outline | Teal border + text, transparent bg | Lighter teal border + text | Tertiary actions: Cancel, Back, Edit |
| Ghost | No border, teal text | No border, lighter teal text | Inline actions, less important links |
| Destructive | Red bg or red outline | Lighter red, same patterns | Delete, Remove — used with confirmation |

All buttons use CSS variable colors so they adapt automatically. No need for `dark:` variants if using the variable system.

**Border radius**: `8px` for all buttons (consistent with cards).
**Height**: `36px` default, `40px` large, `32px` small.

### Cards

| Property | Light | Dark |
|----------|-------|------|
| Background | `#FFFFFF` | `#1C1C1A` |
| Border | `1px solid #E5E2DD` | `1px solid #2E2E2B` |
| Border radius | `8px` | `8px` |
| Padding | `16px` default, `20–24px` content-heavy | Same |
| Shadow | None default, `shadow-sm` on hover | None default, subtle glow or lighter border on hover |

**Session cards** should prominently show: title, date/time, capacity status (e.g., `8/12 joined`), session status badge. Same layout in both themes.

### Badges / Status Pills

- Border radius: Full round (`9999px`)
- Padding: `4px 10px`
- Font size: `12–13px`, weight `500`

| Status | Light Mode | Dark Mode |
|--------|-----------|-----------|
| Joined | `bg-green-50 text-green-700` | `bg-green-900/40 text-green-400` |
| Waitlisted | `bg-yellow-50 text-yellow-700` | `bg-yellow-900/40 text-yellow-400` |
| Cancelled | `bg-red-50 text-red-700` | `bg-red-900/40 text-red-400` |
| Draft | `bg-gray-100 text-gray-600` | `bg-gray-800 text-gray-400` |

**Pattern**: Light mode uses light tinted background + dark text. Dark mode uses dark tinted background + lighter text. Same hue, inverted lightness.

### Form Inputs

| Property | Light | Dark |
|----------|-------|------|
| Background | `#FFFFFF` | `#1C1C1A` |
| Border | `1px solid #E5E2DD` | `1px solid #2E2E2B` |
| Border radius | `8px` | `8px` |
| Focus border | `#0D7377` | `#3FB5B9` |
| Focus ring | Subtle teal ring | Subtle teal ring (lighter teal) |
| Height | `40px` | `40px` |
| Label | `14px`, weight `500`, body text color | Same, using dark body text |
| Placeholder | Muted text color | Dark muted text color |

### Navigation (In-App)

| Property | Light | Dark |
|----------|-------|------|
| Background | White | `#141413` or `#1C1C1A` |
| Active item text | Teal (`#0D7377`) | Lighter teal (`#3FB5B9`) |
| Active item bg | `primary/10` | `primary/15` |
| Inactive item | Muted text color | Dark muted text color |
| Border | `#E5E2DD` | `#2E2E2B` |

### Tables / Roster Views

| Property | Light | Dark |
|----------|-------|------|
| Header bg | `#F5F3F0` | `#1E1E1C` |
| Header text | `600` weight, heading color | `600` weight, dark heading color |
| Row bg | White | `#1C1C1A` |
| Row border | `#E5E2DD` bottom | `#2E2E2B` bottom |
| Row hover | `primary/5` | `primary/10` |
| Alternate row | `#FAFAF8` (optional) | `#1E1E1C` (optional) |
| Status column | Colored badges (see above) | Dark-mode badges (see above) |
| Capacity numbers | Monospaced font | Monospaced font |

---

## Iconography

- **Library**: Lucide React
- **Size**: `16px` for inline, `20px` for buttons/nav, `24px` for feature highlights
- **Color**: Inherit from text color, or use muted color for decorative icons
- **Stroke width**: Default (2px)
- **Common icons**:
  - Users / UserPlus — groups, members
  - Calendar / CalendarDays — sessions, dates
  - CheckCircle — confirmed, success
  - Clock — waitlisted, pending
  - XCircle — cancelled
  - BarChart3 — stats, history
  - Link — share link
  - Settings — org settings

---

## Motion & Animation

### In-App (Dashboard)
- **Restrained**. Utility over flair.
- Page transitions: None (instant navigation)
- Content loading: Subtle fade-in (`150ms ease-in`)
- Hover states: `150ms` color/background transitions
- Modals/dropdowns: `150–200ms` fade + slight scale
- Toast notifications: Slide in from top-right, auto-dismiss

### Landing Page
- **More expressive** but still purposeful.
- Hero: Staggered fade-in + slide-up for headline, subheadline, CTA
- Scroll reveals: Sections fade in as they enter viewport
- Feature cards: Subtle stagger on scroll
- Hover: Cards lift slightly (`translateY(-2px)`, subtle shadow increase)
- Keep all animations under `400ms`. Nothing should feel slow.

---

## Landing Page vs In-App Usage

| Element | Landing Page | Dashboard / In-App |
|---------|--------------|---------------------|
| Primary teal | Hero backgrounds, section accents | Navigation, selected states, links |
| Primary teal CTAs | CTA buttons, highlights | Primary action buttons |
| Warm neutrals | Large whitespace sections | Card backgrounds, table rows, borders |
| Display type | Large (48–64px heroes) | Page titles only (24–30px) |
| Body type | Marketing copy (16px) | Labels, data, descriptions (14px) |
| Mono type | Optional stat counters | Capacity numbers, waitlist position, counts |
| Status colors | Use case examples if shown | Everywhere — badges, pills, roster rows |
| Density | Spacious | Medium to medium-compact |
| Animation | Scroll reveals, staggered entrances | Minimal — transitions only |

---

## What to Avoid

- **Gradients as primary branding** — they feel trendy and ephemeral. Gatherly should feel solid and lasting. Subtle gradients for backgrounds are acceptable on the landing page only.
- **Rounded-everything** — 8px on cards and inputs, full-round on badges/pills. Don't go beyond this. It shouldn't look like a children's app.
- **Dark mode as an afterthought** — both themes must feel intentional. Dark mode is not "invert the colors." Every surface, border, and text shade has a dedicated dark value.
- **Illustrations/mascots** — they push toward a specific personality that may not age well. Let the UI and data do the talking.
- **Pure black or pure white** — always use the offsets defined above. Light mode is warm off-white, dark mode is deep navy.
- **Generic fonts** — never use Inter, Roboto, Arial, or system defaults. DM Sans (or Plus Jakarta Sans) is the brand font.
- **Competing with status colors** — decorative color should never use green, amber/yellow, or red in ways that could be confused with status indicators.
- **Decorative elements in data-heavy views** — the roster, session list, and history views should be clean and utilitarian. Decoration belongs on the landing page.

---

## Tailwind / CSS Variables Reference

Use CSS custom properties so theme switching is handled at the CSS level. The `dark` class on `<html>` toggles all values.

### CSS Variables (add to your global CSS)

```css
@import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap');

:root {
  /* Primary */
  --color-primary: #0D7377;
  --color-primary-light: #3FB5B9;
  --color-primary-subtle: rgba(13, 115, 119, 0.08);
  --color-primary-hover: rgba(13, 115, 119, 0.12);

  /* Accent (hover/selected states — subtle) */
  --color-accent: #F5F3F0;
  --color-accent-hover: rgba(13, 115, 119, 0.12);

  /* Surfaces */
  --color-bg: #FAFAF8;
  --color-surface: #FFFFFF;
  --color-surface-elevated: #FFFFFF;
  --color-subtle: #F5F3F0;

  /* Borders */
  --color-border: #E5E2DD;

  /* Text */
  --color-text-heading: #1C1C1A;
  --color-text-body: #3D3D3B;
  --color-text-muted: #78756F;

  /* Status */
  --color-status-success: #16A34A;
  --color-status-warning: #CA8A04;
  --color-status-danger: #DC2626;
  --color-status-inactive: #6B7280;

  /* Status badge backgrounds */
  --color-badge-success-bg: #F0FDF4;
  --color-badge-warning-bg: #FEFCE8;
  --color-badge-danger-bg: #FEF2F2;
  --color-badge-inactive-bg: #F3F4F6;
}

.dark {
  /* Primary */
  --color-primary: #3FB5B9;
  --color-primary-light: #7ACFD2;
  --color-primary-subtle: rgba(63, 181, 185, 0.12);
  --color-primary-hover: rgba(63, 181, 185, 0.18);

  /* Accent (hover/selected states — subtle) */
  --color-accent: #151B2E;
  --color-accent-hover: rgba(63, 181, 185, 0.18);

  /* Surfaces — cool navy */
  --color-bg: #0A0E1A;
  --color-surface: #151B2E;
  --color-surface-elevated: #1A2138;
  --color-subtle: #151B2E;

  /* Borders — navy-tinted */
  --color-border: #1E2740;

  /* Text — cool blue-grays */
  --color-text-heading: #F5F5F7;
  --color-text-body: #C1C5D0;
  --color-text-muted: #8892A4;

  /* Status */
  --color-status-success: #4ADE80;
  --color-status-warning: #FACC15;
  --color-status-danger: #F87171;
  --color-status-inactive: #9CA3AF;

  /* Status badge backgrounds */
  --color-badge-success-bg: rgba(74, 222, 128, 0.15);
  --color-badge-warning-bg: rgba(250, 204, 21, 0.15);
  --color-badge-danger-bg: rgba(248, 113, 113, 0.15);
  --color-badge-inactive-bg: rgba(156, 163, 175, 0.12);
}
```

### Tailwind Config

```js
// tailwind.config.ts — reference these CSS variables
{
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: 'var(--color-primary)',
          light: 'var(--color-primary-light)',
          subtle: 'var(--color-primary-subtle)',
          hover: 'var(--color-primary-hover)',
        },
        accent: 'var(--color-accent)',
        surface: {
          bg: 'var(--color-bg)',
          DEFAULT: 'var(--color-surface)',
          elevated: 'var(--color-surface-elevated)',
          subtle: 'var(--color-subtle)',
        },
        border: 'var(--color-border)',
        text: {
          heading: 'var(--color-text-heading)',
          body: 'var(--color-text-body)',
          muted: 'var(--color-text-muted)',
        },
        status: {
          success: 'var(--color-status-success)',
          warning: 'var(--color-status-warning)',
          danger: 'var(--color-status-danger)',
          inactive: 'var(--color-status-inactive)',
        },
      },
      fontFamily: {
        sans: ['DM Sans', 'sans-serif'],
        mono: ['JetBrains Mono', 'monospace'],
      },
      borderRadius: {
        DEFAULT: '8px',
      },
    },
  },
}
```

### Usage in Components

```tsx
// These work in both themes automatically — no dark: prefix needed
<div className="bg-surface text-text-body border-border">
  <h1 className="text-text-heading">Session Title</h1>
  <span className="text-text-muted">Yesterday at 7pm</span>
  <span className="font-mono text-primary">8/12</span>
  <button className="bg-primary text-white">Join Session</button>
</div>

// Status badge — works in both themes
<span className="bg-[var(--color-badge-success-bg)] text-status-success">
  Joined
</span>
```

**Why CSS variables instead of `dark:` prefix**: You avoid writing every color class twice (`text-gray-800 dark:text-gray-200`). One class, one variable, both themes handled. Cleaner code, fewer bugs, easier to maintain.

---

## Theme Implementation Notes

### How Theme Switching Works
- Use `class` strategy (`darkMode: 'class'` in Tailwind config)
- Toggle `dark` class on `<html>` element
- All CSS variables swap automatically — no `dark:` prefix needed for themed colors
- System preference detection: `prefers-color-scheme: dark` media query for initial load
- Persist user choice in localStorage

### Default Theme
- Light mode is the default
- Respect system preference on first visit
- Allow manual toggle and persist the choice

### Both Themes Must Feel Intentional
- Dark mode uses **cool navy** backgrounds (`#0A0E1A`), not warm browns. Each surface, border, and text color has a hand-picked dark value.
- Light mode uses **warm off-whites** (`#FAFAF8`). The contrast between light warmth and dark coolness is intentional.
- Test every screen in both themes. Status badges especially — they must be equally readable against both light and dark surfaces.
- Shadows work differently in dark mode — they're nearly invisible. Use subtle border lightening or glow effects instead.

---

## Quick Decision Guide

When designing any screen, ask:
1. **What's the user's job here?** → Optimize for that task.
2. **What status needs to be visible?** → Use the status color system.
3. **Is this marketing or product?** → Marketing = expressive. Product = restrained.
4. **Can I remove anything?** → If it doesn't serve scanability or action, remove it.
5. **Would an organizer checking this at 7am before a session find it clear?** → That's the bar.
