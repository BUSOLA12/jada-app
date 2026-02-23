import { Dimensions } from 'react-native';

export const COLORS = {
  // Primary brand colors
  primary: '#0D5C4C', // Dark teal/green
  primaryLight: '#E8F5E9',
  secondary: '#FFA726', // Orange
  accent: '#FFB74D',
  
  // Background colors
  background: '#FFFFFF',
  backgroundSecondary: '#F5F5F5',
  cardBackground: '#FFFFFF',
  
  // Text colors
  text: '#1A1A1A',
  textSecondary: '#666666',
  textLight: '#999999',
  
  // UI colors
  border: '#E0E0E0',
  error: '#E74C3C',
  success: '#4CAF50',
  warning: '#FFA726',
  
  // Standard colors
  white: '#FFFFFF',
  black: '#000000',
  gray: '#95A5A6',
  lightGray: '#F5F5F5',
  
  // Brand specific
  orange: '#FF9800',
  yellow: '#F4CF6F',
  teal: '#0D5C4C',
};

export const SIZES = {
  width: Dimensions.get('window').width,
  height: Dimensions.get('window').height,
  padding: 20,
  radius: 12,
  radiusLarge: 20,
  buttonHeight: 56,
};

export const FONTS = {
  regular: 'System',
  medium: 'System',
  bold: 'System',
  sizes: {
    tiny: 10,
    small: 12,
    medium: 14,
    regular: 16,
    large: 18,
    xlarge: 22,
    xxlarge: 28,
    huge: 34,
  },
};

export const SHADOWS = {
  small: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  medium: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 4,
  },
  large: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.2,
    shadowRadius: 16,
    elevation: 8,
  },
};