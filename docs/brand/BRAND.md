# Attic — Brand Identity

**Last updated:** 2026-03-16
**Palette name:** Parchment + Ink
**Status:** Locked for MVP

---

## Philosophy

**The UI is the frame. User content is the art.**

Attic's interface carries zero decorative color. All visual saturation belongs to the user's TikTok thumbnails, entity images, and content. The chrome recedes so the person's digital life — not our brand — is what they see.

The brand accent (Cinnamon) exists for special moments only: marketing pages, the Wrapped-style reveal experience, onboarding, and badges. It never appears in the everyday conversation UI.

---

## Color Palette

### Core (everyday UI)

| Token           | Hex       | Usage                                     |
|-----------------|-----------|-------------------------------------------|
| Parchment       | `#F8F7F4` | Page background — warm off-white          |
| White           | `#FFFFFF` | Card/surface backgrounds                  |
| Ink             | `#1C1B18` | Primary text — warm near-black            |
| Soft Black      | `#2C2926` | User message bubbles                      |
| Stone           | `#9C9890` | Secondary text, muted elements            |
| Border          | `#E6E4DE` | Card borders, dividers — warm gray        |
| Border Hover    | `#D0CCC4` | Borders on hover                          |
| Subtle          | `#F0EEE8` | Chips, tags, hover fills                  |

### Brand Accent: Cinnamon (special occasions only)

| Variant  | Hex                          | Usage                                  |
|----------|------------------------------|----------------------------------------|
| Default  | `#A06840`                    | CTAs, hero sections, Wrapped stats     |
| Light    | `#BC8058`                    | Hover states, lighter fills            |
| Dark     | `#7E5030`                    | Pressed states, text on light bg       |
| Subtle   | `rgba(160, 104, 64, 0.07)`  | Badge/chip background tint             |
| Border   | `rgba(160, 104, 64, 0.15)`  | Accent-tinted borders                  |

### Semantic

| State   | Color     | Background | Border    | Text      |
|---------|-----------|------------|-----------|-----------|
| Error   | `#B54040` | `#FDF2F2`  | `#E8BCBC` | `#8C2D2D` |
| Success | `#3D7A4A` | `#F2F8F3`  | `#BCE8C4` | `#2E5E38` |
| Warning | `#A07830` | `#FDF8F0`  | `#E8D8B8` | `#7A5C24` |
| Info    | `#4A6A8A` | `#F0F4F8`  | `#B8CCE0` | `#3A5470` |

### Where Cinnamon DOES appear

- Landing page hero section background
- "Get started" and primary CTA buttons (marketing only)
- Wrapped-style reveal stat numbers
- "New" and "Beta" badges
- Onboarding highlights and progress
- Focus rings on interactive elements
- Link hover color in marketing contexts
- Email template headers

### Where Cinnamon DOES NOT appear

- Chat message bubbles (user or assistant)
- Entity cards (restaurant, book, etc.)
- Navigation chrome
- Everyday chips and tags
- Collection thumbnails or grids
- Settings page
- Upload flow

---

## Typography

### Font Stack

| Role    | Font        | Purpose                                                    | Weights   |
|---------|-------------|------------------------------------------------------------|-----------|
| Display | Crimson Pro | Wordmark, landing/marketing headlines, reveal stats ONLY   | 400, 500, 600 |
| Body    | DM Sans     | Everything in the product UI — headers, body, chat, cards  | 400, 500  |
| Mono    | DM Mono     | Timestamps, metadata, upload stats, data displays          | 400       |

Load via `next/font` for zero-FOUT:

```tsx
import { Crimson_Pro, DM_Sans, DM_Mono } from "next/font/google";

const crimsonPro = Crimson_Pro({
  subsets: ["latin"],
  variable: "--font-display",
  display: "swap",
});

const dmSans = DM_Sans({
  subsets: ["latin"],
  variable: "--font-sans",
  display: "swap",
});

const dmMono = DM_Mono({
  subsets: ["latin"],
  weight: "400",
  variable: "--font-mono",
  display: "swap",
});

// In layout.tsx <body>:
<body className={`${crimsonPro.variable} ${dmSans.variable} ${dmMono.variable}`}>
```

### Where Each Font Appears

**Crimson Pro (display) — limited to these specific contexts:**
- The "attic" wordmark / logo (via `.wordmark` class)
- Landing page hero headline (via `.font-display` class)
- Reveal page stat numbers (the big "847") and section headers
- Marketing page headlines
- NOT for in-product h1/h2/h3 — those use DM Sans

**DM Sans (body) — the default for everything:**
- All in-product headers (h1, h2, h3)
- All chat messages (user and assistant)
- Entity card titles and metadata
- Editorial asides (italic) — the agent's "knowing" voice
- Chips, tags, labels
- Navigation text and buttons
- Form inputs and placeholders
- Upload flow, settings, processing — all product UI
- Follow-up chips and suggested prompts

**DM Mono (mono):**
- Upload timestamps and file sizes
- Item count displays
- Processing metadata
- Chat header data summary (e.g., "847 items · Dec 15, 2024")
- Any tabular data or technical readouts

### Type Scale

| Name | Size | Font    | Use |
|------|------|---------|-----|
| xs   | 12px | DM Sans | Chips, badges, metadata |
| sm   | 13px | DM Sans | Captions, timestamps |
| base | 14px | DM Sans | Body text, chat messages |
| md   | 15px | DM Sans | Emphasized body, chat header |
| lg   | 17px | DM Sans | In-product section headers |
| xl   | 20px | DM Sans | In-product page titles |
| 2xl  | 24px | Crimson Pro | Reveal stat labels (via .font-display) |
| 3xl  | 30px | Crimson Pro | Marketing headlines (via .font-display) |
| 4xl  | 48px | Crimson Pro | Hero headline, landing only (via .font-display) |

### Rules

- DM Sans: two weights only — 400 (regular) and 500 (medium)
- Crimson Pro: 500 (medium) for wordmark, 600 (semibold) for hero headlines, 700 (bold) for reveal stat numbers
- Editorial asides use DM Sans italic — NOT Crimson Pro
- In-product h1/h2/h3 default to DM Sans via CSS — use `.font-display` class to opt into Crimson Pro on landing/reveal pages
- Line height: 1.5 for DM Sans body, 1.25 for display headlines, 1.35 for compact UI
- Letter spacing: -0.03em for Crimson Pro wordmark, -0.02em for display headlines, -0.01em for DM Sans headers, 0 for body
- No ALL CAPS except single-word labels (e.g., "NEW")

---

## Voice & Tone

### Brand personality

Attic talks like a **culturally fluent friend** — someone who also spends too much time on TikTok, knows what BookTok is, and doesn't need to explain the basics. Warm, slightly knowing, never condescending.

### Principles

| Do | Don't |
|----|-------|
| "You saved 47 restaurants you forgot about" | "Your content has been classified into categories" |
| "Heavy on the cooking content lately" | "Analysis shows 34% of your saves are food-related" |
| "That pasta place in Brooklyn? Found it" | "We have located a restaurant entity matching your query" |
| Assume cultural literacy | Explain TikTok to a TikTok user |
| Use TikTok-native language naturally | Force slang ("no cap this is bussin") |
| Be slightly editorial/teasing | Be mean or judgmental about habits |
| Frame data as discovery | Frame data as surveillance |

### Empty states

Empty states and prompts should spark curiosity, not feel like a blank form:

- "What have I been into lately?"
- "Find that recipe video I saved last month"
- "Show me everything from creators in Chicago"
- "What restaurants keep showing up in my saves?"

### Avoid

- "Screen time" framing or guilt language
- Corporate voice ("We're excited to announce...")
- Over-explaining ("Your TikTok data export contains...")
- Generic AI phrasing ("I'd be happy to help you with that!")

---

## Component Patterns

### Chat messages

- **User bubbles:** Soft Black (#2C2926) with Parchment text. Right-aligned.
- **Assistant responses:** White card (#FFFFFF) with Ink text and Border stroke. Left-aligned. May contain inline entity cards, thumbnail grids, and collection previews.
- **Links in chat:** Underline only (no color). Underline color matches Stone, darkens on hover.

### Entity cards

- White background, Border stroke, 12px radius
- Thumbnail: 44px square, 8px radius
- Title in Ink (medium weight), metadata in Stone
- No accent color — entity images provide all color
- Action links: underlined text, not colored buttons

### Chips and tags

- Background: Subtle (#F0EEE8)
- Text: Stone (#9C9890)
- Border: ink at 7% opacity
- Radius: full (pill shape)
- Exception: Cinnamon chips for marketing badges only

### Thumbnail grids

- 3- or 4-column grid, 3px gap
- 6px border radius on outer corners
- No borders on individual thumbnails
- The grid IS the visual — let images touch

### Borders over shadows

The parchment system uses 0.5px warm gray borders, not shadows, to define surfaces. Shadows appear only on:
- Modals and popovers (shadow-lg)
- Focus rings (shadow-focus with Cinnamon)

---

## Logo

### Direction (pre-generation)

- Lowercase wordmark: **attic**
- Font: Geist Medium or DM Sans Medium at -0.02em tracking
- Color: Ink (#1C1B18) on light backgrounds
- No icon/logomark at MVP — wordmark only
- Favicon: first letter "a" in a rounded square, Ink on Parchment

### Usage rules

- Minimum size: 14px font-size for digital
- Clear space: 0.5em on all sides
- Never place on colored backgrounds (always Parchment or White)
- Never apply Cinnamon to the wordmark (it's Ink, always)

---

## Files

| File | Purpose |
|------|---------|
| `src/frontend/src/lib/design-tokens.ts` | Machine-readable token source of truth |
| `src/frontend/src/app/globals.css` | CSS custom properties consuming tokens |
| `docs/BRAND.md` | This file — human-readable brand reference |

All design decisions flow from `design-tokens.ts`. When adding new components, check tokens first. If a value isn't in tokens, it probably shouldn't exist.
