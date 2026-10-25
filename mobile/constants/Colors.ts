/**
 * Design Tokens for Diabetic Retinopathy Application
 * Confirmed Palette: Clinical Teal & Midnight Slate Navy
 */

export const SeverityColors = {
  grade0: {
    badgeBg: "#ECFDF5",
    badgeBorder: "#A7F3D0",
    text: "#047857",
    indicator: "#10B981",
    label: "No Diabetic Retinopathy",
  },
  grade1: {
    badgeBg: "#F0FDFA",
    badgeBorder: "#99F6E4",
    text: "#0F766E",
    indicator: "#14B8A6",
    label: "Mild NPDR",
  },
  grade2: {
    badgeBg: "#FFFBEB",
    badgeBorder: "#FDE68A",
    text: "#B45309",
    indicator: "#F59E0B",
    label: "Moderate NPDR",
  },
  grade3: {
    badgeBg: "#FFF7ED",
    badgeBorder: "#FED7AA",
    text: "#C2410C",
    indicator: "#EA580C",
    label: "Severe NPDR",
  },
  grade4: {
    badgeBg: "#FEF2F2",
    badgeBorder: "#FECACA",
    text: "#B91C1C",
    indicator: "#DC2626",
    label: "Proliferative DR",
  },
};

export default {
  light: {
    primary: "#007A87",
    primaryHover: "#006670",
    secondary: "#0F1E36",
    accent: "#00B4D8",
    background: "#F4F8FA",
    surface: "#FFFFFF",
    surfaceSubtle: "#F8FAFC",
    cardBorder: "#E2E8F0",
    text: "#0B1A2C",
    textMuted: "#5A6E85",
    tint: "#007A87",
    tabIconDefault: "#94A3B8",
    tabIconSelected: "#007A87",
    headerBackground: "#FFFFFF",
    border: "#E2E8F0",
    error: "#DC2626",
    success: "#10B981",
    warning: "#F59E0B",
  },
  dark: {
    primary: "#20B2AA",
    primaryHover: "#007A87",
    secondary: "#0F1E36",
    accent: "#38BDF8",
    background: "#0A111E",
    surface: "#111C2E",
    surfaceSubtle: "#162238",
    cardBorder: "#1E2D44",
    text: "#F1F5F9",
    textMuted: "#94A3B8",
    tint: "#20B2AA",
    tabIconDefault: "#64748B",
    tabIconSelected: "#20B2AA",
    headerBackground: "#111C2E",
    border: "#1E2D44",
    error: "#F87171",
    success: "#34D399",
    warning: "#FBBF24",
  },
};
