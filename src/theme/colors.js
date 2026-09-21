export const COLORS = {
  // Primary Palette
  primary: {
    darkest: "#072D59",
    dark: "#0F4C81",
    main: "#19A7FF",
    light: "#E3F7FF",
    lighter: "#F0FBFF",
  },

  // Semantic Colors
  success: "#20C997",
  warning: "#FFB020",
  danger: "#FF5A5F",

  // Neutral
  background: "#F5F7FB",
  surface: "#FFFFFF",
  surfaceSecondary: "#F8FAFC",

  // Text
  text: {
    primary: "#0C1930",
    secondary: "#5A6B7D",
    tertiary: "#8A9AB0",
    muted: "#71809B",
  },

  // Borders
  border: "#E6ECF4",
  borderLight: "#F0F4F8",

  // Dark Mode
  dark: {
    surface: "#1A1D2E",
    background: "#0F1419",
    text: "#FFFFFF",
    textSecondary: "#A8B0BF",
    border: "#2A3142",
  },

  // Status
  status: {
    upcoming: {
      bg: "#FFF4E2",
      text: "#D98708",
    },
    inProgress: {
      bg: "#E3F7FC",
      text: "#078BA9",
    },
    completed: {
      bg: "#E7F8EF",
      text: "#168B54",
    },
    cancelled: {
      bg: "#FDECEE",
      text: "#D9424C",
    },
  },

  // Legacy support
  navy900: "#061A33",
  navy800: "#092B53",
  navy700: "#0E3D72",
  blue500: "#2688E8",
  cyan400: "#3EC9F5",
  orange500: "#FFA617",
  green500: "#30C88A",
  red500: "#F04E57",
  white: "#FFFFFF",
};

export const DARK_COLORS = {
  ...COLORS,
  background: COLORS.dark.background,
  surface: COLORS.dark.surface,
  text: {
    primary: COLORS.dark.text,
    secondary: COLORS.dark.textSecondary,
    tertiary: COLORS.dark.textSecondary,
    muted: COLORS.dark.textSecondary,
  },
  border: COLORS.dark.border,
};
