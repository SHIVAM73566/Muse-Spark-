/**
 * ContentColumn Component
 *
 * Centers screen content within a readable max-width column on tablet and
 * desktop while remaining full-bleed on phones. Uses the shared responsive
 * breakpoints so every screen stays visually consistent.
 */

import React from 'react';
import { View, StyleSheet, StyleProp, ViewStyle } from 'react-native';
import { useResponsive } from '@/constants/responsive';

export interface ContentColumnProps {
  children: React.ReactNode;
  /** Extra style merged onto the column */
  style?: StyleProp<ViewStyle>;
  /** Override the auto-computed responsive max width */
  maxWidth?: number;
  /** Optional extra horizontal padding applied inside the column */
  gutter?: number;
}

export const ContentColumn: React.FC<ContentColumnProps> = ({
  children,
  style,
  maxWidth,
  gutter,
}) => {
  const responsive = useResponsive();
  const resolvedMaxWidth = maxWidth ?? responsive.contentMaxWidth;

  return (
    <View
      style={[
        styles.base,
        gutter !== undefined ? { paddingHorizontal: gutter } : null,
        resolvedMaxWidth ? { maxWidth: resolvedMaxWidth } : null,
        style,
      ]}>
      {children}
    </View>
  );
};

const styles = StyleSheet.create({
  base: {
    width: '100%',
    alignSelf: 'center',
  },
});

export default ContentColumn;
