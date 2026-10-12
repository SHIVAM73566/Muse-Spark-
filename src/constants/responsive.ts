/**
 * MuseSpark - Responsive Breakpoints & Layout Tokens
 *
 * Single source of truth for adapting the universal app across:
 *  - Phone   (< 768px)   : full-bleed mobile layout
 *  - Tablet  (768-1023px): centered readable column
 *  - Desktop (>= 1024px) : centered app shell with generous gutters
 */

import { Platform, useWindowDimensions } from 'react-native';

/**
 * Device width breakpoints (in logical pixels).
 */
export const Breakpoints = {
  tablet: 768,
  desktop: 1024,
  wide: 1440,
} as const;

export type DeviceType = 'phone' | 'tablet' | 'desktop';

export interface ResponsiveInfo {
  /** Current viewport width */
  width: number;
  /** Current viewport height */
  height: number;
  /** Coarse device classification */
  device: DeviceType;
  isPhone: boolean;
  isTablet: boolean;
  isDesktop: boolean;
  /** True on wide desktop monitors */
  isWide: boolean;
  /** True when running on the web target */
  isWeb: boolean;
  /**
   * Max width for the centered application shell (header + tab bar + screens).
   * `undefined` means the shell fills the full viewport (phone behavior).
   */
  shellMaxWidth: number | undefined;
  /** Horizontal padding appropriate for the current device */
  gutter: number;
  /** Max width for long-form reading content inside a screen */
  contentMaxWidth: number | undefined;
  /** Ideal number of list/grid columns */
  columns: number;
  /** Subtle type/spacing scale-up for larger displays */
  scale: number;
}

/**
 * Reactively observes viewport size and derives responsive layout tokens.
 */
export function useResponsive(): ResponsiveInfo {
  const { width, height } = useWindowDimensions();

  const isWide = width >= Breakpoints.wide;
  const isDesktop = width >= Breakpoints.desktop;
  const isTablet = width >= Breakpoints.tablet && width < Breakpoints.desktop;
  const isPhone = width < Breakpoints.tablet;

  const device: DeviceType = isDesktop ? 'desktop' : isTablet ? 'tablet' : 'phone';

  const shellMaxWidth = isDesktop ? (isWide ? 1180 : 1040) : isTablet ? 820 : undefined;
  const gutter = isDesktop ? 32 : isTablet ? 24 : 20;
  const contentMaxWidth = isDesktop ? 900 : isTablet ? 720 : undefined;
  const columns = isDesktop ? 3 : isTablet ? 2 : 1;
  const scale = isDesktop ? 1.05 : isTablet ? 1.02 : 1;

  return {
    width,
    height,
    device,
    isPhone,
    isTablet,
    isDesktop,
    isWide,
    isWeb: Platform.OS === 'web',
    shellMaxWidth,
    gutter,
    contentMaxWidth,
    columns,
    scale,
  };
}

export default useResponsive;
