---
name: Arsen
description: Mobile-first offline workout tracker with a compact dark athletic interface.
colors:
  arsen-bg: "oklch(0.075 0 0)"
  arsen-bg2: "oklch(0.105 0.012 280)"
  arsen-surface: "oklch(0.155 0.016 280)"
  arsen-surface2: "oklch(0.205 0.018 280)"
  arsen-line: "oklch(0.34 0.026 285)"
  arsen-ink: "oklch(0.96 0.005 280)"
  arsen-muted: "oklch(0.73 0.012 280)"
  arsen-dim: "oklch(0.54 0.015 280)"
  arsen-purple: "oklch(0.62 0.16 295)"
  arsen-purple2: "oklch(0.72 0.13 300)"
  arsen-acid: "oklch(0.86 0.20 125)"
  arsen-acid2: "oklch(0.77 0.20 122)"
  on-acid: "#142100"
typography:
  display:
    fontFamily: "Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif"
    fontSize: "28px"
    fontWeight: 900
    lineHeight: 1
    letterSpacing: "0"
  headline:
    fontFamily: "Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif"
    fontSize: "22px"
    fontWeight: 900
    lineHeight: 1.15
    letterSpacing: "0"
  title:
    fontFamily: "Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif"
    fontSize: "20px"
    fontWeight: 900
    lineHeight: 1.2
    letterSpacing: "0"
  body:
    fontFamily: "Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif"
    fontSize: "14px"
    fontWeight: 600
    lineHeight: 1.5
    letterSpacing: "0"
  label:
    fontFamily: "Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif"
    fontSize: "12px"
    fontWeight: 800
    lineHeight: 1.2
    letterSpacing: "0"
rounded:
  sm: "8px"
  md: "10px"
  lg: "12px"
  sheet: "22px"
  full: "9999px"
spacing:
  xs: "4px"
  sm: "8px"
  md: "12px"
  lg: "16px"
  xl: "28px"
components:
  button-primary:
    backgroundColor: "{colors.arsen-purple}"
    textColor: "{colors.arsen-ink}"
    typography: "{typography.body}"
    rounded: "{rounded.md}"
    padding: "12px 16px"
    height: "48px"
  button-acid:
    backgroundColor: "{colors.arsen-acid}"
    textColor: "{colors.on-acid}"
    typography: "{typography.body}"
    rounded: "{rounded.md}"
    padding: "12px 16px"
    height: "48px"
  button-ghost:
    backgroundColor: "transparent"
    textColor: "{colors.arsen-ink}"
    typography: "{typography.body}"
    rounded: "{rounded.md}"
    padding: "12px 16px"
    height: "48px"
  card:
    backgroundColor: "{colors.arsen-surface}"
    textColor: "{colors.arsen-ink}"
    rounded: "{rounded.lg}"
    padding: "12px"
  input:
    backgroundColor: "{colors.arsen-surface}"
    textColor: "{colors.arsen-ink}"
    typography: "{typography.body}"
    rounded: "{rounded.md}"
    padding: "12px"
    height: "48px"
---

# Design System: Arsen

## Overview

**Creative North Star: "Pocket Iron Console"**

Arsen feels like a dense training console carried in one hand: dark, immediate, athletic, and tuned for logging work between sets. The interface is not a lifestyle magazine or a wellness dashboard. It is a compact operating surface where the next action is always close, data stays legible, and visual intensity is reserved for training state.

The visual system uses a near-black shell, violet-purple orientation cues, and acid green performance cues. Surfaces are layered tonally instead of floated with big shadows. Typography is heavy and compact, with small labels doing a lot of information work.

**Key Characteristics:**

- Mobile-first, app-like, and constrained to a narrow phone column.
- High-density cards, sheets, chips, and rows with clear tap targets.
- Purple marks navigation, selection, and contextual controls.
- Acid green marks completion, saved work, progress, and performance.
- Exercise art is dark, contained, and bordered with violet light.

## Colors

The palette is dark neutral first, with two functional accents: purple for orientation and acid green for training success.

### Primary

- **Training Purple**: The primary navigation and selection color. Use it for active tabs, route icons, compact controls, highlighted chips, and contextual info.
- **Lift Violet**: The brighter purple used when an icon, chart line, or active state needs a sharper edge.

### Secondary

- **Acid Progress**: The performance accent. Use it for completed sets, progress bars, save actions, ready-to-increase-weight recommendations, storage progress, and positive training feedback.
- **Acid Deep**: The darker green used in gradients with Acid Progress, especially on progress fills and positive primary actions.

### Neutral

- **Black Mat**: The page background and outer viewport.
- **Deep Phone Shell**: The app shell, bottom nav, and sheet background.
- **Charcoal Surface**: Default card, row, and input background.
- **Raised Charcoal**: Secondary surface for nested controls and stronger containers.
- **Cool Ink**: Main text.
- **Muted Steel**: Secondary copy and labels.
- **Dim Steel**: Disabled, skipped, or inactive text.
- **Violet Line**: Stronger structural border token; most subtle dividers use white at 10% opacity.

### Named Rules

**The Two Accent Rule.** Purple answers "where am I and what can I choose"; acid green answers "what improved or was saved." Do not swap those roles casually.

**The Dark Surface Rule.** Most screen area must remain neutral dark. Accent color should punctuate state and action, not flood the app.

## Typography

**Display Font:** Inter with system sans fallbacks.
**Body Font:** Inter with system sans fallbacks.
**Label/Mono Font:** Inter with system sans fallbacks.

**Character:** Heavy, compact, and utilitarian. Headings use black weights to create a training-console feel; labels are small and bold so dense stats can stay scannable.

### Hierarchy

- **Display** (900, 28px, line-height 1): Page titles in `PageHeader`.
- **Headline** (900, 22px, tight line-height): Current exercise names and major card titles.
- **Title** (900, 20px, line-height 1.2): Sheet headings and section-level titles.
- **Body** (600, 14px, line-height 1.5): Dense explanatory copy, card rows, and control text.
- **Label** (800, 10-12px, line-height 1.2): Eyebrows, stat labels, filter chips, navigation labels, and form labels.

### Named Rules

**The Heavy-Top Rule.** Use weight, not large type, to create hierarchy inside the 430px shell.

**The Zero-Tracking Rule.** Letter spacing is normal across the app. Do not use compressed negative tracking or wide decorative tracking.

## Layout

Arsen is a single-column mobile app constrained to 430px max width. The shell fills `100dvh`, keeps content scrollable in the main area, and reserves an 84px fixed bottom navigation zone with safe-area padding.

Screens are built from tight vertical stacks with 16px page padding, 8-12px internal gaps, and compact grid rows for repeated information. Cards and rows favor `grid` layouts with fixed icon/art columns and fluid text columns, so names can truncate without moving controls. Sheets enter from the bottom and use a full-width rounded top surface inside the same 430px column.

## Elevation & Depth

Depth is mostly tonal. Cards sit on Charcoal Surface with a thin white border and a small inset top highlight. The shell has a subtle outline, sheets use the strongest shadow in the system, and exercise art uses an inset violet glow. Avoid large ambient shadows on ordinary cards.

### Shadow Vocabulary

- **Shell Hairline** (`0 0 0 1px rgb(255 255 255 / 0.05)`): Used on the app column to separate it from the viewport.
- **Card Inset Highlight** (`inset 0 1px 0 rgb(255 255 255 / 0.04)`): Default card and action-row depth.
- **Sheet Lift** (`0 -16px 40px rgb(0 0 0 / 0.35)`): Bottom sheets and modal surfaces.
- **Exercise Glow** (`inset 0 0 18px rgb(153 83 255 / 0.18)`): Exercise and muscle artwork containers.

### Named Rules

**The Tonal-First Rule.** Reach for surface color, borders, and inset highlights before adding drop shadows.

## Shapes

The form language is moderately rounded and precise. Default controls and fields use a 10px radius, cards use 12px, compact menu items may use 8px, icon buttons use 9-12px, and bottom sheets use 22px only on the top corners. Pills are reserved for state labels and small metadata chips.

Borders are thin and mostly translucent white. Active purple states can strengthen the border; destructive states use translucent red borders. Exercise art is clipped into rounded squares and never appears unframed.

## Components

### Buttons

- **Shape:** Gently rounded rectangle (10px radius), minimum 48px high for main actions.
- **Primary:** Purple vertical gradient with white text for broad navigation or routine actions.
- **Acid:** Acid green vertical gradient with dark text for saving sets, progress, or positive completion.
- **Ghost:** Transparent with a subtle white border for cancel, secondary, or low-risk actions.
- **Danger:** Transparent red-tinted surface with red border and text for destructive actions.
- **States:** Buttons transition quickly, compress slightly on active press, and reduce opacity when disabled.

### Chips

- **Style:** Small, bold, rounded capsules with compact padding.
- **Selected:** Purple border and purple-tinted fill with white or violet text.
- **Status:** Acid tint for done, purple tint for in progress, white tint for pending, dim neutral for skipped.

### Cards / Containers

- **Corner Style:** 12px radius for primary cards; 10px radius for nested stat boxes.
- **Background:** Charcoal Surface with Cool Ink text.
- **Shadow Strategy:** Inset highlight only, except sheets and special exercise art.
- **Border:** 1px translucent white by default; accent borders only for active or recommendation states.
- **Internal Padding:** 12px for dense rows, 16px for larger summary cards.

### Inputs / Fields

- **Style:** 10px rounded field, dark surface, 1px translucent border, bold centered text for numeric training fields.
- **Focus:** Global focus-visible outline uses Acid Progress with a 2px offset.
- **Disabled:** Lower opacity and keep the field structurally stable.

### Navigation

Bottom navigation is fixed, four-column, and icon-first. Each item uses a 24px Lucide icon, 11px label, and active purple color. Inactive items stay muted and brighten on hover. The nav background is Deep Phone Shell at 95% opacity with backdrop blur and a top border.

### Sheets

Sheets are fixed to the bottom inside the 430px shell, sit over a black 55% scrim, and use a 22px rounded top edge. Each sheet starts with a small drag handle, a heavy title, muted context copy, a 36px close icon button, and a two-action footer when decisions are required.

### Exercise Art

Exercise and muscle art is a signature component. It is always framed in a rounded square with a violet border, dark background, and inset violet glow. Use it to anchor workout, routine, and progress rows, not as decorative background art.

## Do's and Don'ts

### Do:

- **Do** keep screens dense, thumb-friendly, and optimized for repeated workout use.
- **Do** use purple for selection, navigation, and contextual controls.
- **Do** use acid green for progress, saved work, positive completion, and performance.
- **Do** keep card depth subtle: border plus inset highlight is the default.
- **Do** truncate long exercise and routine names instead of letting controls shift.

### Don't:

- **Don't** create wide desktop layouts that break the 430px app-shell discipline.
- **Don't** use pale wellness colors, beige editorial surfaces, or generic SaaS blue as the dominant identity.
- **Don't** put decorative gradients or large shadows behind ordinary cards.
- **Don't** use accent color as broad background decoration; reserve it for state and action.
- **Don't** make exercise art unframed, full-bleed, or purely atmospheric.
