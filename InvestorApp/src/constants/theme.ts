const theme = {
  colors: {
    background: "#FFFFFF",
    surface: "#FFFFFF",
    primary: "#11A36A",       // зелёный из макетов
    text: "#111827",
    white: "#FFFFFF",
    textSecondary: "#6B7280",
    border: "#E5E7EB",

    success: "#11A36A",
    danger: "#EF4444",
    warning: "#F59E0B",
    info: "#3B82F6",

    disabledBg: "#E5E7EB",
    disabledText: "#9CA3AF",
    overlay: "rgba(0,0,0,0.35)",
    link: "#11A36A",
  },

  spacing: { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 },

  radii: { sm: 10, md: 12, lg: 18, xl: 24 },

  typography: {
    sizes: { xs: 12, sm: 14, md: 16, lg: 18, xl: 22, xxl: 28 },
    lineHeights: { sm: 18, md: 22, lg: 26, xl: 30 },
    // families / weights — по тому, что используешь
  },

  sizes: { inputHeight: 48, buttonHeight: 48 },

  shadow: {
    card: {
      ios: { /* shadowColor/shadowOpacity/shadowRadius/shadowOffset */ },
      android: { elevation: 3 },
    },
  },
} as const;


export default theme;