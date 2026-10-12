import { Colors } from '@/constants/colors';

export const BRAND = {
  name: 'MuseSpark',
  nameParts: {
    first: 'Muse',
    second: 'Spark',
  },
  tagline: 'Turn ideas into momentum.',
  colors: {
    primary: Colors.brandGold,
    primaryDark: Colors.brandOrange,
    background: Colors.brandNavy,
    textPrimary: Colors.brandTextPrimary,
    textSecondary: Colors.brandGold,
  },
  logo: require('../../assets/images/musespark-logo.png'),
} as const;

export default BRAND;
