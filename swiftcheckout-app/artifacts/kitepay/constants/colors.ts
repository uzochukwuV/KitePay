/**
 * Design tokens — AstraPay-inspired dark theme
 *
 * Primary palette: pure black bg, white text, lime-yellow (#C8FF00) accent
 */
const colors = {
  light: {
    // ── Core ────────────────────────────────────────────────────────────────
    text: "#FFFFFF",
    tint: "#C8FF00",

    background: "#000000",
    foreground: "#FFFFFF",

    // ── Surfaces ─────────────────────────────────────────────────────────────
    card: "#111111",
    cardForeground: "#FFFFFF",
    surface: "#111111",
    surfaceAlt: "#1A1A1A",

    // ── Primary (lime) ───────────────────────────────────────────────────────
    primary: "#C8FF00",
    primaryForeground: "#000000",

    // ── Secondary ───────────────────────────────────────────────────────────
    secondary: "#1A1A1A",
    secondaryForeground: "#FFFFFF",

    // ── Muted ───────────────────────────────────────────────────────────────
    muted: "#1A1A1A",
    mutedForeground: "rgba(255,255,255,0.35)",

    // ── Accent (lime alias) ──────────────────────────────────────────────────
    accent: "#C8FF00",
    accentForeground: "#000000",

    // ── Semantic ─────────────────────────────────────────────────────────────
    destructive: "#FF4444",
    destructiveForeground: "#FFFFFF",
    success: "#00D4A0",
    successForeground: "#000000",
    warning: "#FFB800",
    warningForeground: "#000000",

    // ── Text variants ────────────────────────────────────────────────────────
    textSecondary: "rgba(255,255,255,0.55)",
    textMuted: "rgba(255,255,255,0.30)",

    // ── Borders / Inputs ─────────────────────────────────────────────────────
    border: "rgba(255,255,255,0.08)",
    borderStrong: "rgba(255,255,255,0.15)",
    input: "rgba(255,255,255,0.08)",

    // ── Action colours ───────────────────────────────────────────────────────
    blue: "#3B82F6",
    purple: "#A855F7",

    // ── Legacy gradients (kept for backward compat) ──────────────────────────
    gradientStart: "#000000",
    gradientMid: "#0A0A0A",
    gradientEnd: "#111111",
  },

  radius: 16,
};

export default colors;
