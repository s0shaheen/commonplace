/**
 * Attic Design Tokens
 *
 * Single source of truth for all design values.
 * Consumed by: tailwind.config.ts, globals.css, and any future
 * rendering contexts (Wrapped graphics, email templates, etc.)
 *
 * Palette: "Parchment + Ink"
 * Philosophy: The UI is the frame. User content is the art.
 * The chrome carries zero color — all saturation belongs to
 * TikTok thumbnails, entity images, and user content.
 *
 * Brand accent (Cinnamon) is reserved for marketing, reveals,
 * CTAs, and special moments. It does NOT appear in everyday
 * conversation UI.
 */

// ---------------------------------------------------------------------------
// Color primitives
// ---------------------------------------------------------------------------

export const colors = {
  // --- Base palette (light mode default) ---
  parchment: "#F8F7F4",    // Page background — warm off-white
  white: "#FFFFFF",         // Card / surface background
  ink: "#1C1B18",           // Primary text — warm near-black
  softBlack: "#2C2926",     // User message bubbles
  stone: "#9C9890",         // Secondary text, muted elements
  border: "#E6E4DE",        // Card borders, dividers — warm gray
  borderHover: "#D0CCC4",   // Borders on hover state
  subtle: "#F0EEE8",        // Subtle backgrounds (chips, tags, hover fills)

  // --- Brand accent: Cinnamon ---
  // Reserved for: hero sections, CTAs, Wrapped reveal stats,
  // "new" badges, link hovers in marketing, onboarding highlights.
  // NOT for: chat bubbles, entity cards, everyday UI chrome.
  cinnamon: {
    DEFAULT: "#A06840",     // Primary accent
    light: "#BC8058",       // Lighter variant (hover states, light fills)
    dark: "#7E5030",        // Darker variant (pressed states, text on light bg)
    subtle: "#A0684012",    // Background tint for badges/chips
    border: "#A0684025",    // Border for accent-tinted elements
  },

  // --- Semantic colors ---
  error: {
    DEFAULT: "#B54040",
    bg: "#FDF2F2",
    border: "#E8BCBC",
    text: "#8C2D2D",
  },
  success: {
    DEFAULT: "#3D7A4A",
    bg: "#F2F8F3",
    border: "#BCE8C4",
    text: "#2E5E38",
  },
  warning: {
    DEFAULT: "#A07830",
    bg: "#FDF8F0",
    border: "#E8D8B8",
    text: "#7A5C24",
  },
  info: {
    DEFAULT: "#4A6A8A",
    bg: "#F0F4F8",
    border: "#B8CCE0",
    text: "#3A5470",
  },

  // --- Dark mode overrides ---
  // (deferred at MVP — tokens ready for future use)
  dark: {
    bg: "#13110E",
    surface: "#1D1A15",
    text: "#EAE4D9",
    textSecondary: "#918A7E",
    border: "#2A2520",
    userBubble: "#D4A44C",
    cinnamon: "#C08050",
  },
} as const;

// ---------------------------------------------------------------------------
// Typography
// ---------------------------------------------------------------------------

export const typography = {
  fontFamily: {
    // Crimson Pro — wordmark, landing/marketing headlines, reveal stat numbers ONLY
    // NOT used for in-product headers, chat, or everyday UI
    display: "var(--font-display)",
    // DM Sans — primary font for ALL product UI: headers, body, chat, cards, everything
    sans: "var(--font-sans)",
    // DM Mono — timestamps, metadata, upload stats, data displays
    mono: "var(--font-mono)",
  },

  fontSize: {
    xs: "12px",
    sm: "13px",
    base: "14px",
    md: "15px",
    lg: "17px",
    xl: "20px",
    "2xl": "24px",
    "3xl": "30px",
    "4xl": "40px",
  },

  fontWeight: {
    normal: "400",
    medium: "500",
    semibold: "600",
  },

  lineHeight: {
    tight: "1.25",
    snug: "1.35",
    normal: "1.5",
    relaxed: "1.65",
  },

  letterSpacing: {
    tight: "-0.02em",
    normal: "0em",
    wide: "0.01em",
  },
} as const;

// ---------------------------------------------------------------------------
// Spacing
// ---------------------------------------------------------------------------

export const spacing = {
  px: "1px",
  0.5: "2px",
  1: "4px",
  1.5: "6px",
  2: "8px",
  3: "12px",
  4: "16px",
  5: "20px",
  6: "24px",
  8: "32px",
  10: "40px",
  12: "48px",
  16: "64px",
  20: "80px",
  24: "96px",
} as const;

// ---------------------------------------------------------------------------
// Borders & Radii
// ---------------------------------------------------------------------------

export const radius = {
  sm: "4px",
  md: "8px",
  lg: "12px",
  xl: "16px",
  full: "9999px",
} as const;

export const borderWidth = {
  DEFAULT: "0.5px",
  thick: "1px",
} as const;

// ---------------------------------------------------------------------------
// Shadows (minimal — parchment system uses borders, not shadows)
// ---------------------------------------------------------------------------

export const shadows = {
  none: "none",
  sm: "0 1px 2px rgba(28, 27, 24, 0.04)",
  md: "0 2px 8px rgba(28, 27, 24, 0.06)",
  lg: "0 4px 16px rgba(28, 27, 24, 0.08)",
  focus: "0 0 0 2px #F8F7F4, 0 0 0 4px #A06840",
} as const;

// ---------------------------------------------------------------------------
// Animation
// ---------------------------------------------------------------------------

export const animation = {
  duration: {
    fast: "100ms",
    normal: "200ms",
    slow: "400ms",
    reveal: "600ms",
  },
  easing: {
    default: "cubic-bezier(0.25, 0.1, 0.25, 1)",
    bounce: "cubic-bezier(0.34, 1.56, 0.64, 1)",
    smooth: "cubic-bezier(0.4, 0, 0.2, 1)",
  },
} as const;

// ---------------------------------------------------------------------------
// Component-specific tokens
// ---------------------------------------------------------------------------

export const components = {
  chat: {
    userBubble: {
      bg: colors.softBlack,
      text: colors.parchment,
      radius: radius.lg,
    },
    assistantBubble: {
      bg: colors.white,
      text: colors.ink,
      border: colors.border,
      radius: radius.lg,
    },
    input: {
      bg: colors.white,
      border: colors.border,
      borderFocus: colors.ink,
      placeholder: colors.stone,
      radius: radius.lg,
    },
    sendButton: {
      bg: colors.softBlack,
      text: colors.parchment,
      radius: radius.md,
    },
  },
  entityCard: {
    bg: colors.white,
    border: colors.border,
    radius: radius.lg,
    thumbnailRadius: radius.md,
  },
  chip: {
    bg: colors.subtle,
    text: colors.stone,
    border: `${colors.ink}12`,
    radius: radius.full,
  },
  nav: {
    bg: colors.white,
    border: colors.border,
    logo: colors.ink,
  },
} as const;

// ---------------------------------------------------------------------------
// Export
// ---------------------------------------------------------------------------

const tokens = {
  colors,
  typography,
  spacing,
  radius,
  borderWidth,
  shadows,
  animation,
  components,
} as const;

export default tokens;
