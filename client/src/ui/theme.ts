/**
 * Centralized visual theme — warm, cozy datacenter aesthetic.
 * All React UI components import from here. Single source of truth.
 */

export const THEME = {
  colors: {
    // Backgrounds
    bgDarkest: "#1e1814",
    bgDark: "#2a2118",
    bgPanel: "#302820",
    bgCard: "#3a3028",
    bgCardHover: "#443830",
    bgInput: "#241c14",

    // Text
    text: "#f0e0cc",
    textMuted: "#a08a70",
    textDim: "#706050",
    textInverse: "#1e1814",

    // Accents
    accent: "#e8a840",
    accentDim: "#b08030",
    accentBg: "#3a2a10",

    // Status
    success: "#7ab87a",
    successBg: "#1e2e1a",
    successBorder: "#3a5a30",
    warning: "#d4a040",
    warningBg: "#2e2410",
    warningBorder: "#5a4820",
    danger: "#d4675a",
    dangerBg: "#2e1a16",
    dangerBorder: "#5a2a20",
    info: "#6ab0d4",
    infoBg: "#162430",
    infoBorder: "#2a4a5a",

    // Borders
    border: "#4a3e32",
    borderLight: "#5a4e40",
    borderDark: "#332a20",

    // Device type colors (for UI badges/accents)
    server: "#5a9a60",
    switch: "#5a8aaa",
    router: "#c48a40",
    firewall: "#b85a50",
    cable: "#8a7ab8",

    // Client type badge colors
    startup: "#6ab0d4",
    smb: "#7ab87a",
    enterprise: "#a07ac0",
    bank: "#d4a040",

    // Misc
    purple: "#9a70a8",
    overlay: "rgba(30, 24, 20, 0.85)",
  },

  fonts: {
    heading: "'Nunito', 'Segoe UI', sans-serif",
    body: "'Nunito', 'Segoe UI', sans-serif",
    mono: "'JetBrains Mono', 'Source Code Pro', 'Fira Code', monospace",
  },

  radius: {
    sm: 4,
    md: 6,
    lg: 10,
    xl: 14,
  },

  shadows: {
    card: "0 2px 8px rgba(0,0,0,0.3)",
    panel: "0 4px 16px rgba(0,0,0,0.4)",
    button: "0 1px 4px rgba(0,0,0,0.3)",
    glow: (color: string) => `0 0 12px ${color}40`,
  },
} as const;

/** Helpers for common style patterns */
export function cardStyle(borderColor?: string): React.CSSProperties {
  return {
    padding: "8px 10px",
    background: THEME.colors.bgCard,
    borderRadius: THEME.radius.md,
    borderLeft: borderColor ? `3px solid ${borderColor}` : undefined,
    boxShadow: THEME.shadows.card,
  };
}

export function buttonStyle(
  variant: "primary" | "danger" | "ghost" | "muted" = "primary",
  small = false,
): React.CSSProperties {
  const base: React.CSSProperties = {
    padding: small ? "2px 8px" : "4px 12px",
    border: "none",
    borderRadius: THEME.radius.sm,
    cursor: "pointer",
    fontSize: small ? 9 : 11,
    fontFamily: THEME.fonts.body,
    fontWeight: 600,
    boxShadow: THEME.shadows.button,
    transition: "background 0.15s",
  };

  switch (variant) {
    case "primary":
      return { ...base, background: THEME.colors.success, color: THEME.colors.textInverse };
    case "danger":
      return { ...base, background: THEME.colors.danger, color: "#fff" };
    case "ghost":
      return {
        ...base,
        background: "transparent",
        border: `1px solid ${THEME.colors.border}`,
        color: THEME.colors.textMuted,
        boxShadow: "none",
      };
    case "muted":
      return { ...base, background: THEME.colors.bgCard, color: THEME.colors.textDim, cursor: "default", boxShadow: "none" };
  }
}

export function headingStyle(size: "h3" | "h4" = "h3"): React.CSSProperties {
  return {
    margin: size === "h3" ? "0 0 8px" : "0 0 6px",
    fontSize: size === "h3" ? 14 : 12,
    fontWeight: 700,
    color: THEME.colors.textMuted,
    fontFamily: THEME.fonts.heading,
    letterSpacing: 0.5,
    textTransform: "uppercase" as const,
  };
}

export function inputStyle(): React.CSSProperties {
  return {
    padding: "4px 8px",
    background: THEME.colors.bgInput,
    border: `1px solid ${THEME.colors.border}`,
    borderRadius: THEME.radius.sm,
    color: THEME.colors.text,
    fontSize: 11,
    fontFamily: THEME.fonts.mono,
  };
}

export function statusDot(color: string, size = 6): React.CSSProperties {
  return {
    width: size,
    height: size,
    borderRadius: "50%",
    background: color,
    display: "inline-block",
    flexShrink: 0,
  };
}
