import { moderateScale, verticalScale } from "react-native-size-matters";
export { COLORS } from "./colors";

export const SPACING = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  xxxl: 32,
};

export const TYPOGRAPHY = {
  h1: {
    fontSize: moderateScale(32),
    fontWeight: "900",
    lineHeight: moderateScale(40),
  },
  h2: {
    fontSize: moderateScale(28),
    fontWeight: "900",
    lineHeight: moderateScale(36),
  },
  h3: {
    fontSize: moderateScale(24),
    fontWeight: "800",
    lineHeight: moderateScale(32),
  },
  h4: {
    fontSize: moderateScale(20),
    fontWeight: "800",
    lineHeight: moderateScale(28),
  },
  h5: {
    fontSize: moderateScale(18),
    fontWeight: "700",
    lineHeight: moderateScale(26),
  },
  body1: {
    fontSize: moderateScale(16),
    fontWeight: "500",
    lineHeight: moderateScale(24),
  },
  body2: {
    fontSize: moderateScale(14),
    fontWeight: "500",
    lineHeight: moderateScale(21),
  },
  label: {
    fontSize: moderateScale(12),
    fontWeight: "600",
    lineHeight: moderateScale(18),
  },
  caption: {
    fontSize: moderateScale(11),
    fontWeight: "500",
    lineHeight: moderateScale(16),
  },
  xs: {
    fontSize: moderateScale(10),
    fontWeight: "600",
    lineHeight: moderateScale(14),
  },
};

export const RADIUS = {
  sm: 12,
  md: 16,
  lg: 20,
  xl: 24,
  full: 9999,
};

export const SHADOWS = {
  sm: {
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 2,
  },
  md: {
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 4,
  },
  lg: {
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.12,
    shadowRadius: 18,
    elevation: 6,
  },
};

export const DURATION = {
  fast: 200,
  normal: 350,
  slow: 500,
};
