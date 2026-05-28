# Teriac — Design System

> **Version:** 1.0
> **Last updated:** 18 May 2026
> **Audience:** Frontend engineers, designers, anyone touching `apps/web/` or `packages/ui/`

This file is the single source of truth for the look and feel of the Teriac clinical workspace. It captures every token, component, and rule a developer needs to ship UI that feels consistent across the product. **Read this before adding new components or screens.**

---

## Table of contents

1. [Design principles](#1-design-principles)
2. [Color system](#2-color-system)
3. [Typography](#3-typography)
4. [Spacing, radius, elevation](#4-spacing-radius-elevation)
5. [Layout & responsive breakpoints](#5-layout--responsive-breakpoints)
6. [Iconography](#6-iconography)
7. [Motion](#7-motion)
8. [Component patterns](#8-component-patterns)
9. [Bilingual & RTL rules](#9-bilingual--rtl-rules)
10. [Accessibility](#10-accessibility)
11. [Tailwind / token reference](#11-tailwind--token-reference)

---

## 1. Design principles

Teriac is a **clinical-grade tool used by doctors, nurses, and receptionists during long shifts**. The design must reward repeated use, not first impressions. Every decision in this document descends from these five principles:

1. **Calm over flashy.** Clinicians make consequential decisions; the UI must not compete for attention. Restrained motion, generous whitespace, one accent color carrying the weight.
2. **Data-dense without clutter.** Tabular numerals, consistent column widths, and predictable layouts let users scan a chart in seconds. We optimize for the third visit, not the first.
3. **Status is color.** Color carries clinical meaning (normal / warning / alert / info). It is never decorative. Decorative color washes are reserved for hero areas and the marketing surface.
4. **Bilingual is first-class.** The product ships in English and Arabic from day one. RTL is not a flip; it is a layout direction. Every component is built with logical CSS properties from the start.
5. **One serif moment per screen.** A single editorial serif heading anchors each page. Everything else is sans. This gives Teriac a recognizable identity without becoming a magazine.

---

## 2. Color system

### 2.1 Primary

**`#155dfc`** — a saturated, modern blue. It is the action color, the brand color, the focus color, and the only color that should appear in primary buttons, active states, and key data accents.

| Role | Token | Hex | Use |
|---|---|---|---|
| Primary | `--primary-500` | `#155dfc` | Primary buttons, active nav, links, focus rings, key data |
| Primary hover | `--primary-600` | `#1251dd` | Hover state on primary buttons |
| Primary press | `--primary-700` | `#0f42b5` | Active/pressed state, button text on light primary surfaces |
| Primary surface | `--primary-50` | `#f0f5fe` | Subtle blue backgrounds (selected row, active filter chip) |
| Primary surface 2 | `--primary-100` | `#e2ebfe` | Status pill backgrounds (e.g., "Confirmed") |

### 2.2 Full primary scale

Use these when you need a tonal variation — never invent a new blue.

| Token | Hex | Typical use |
|---|---|---|
| `--primary-50` | `#f0f5fe` | Hover backgrounds, tinted card surfaces |
| `--primary-100` | `#e2ebfe` | Pill backgrounds, hairline tints |
| `--primary-200` | `#c4d6fe` | Disabled primary buttons, dividers in primary contexts |
| `--primary-300` | `#95b6fd` | Decorative — gradient stops only |
| `--primary-400` | `#4f85fc` | Inline links on dark backgrounds |
| `--primary-500` | `#155dfc` | **Primary action** |
| `--primary-600` | `#1251dd` | Hover |
| `--primary-700` | `#0f42b5` | Pressed, text on `--primary-50` |
| `--primary-800` | `#0b338a` | Headings on primary surfaces |
| `--primary-900` | `#072058` | Text on `--primary-100` |

### 2.3 Neutrals (Ink & Paper)

Teriac uses a near-white background with cool gray-blue ink. Neutrals are warm-neutral on the light theme and cool-blue on dark to keep the primary feeling at home.

| Token | Light | Dark | Use |
|---|---|---|---|
| `--paper` | `#f7f9fc` | `#0b1220` | App background |
| `--paper-2` | `#eef2f8` | `#101a2d` | Sidebar, subtle surface |
| `--paper-3` | `#e4eaf3` | `#172339` | Hover backgrounds, chip backgrounds |
| `--card` | `#ffffff` | `#101a2d` | Cards, panels, modals |
| `--card-2` | `#fafbfd` | `#152038` | Nested cards, table headers |
| `--ink` | `#0b1220` | `#f3f6fb` | Primary text |
| `--ink-2` | `#283344` | `#d1d8e4` | Body text |
| `--ink-3` | `#5b6679` | `#8b95a8` | Secondary text, captions |
| `--ink-4` | `#8b95a8` | `#5b6679` | Tertiary text, placeholders, icons in rest state |
| `--rule` | `#dfe5ee` | `#1f2a40` | Dividers, borders |
| `--rule-2` | `#c8d0de` | `#2a374f` | Strong borders, input borders on focus-within parent |

### 2.4 Semantic colors

Each clinical status has a foreground (`-fg`) for icons and text, a `-bg` for filled status pills, and the meaning is fixed across the entire app.

| Token | Hex | Meaning |
|---|---|---|
| `--vital-fg` / `--vital-bg` | `#0f7a4d` / `#dcf2e4` | Normal, in-range, resolved, success |
| `--warn-fg` / `--warn-bg` | `#a76a0c` / `#fbedcf` | Caution, suboptimal, pending |
| `--alert-fg` / `--alert-bg` | `#b3261e` / `#fadcd9` | Critical, abnormal, error, allergy |
| `--info-fg` / `--info-bg` | `#155dfc` / `#e2ebfe` | Informational, scheduled, neutral status |

**Hard rule:** never use semantic colors decoratively. Green is not "fresh", red is not "fancy" — they communicate clinical state.

### 2.5 Where each color goes

| Surface | Color |
|---|---|
| Page background | `--paper` |
| Sidebar | `--paper-2` |
| Cards, panels | `--card` |
| Card with subtle differentiation | `--card-2` |
| Borders & dividers | `--rule` |
| Body text | `--ink` to `--ink-2` |
| Secondary text | `--ink-3` |
| Captions, placeholders, icons | `--ink-4` |
| Primary buttons | `--primary-500` bg, white text |
| Secondary buttons | `--card` bg, `--rule` border, `--ink` text |
| Ghost buttons | transparent, `--ink-2` text |
| Links | `--primary-600` (better contrast on white than 500) |
| Focus ring | 2px `--primary-500`, 2px offset |

### 2.6 Dark theme

Toggle via `<html data-theme="dark">`. All tokens automatically swap. **Do not write `dark:` Tailwind variants** — the token system handles it. Just use semantic class names.

---

## 3. Typography

### 3.1 Font families

| Family | Weights loaded | Use |
|---|---|---|
| **Fraunces** (variable serif, optical sizing) | 400, 500, 600, 700 | Display headings, page titles, hero numerals — one editorial moment per screen |
| **Inter** (variable sans) | 400, 500, 600, 700 | Body text, UI labels, buttons, navigation |
| **IBM Plex Sans Arabic** | 400, 500, 600, 700 | Body text and UI when `lang="ar"` |
| **JetBrains Mono** | 400, 500, 600 | Code, MRNs, ICD codes, timestamps, eyebrows, tabular metadata |

Load via `<link>` in the document head; no `@import` inside CSS (slower paint).

```html
<link href="https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,400..700&family=Inter:wght@400;500;600;700&family=IBM+Plex+Sans+Arabic:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500;600&display=swap" rel="stylesheet">
```

### 3.2 Type scale

| Token | Size / line-height | Family | Weight | Use |
|---|---|---|---|---|
| `display-xl` | 56 / 56 | Fraunces | 500 | Marketing/hero only |
| `display-lg` | 42 / 46 | Fraunces | 500 | Page title (dashboard greeting, patient name) |
| `display-md` | 32 / 38 | Fraunces | 500 | Section hero (e.g., "Visit · Omar Haddad") |
| `h1` | 24 / 30 | Fraunces | 500 | Card titles, patient header name |
| `h2` | 20 / 28 | Fraunces | 500 | Sub-section titles inside cards |
| `h3` | 16 / 22 | Inter | 600 | Group labels inside dense lists |
| `body-lg` | 16 / 24 | Inter | 400 | Long-form prose (rare in app) |
| `body` | 14 / 21 | Inter | 400 | **Default body** |
| `body-sm` | 13 / 19 | Inter | 400 | Captions, secondary text in cards |
| `label` | 13 / 18 | Inter | 500 | Form labels, button text |
| `eyebrow` | 11 / 14 | JetBrains Mono | 500, +0.12em tracking, uppercase | Eyebrows above titles, table column headers |
| `caption` | 12 / 16 | Inter | 400 | Helper text, timestamps |
| `code` | 12 / 16 | JetBrains Mono | 500 | ICD codes, MRNs, technical strings |

**Display headings** use `font-optical-sizing: auto` so Fraunces switches its inner shapes at large sizes. **Body uses Inter's** `font-feature-settings: "cv11"` for the disambiguated single-story `g` and `l` — better in dense data tables.

### 3.3 Numerals

All data cells, KPIs, timestamps, and metrics must use `font-variant-numeric: tabular-nums` so columns align. Apply via the `.tnum` utility or on `td` directly.

```css
td, .tnum, .kpi-value, .num { font-variant-numeric: tabular-nums; }
```

### 3.4 One serif moment per screen

Every screen has **one** Fraunces headline near the top — the page title. Card titles (`h1`/`h2`) are also Fraunces but at a smaller scale, which is fine. Avoid putting Fraunces inside data tables, inside buttons, inside nav items, or inside form fields. It loses elegance fast.

### 3.5 Arabic typography

When `lang="ar"` is active:
- Body font switches to **IBM Plex Sans Arabic** automatically via the `--sans` token
- Headings stay in Fraunces if mixed-script (e.g., showing an Arabic-language UI with an English drug name), but Arabic-only headings use Plex Arabic at weight 500
- Drop the `cv11` and `ss01` OpenType features (they're Latin-only and cause font-feature warnings)
- Line-height bumps to 1.6 for body text — Arabic glyphs need more vertical room

---

## 4. Spacing, radius, elevation

### 4.1 Spacing scale

A 4-pixel base, with named tokens for the values used most.

| Token | Value |
|---|---|
| `space-0` | 0 |
| `space-1` | 4px |
| `space-2` | 8px |
| `space-3` | 12px |
| `space-4` | 16px |
| `space-5` | 20px |
| `space-6` | 24px |
| `space-8` | 32px |
| `space-10` | 40px |
| `space-12` | 48px |
| `space-16` | 64px |

**Defaults to remember without looking up:**
- Card inner padding: `space-5` (20px) horizontal, `space-4` (16px) vertical
- Page padding: `space-8` (32px) on desktop, `space-5` (20px) on mobile
- Gap between cards: `space-5` (20px)
- Gap inside a list row: `space-3` (12px)
- Gap between inline form fields: `space-3` (12px)

### 4.2 Radius

| Token | Value | Use |
|---|---|---|
| `radius-sm` | 6px | Pills, chips, small badges, code tags |
| `radius` | 10px | Inputs, buttons, small cards |
| `radius-lg` | 14px | Cards, panels |
| `radius-xl` | 20px | Patient header, hero panels |
| `radius-full` | 999px | Avatars, status pills, toggles |

### 4.3 Elevation

Three levels only. Shadows are subtle and color-tinted toward the ink, never pure black.

```css
--shadow-1: 0 1px 0 rgba(11, 18, 32, .04), 0 1px 2px rgba(11, 18, 32, .04);
--shadow-2: 0 1px 0 rgba(11, 18, 32, .05), 0 8px 24px -12px rgba(11, 18, 32, .12);
--shadow-3: 0 4px 8px -2px rgba(11, 18, 32, .08), 0 24px 48px -16px rgba(11, 18, 32, .18);
```

| Level | When |
|---|---|
| `shadow-1` | Resting cards and inputs (paired with a 1px `--rule` border) |
| `shadow-2` | Floating elements: dropdowns, popovers, the patient header |
| `shadow-3` | Modals, the command-palette overlay, toasts |

Borders + shadow-1 is preferred over shadow-only for resting state — it reads as "paper" rather than "floating", which is right for a clinical UI.

---

## 5. Layout & responsive breakpoints

### 5.1 App shell

```
┌────────────┬──────────────────────────────────────┐
│            │  topbar (search, lang, theme, user)  │
│            ├──────────────────────────────────────┤
│  sidebar   │                                      │
│  248px     │  page (max-width 1480, centered)     │
│  (collapse │                                      │
│   to 68px) │    page-head                          │
│            │    content                            │
│            │                                      │
└────────────┴──────────────────────────────────────┘
```

| Surface | Dimension | Behavior |
|---|---|---|
| Sidebar | `248px` expanded, `68px` collapsed | Sticky, scrollable inside |
| Topbar | `64px` tall, sticky, `backdrop-filter: blur(8px)` | Stays visible while scrolling |
| Page max-width | `1480px` | Centered with auto margins on ultra-wide |
| Page padding | `32px` horizontal desktop, `20px` mobile | Logical (`padding-inline`) |

### 5.2 Breakpoints

| Name | Min width | Behavior |
|---|---|---|
| `xs` | 0 | Single column, sidebar collapsed to icons, search hides behind icon trigger |
| `sm` | 640 | Same as xs with slightly relaxed paddings |
| `md` | 820 | Sidebar still icon-only, KPI grid becomes 2-col |
| `lg` | 1100 | Sidebar expanded, 2-col layouts enabled, 4-col KPIs |
| `xl` | 1320 | Full layout, max-width takes over |
| `2xl` | 1480 | Centered on background, atmospheric washes visible |

**Mobile-specific rules:**
- The sidebar collapses to icons automatically below `md`. The brand mark stays visible.
- The global search becomes an icon button below `md`; tapping it opens a full-width sheet.
- The patient header reflows to two rows (avatar + name, then meta tags).
- The SOAP grid stacks vertically below `lg`.
- The floating action/demo bar sits 10px from the bottom edge below `md`.
- Tap targets are minimum 44×44 pt on all interactive elements.

### 5.3 Page-head pattern

Every page starts with this structure. It anchors the user.

```
[ eyebrow — date or breadcrumb in JetBrains Mono ]
[ Fraunces display heading with optional italic em ]
[ caption row — multiple meta values separated by dots ] [ action buttons (right) ]
```

The italic `<em>` inside a Fraunces heading is a signature move — use it for names, places, or anything personal ("Good morning, *Dr. Sara*").

### 5.4 Grid columns

For multi-column content inside a page:
- 2-column "main + side": `grid-template-columns: 1.55fr 1fr; gap: 20px;` — main on the inline-start
- 4-up KPI strip: `grid-template-columns: repeat(4, 1fr); gap: 14px;`
- 2-up SOAP grid: `grid-template-columns: 1fr 1fr; gap: 20px;`
- All collapse to single column below `lg` (1100px)

---

## 6. Iconography

- **Library:** [Lucide](https://lucide.dev) — line icons, 1.8px stroke, 18px nominal.
- **Color:** `currentColor` so they inherit. Default `--ink-3` in rest state, `--ink` on hover, `--paper` when on an active background.
- **Size:** 14px in buttons, 16px in inputs and inline, 18px in nav, 20px in cards.
- **Never use filled icons** for navigation — fills carry semantic weight reserved for "active" states. Stay outlined throughout.

Custom medical icons (stethoscope, vials, pill bottle) go in `packages/ui/src/icons/` and follow the same 1.8px stroke discipline as Lucide.

---

## 7. Motion

### 7.1 Easing curves

| Token | Curve | Use |
|---|---|---|
| `ease-standard` | `cubic-bezier(0.2, 0, 0, 1)` | Default for nearly everything |
| `ease-emphasized` | `cubic-bezier(0.3, 0, 0, 1)` | Larger movements (sheet/drawer open) |
| `ease-decel` | `cubic-bezier(0, 0, 0, 1)` | Entries |
| `ease-accel` | `cubic-bezier(0.4, 0, 1, 1)` | Exits |

### 7.2 Durations

| Token | Value | Use |
|---|---|---|
| `dur-1` | 80ms | Color/background hovers |
| `dur-2` | 150ms | Default for buttons, inputs, chips |
| `dur-3` | 220ms | Card hover lift, sidebar collapse |
| `dur-4` | 320ms | Screen transitions, modal enter |
| `dur-5` | 480ms | Choreographed page loads |

### 7.3 Rules

- **No bouncy or rubber-band easing.** This is a clinical app.
- **Reduce-motion is honored.** Wrap any non-essential motion in `@media (prefers-reduced-motion: no-preference)`.
- **One choreographed entrance per page.** Use staggered `animation-delay` on KPIs or list rows (20ms apart), not on every element.
- **Status changes flash, not bounce.** When a vital crosses a threshold, the card border tints for 600ms then fades back.

---

## 8. Component patterns

### 8.1 Button

| Variant | Background | Border | Text | Use |
|---|---|---|---|---|
| Primary | `--primary-500` | none | `#ffffff` | Save, sign, confirm, start — one per view |
| Secondary | `--card` | 1px `--rule` | `--ink` | Default action |
| Ghost | transparent | none | `--ink-2` | Tertiary, inline within cards |
| Danger | `--alert-fg` | none | `#ffffff` | Destructive only (delete patient, void invoice) |
| Link | transparent | none | `--primary-600` | Inline within text |

Sizing: `padding: 9px 14px; border-radius: 10px; font-size: 13.5px; font-weight: 500;`. Icons are 14px and inline-start of the label. Active state lowers the element 1px (`translateY(1px)`).

### 8.2 Card

```
┌────────────────────────────────────────────┐
│  card-head — title + subtitle + action     │
├────────────────────────────────────────────┤
│  card-body (padded or list-style)          │
└────────────────────────────────────────────┘
```

- `background: --card; border: 1px solid --rule; border-radius: --radius-lg;`
- Head: `padding: 16px 20px 14px;` with a bottom `1px solid --rule`
- Body: either `padding: 18px 20px;` (free content) or zero padding when it contains a list of rows that handle their own padding
- Optional **inline-start rail** — a 3px colored stripe on the inline-start to color-code intent. Use for KPI cards and status cards only, not for every card.

### 8.3 Status pill

```
●  CONFIRMED
```

- Inline-flex, gap 6px, padding `4px 9px`, `border-radius: 999px`
- `font-family: --mono; font-size: 11.5px; font-weight: 500; letter-spacing: .04em; text-transform: uppercase;`
- Leading `::before` 6px dot in `currentColor`
- Background uses the `-bg` token, text uses the `-fg` token

| Status | Token pair |
|---|---|
| Scheduled | `--rule` / `--ink-3` |
| Confirmed | `--primary-100` / `--primary-700` |
| Arrived, Resolved, Normal | `--vital-bg` / `--vital-fg` |
| In progress, Pending | `--warn-bg` / `--warn-fg` |
| No-show, Critical, Allergy | `--alert-bg` / `--alert-fg` |

### 8.4 KPI card

```
┌─[3px primary rail]──────────────────┐
│ LABEL                  ▤ small meta │
│                                     │
│ 24            ▴ 12%                 │
│ value         vs last week          │
│                                     │
│                            ╲╱╲ spark│
└─────────────────────────────────────┘
```

- 4-up grid on desktop, 2-up on tablet, 1-up on mobile
- Label in `eyebrow` style
- Value: Fraunces 500, ~36px, tabular nums
- Delta pill: mono, 11px, vital-bg or alert-bg
- Optional sparkline: 64×22 viewBox, 1.5px stroke in `--primary-500` (or vital-fg for positive metrics)
- 3px inline-start rail in semantic color (primary / vital / warn / alert)

### 8.5 Data table

- Header row: `--card-2` background, `eyebrow` typography for column labels, sticky top
- Body rows: 1px dashed `--rule` between rows (softer than solid)
- Hover state: `--card-2` background
- Numeric columns right-aligned in LTR, start-aligned in RTL (use `text-align: end`)
- All cells `tabular-nums`
- Avoid zebra stripes — they fight the data

### 8.6 Form input

```css
.input {
  background: var(--card);
  border: 1px solid var(--rule);
  border-radius: 10px;
  padding: 9px 12px;
  font-size: 14px;
}
.input:hover { border-color: var(--rule-2); }
.input:focus {
  border-color: var(--primary-500);
  box-shadow: 0 0 0 3px var(--primary-100);
  outline: none;
}
.input[aria-invalid="true"] {
  border-color: var(--alert-fg);
  box-shadow: 0 0 0 3px var(--alert-bg);
}
```

Labels sit above the input, `13px / 500 / --ink-2`. Helper text below, `12px / --ink-3`. Required indicator is a small `--alert-fg` asterisk after the label.

### 8.7 Tabs

- Underline tabs only — no pill tabs in the product
- 11px bottom `border-bottom`, `--ink` on active, transparent on rest
- Padding `11px 16px`, font-weight 500
- Hover: `--ink` text without underline change
- Overflow horizontally on small screens, scroll without scrollbar

### 8.8 Patient header

The patient header is the most opinionated component in the system. Spec:
- Background: `--card`, `border-radius: --radius-xl`, `padding: 24px 28px`
- Grid: `auto 1fr auto` — avatar, info, actions
- Avatar: 88×88 circle, `background: linear-gradient(160deg, --primary-500, --primary-700)`, white initials in Fraunces 600 32px
- Name: Fraunces 500 32px (responsive down to 24px), with the alt-language version shown inline at 0.65em in `--ink-3`
- Meta row: chips and tags separated by 3px `--ink-4` dots
- One **radial wash** of `--primary-100` (light) or `--primary-900` (dark) bleeding from the inline-end corner — this is the signature decorative move

### 8.9 SOAP encounter card

Four cards in a 2×2 grid. Each card has:
- A giant ghost letter (S, O, A, P) at 84px, color `--paper-3`, positioned inline-end top — decorative, semantic, instantly scannable
- Eyebrow in `--primary-500` ("SUBJECTIVE", "OBJECTIVE", etc.)
- h2 title in Fraunces
- Auto-resizing textarea with `--card-2` background, focuses to `--card` + primary border
- Chip row below for symptom/diagnosis quick-adds, ending in a dashed "Add" chip

---

## 9. Bilingual & RTL rules

### 9.1 Logical CSS only

**Never** use directional properties: `left`, `right`, `margin-left`, `padding-right`, `border-left`, `text-align: left/right`, `float: left/right`. The codebase will fail review if any are added.

Use these instead:

| Avoid | Use |
|---|---|
| `padding-left` | `padding-inline-start` |
| `padding-right` | `padding-inline-end` |
| `margin-left` | `margin-inline-start` |
| `border-left` | `border-inline-start` |
| `left: 0` | `inset-inline-start: 0` |
| `text-align: left` | `text-align: start` |
| `transform: translateX(50%)` (decorative) | Apply RTL override |

Tailwind equivalents: `ps-*`, `pe-*`, `ms-*`, `me-*`, `border-s-*`, `border-e-*`, `start-*`, `end-*`, `text-start`, `text-end`. The `rtl:` variant catches the rest.

### 9.2 Language switch behavior

When the user toggles EN ↔ AR:
1. `<html lang="..." dir="...">` updates
2. CSS `--sans` swaps from Inter to IBM Plex Sans Arabic
3. All UI strings re-render via i18n
4. Decorative elements that use absolute positioning mirror via `inset-inline-*`
5. Numerals stay Western Arabic (1, 2, 3) by default; Eastern Arabic numerals (١، ٢، ٣) are opt-in via a user preference

### 9.3 Mixed-script content

In a single string mixing Arabic and Latin (drug names, codes, names with English transliteration):
- The dominant script's direction wins for the paragraph
- Wrap the foreign-script run in `<bdi>` or apply `unicode-bidi: isolate`
- Numerals always inherit paragraph direction unless explicitly set

### 9.4 Don't auto-translate clinical data

Patient names, clinician notes, diagnoses entered as free text, prescription instructions — **never** machine-translate. Show whichever language was authored, with a small `EN` or `AR` badge if needed. UI chrome (button labels, column headers, status pills) is fully translated; user-generated clinical text is not.

---

## 10. Accessibility

### 10.1 Contrast

All combinations in this design system meet **WCAG AA**:

| Foreground / Background | Ratio | Pass |
|---|---|---|
| `--ink` on `--paper` | 17.4 : 1 | AAA |
| `--ink-2` on `--paper` | 10.1 : 1 | AAA |
| `--ink-3` on `--paper` | 5.0 : 1 | AA |
| `--ink-4` on `--paper` | 3.2 : 1 | AA (large only — body text never uses this color) |
| white on `--primary-500` | 5.25 : 1 | AA |
| `--primary-700` on `--paper` | 8.5 : 1 | AAA |
| `--alert-fg` on `--alert-bg` | 6.1 : 1 | AA |
| `--vital-fg` on `--vital-bg` | 5.8 : 1 | AA |

When introducing new colors, verify against `--paper` and `--card`. Tooling: `npm run check:contrast` (runs `pa11y` against Storybook stories).

### 10.2 Focus

Every interactive element has a visible focus ring: `2px solid --primary-500` with `2px` offset. Never remove the focus ring; if it looks ugly on a specific component, adjust the offset, don't hide it.

### 10.3 Keyboard

- Tab order matches visual order — never use `tabindex > 0`
- All clickable elements are `<button>` or `<a>`; never click handlers on `<div>`
- `Esc` closes the most-recently-opened overlay
- `⌘K` / `Ctrl+K` opens the global command palette
- Patient list navigation: arrow keys move selection, `Enter` opens

### 10.4 Screen reader

- All icons-only buttons have `aria-label`
- Status changes announce via `aria-live="polite"` — but only meaningful ones (e.g., "Lab result received"), not chrome
- Forms use `aria-describedby` to connect helper text and error messages
- Patient charts use proper heading hierarchy (one `h1` per page, `h2` for cards, `h3` for sub-sections inside cards)

### 10.5 Touch

Minimum tap target is 44×44 pt. KPI cards, appointment rows, and nav items already exceed this; for icon-only buttons, ensure padding pushes them past the threshold even when the visual icon is 18px.

---

## 11. Tailwind / token reference

### 11.1 CSS variables (drop in `apps/web/src/styles/tokens.css`)

```css
:root {
  /* Brand */
  --primary-50:  #f0f5fe;
  --primary-100: #e2ebfe;
  --primary-200: #c4d6fe;
  --primary-300: #95b6fd;
  --primary-400: #4f85fc;
  --primary-500: #155dfc;
  --primary-600: #1251dd;
  --primary-700: #0f42b5;
  --primary-800: #0b338a;
  --primary-900: #072058;

  /* Neutrals — light */
  --paper:   #f7f9fc;
  --paper-2: #eef2f8;
  --paper-3: #e4eaf3;
  --card:    #ffffff;
  --card-2:  #fafbfd;
  --ink:     #0b1220;
  --ink-2:   #283344;
  --ink-3:   #5b6679;
  --ink-4:   #8b95a8;
  --rule:    #dfe5ee;
  --rule-2:  #c8d0de;

  /* Semantic */
  --vital-fg: #0f7a4d;  --vital-bg: #dcf2e4;
  --warn-fg:  #a76a0c;  --warn-bg:  #fbedcf;
  --alert-fg: #b3261e;  --alert-bg: #fadcd9;
  --info-fg:  #155dfc;  --info-bg:  #e2ebfe;

  /* Type */
  --serif:   "Fraunces", Georgia, serif;
  --sans:    "Inter", system-ui, sans-serif;
  --sans-ar: "IBM Plex Sans Arabic", "Inter", system-ui, sans-serif;
  --mono:    "JetBrains Mono", ui-monospace, monospace;

  /* Radius */
  --radius-sm: 6px;
  --radius:    10px;
  --radius-lg: 14px;
  --radius-xl: 20px;

  /* Shadow */
  --shadow-1: 0 1px 0 rgba(11, 18, 32, .04), 0 1px 2px rgba(11, 18, 32, .04);
  --shadow-2: 0 1px 0 rgba(11, 18, 32, .05), 0 8px 24px -12px rgba(11, 18, 32, .12);
  --shadow-3: 0 4px 8px -2px rgba(11, 18, 32, .08), 0 24px 48px -16px rgba(11, 18, 32, .18);

  /* Layout */
  --sidebar-w: 248px;
  --sidebar-w-collapsed: 68px;
  --topbar-h: 64px;
}

html[lang="ar"] { --sans: var(--sans-ar); }

html[data-theme="dark"] {
  --paper:   #0b1220;
  --paper-2: #101a2d;
  --paper-3: #172339;
  --card:    #101a2d;
  --card-2:  #152038;
  --ink:     #f3f6fb;
  --ink-2:   #d1d8e4;
  --ink-3:   #8b95a8;
  --ink-4:   #5b6679;
  --rule:    #1f2a40;
  --rule-2:  #2a374f;
  --vital-bg: #11261c;
  --warn-bg:  #2a200f;
  --alert-bg: #2c1816;
  --info-bg:  #0b1d3d;
}
```

### 11.2 Tailwind config (`packages/ui/tailwind.preset.ts`)

```ts
import type { Config } from 'tailwindcss';

export default {
  theme: {
    extend: {
      colors: {
        primary: {
          50: 'var(--primary-50)', 100: 'var(--primary-100)', 200: 'var(--primary-200)',
          300: 'var(--primary-300)', 400: 'var(--primary-400)', 500: 'var(--primary-500)',
          600: 'var(--primary-600)', 700: 'var(--primary-700)', 800: 'var(--primary-800)',
          900: 'var(--primary-900)',
          DEFAULT: 'var(--primary-500)',
        },
        paper:  { DEFAULT: 'var(--paper)',  2: 'var(--paper-2)',  3: 'var(--paper-3)' },
        card:   { DEFAULT: 'var(--card)',   2: 'var(--card-2)' },
        ink:    { DEFAULT: 'var(--ink)',    2: 'var(--ink-2)',    3: 'var(--ink-3)',    4: 'var(--ink-4)' },
        rule:   { DEFAULT: 'var(--rule)',   2: 'var(--rule-2)' },
        vital:  { fg: 'var(--vital-fg)', bg: 'var(--vital-bg)' },
        warn:   { fg: 'var(--warn-fg)',  bg: 'var(--warn-bg)'  },
        alert:  { fg: 'var(--alert-fg)', bg: 'var(--alert-bg)' },
        info:   { fg: 'var(--info-fg)',  bg: 'var(--info-bg)'  },
      },
      fontFamily: {
        serif: ['var(--serif)'],
        sans:  ['var(--sans)'],
        mono:  ['var(--mono)'],
      },
      borderRadius: {
        sm: 'var(--radius-sm)',
        DEFAULT: 'var(--radius)',
        lg: 'var(--radius-lg)',
        xl: 'var(--radius-xl)',
      },
      boxShadow: {
        1: 'var(--shadow-1)',
        2: 'var(--shadow-2)',
        3: 'var(--shadow-3)',
      },
      screens: {
        sm: '640px', md: '820px', lg: '1100px', xl: '1320px', '2xl': '1480px',
      },
      transitionTimingFunction: {
        standard:    'cubic-bezier(0.2, 0, 0, 1)',
        emphasized:  'cubic-bezier(0.3, 0, 0, 1)',
        decel:       'cubic-bezier(0, 0, 0, 1)',
        accel:       'cubic-bezier(0.4, 0, 1, 1)',
      },
    },
  },
} satisfies Partial<Config>;
```

### 11.3 Component class examples

```html
<!-- Primary button -->
<button class="inline-flex items-center gap-2 px-3.5 py-2.5 bg-primary text-white rounded-[10px] text-[13.5px] font-medium hover:bg-primary-600 active:translate-y-px transition-colors duration-150">
  Save changes
</button>

<!-- Status pill -->
<span class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-vital-bg text-vital-fg font-mono text-[11.5px] font-medium tracking-wider uppercase">
  <span class="size-1.5 rounded-full bg-current"></span> Arrived
</span>

<!-- Card -->
<div class="bg-card border border-rule rounded-lg shadow-1">
  <div class="px-5 py-4 border-b border-rule flex items-center justify-between">
    <h2 class="font-serif font-medium text-xl tracking-tight">Today's schedule</h2>
  </div>
  <div class="p-5"> … </div>
</div>
```

---

## 12. Quick checklist before merging UI

- [ ] No hard-coded colors — only token references
- [ ] No `left` / `right` / `pl-*` / `pr-*` / `ml-*` / `mr-*`
- [ ] Headings respect the one-serif-moment rule (one Fraunces hero per page)
- [ ] All numerals in data cells use `tabular-nums`
- [ ] Focus ring visible on every interactive element
- [ ] Tap targets ≥ 44×44 on mobile
- [ ] Contrast verified against `--paper` and `--card`
- [ ] Works in `dir="rtl"` without visual bugs
- [ ] Works in `data-theme="dark"` without visual bugs
- [ ] Reduce-motion respected for non-essential animations
- [ ] Touched component has a Storybook story