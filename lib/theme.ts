export interface Theme {
  name: 'light' | 'dark';
  bg: string;
  surface: string;
  card: string;
  cardElevated: string;
  text: string;
  textMuted: string;
  textDim: string;
  border: string;
  borderLight: string;
  brand: string;
  brandDark: string;
  brandLight: string;
  brandSurface: string;
  shadow: string;
}

export const lightTheme: Theme = {
  name: 'light',
  bg: '#FFFBF5',
  surface: '#FFFFFF',
  card: '#FFFFFF',
  cardElevated: '#FFFFFF',
  text: '#1A1410',
  textMuted: '#525252',
  textDim: '#737373',
  border: '#E5E5E5',
  borderLight: '#F5F5F5',
  brand: '#F97316',
  brandDark: '#C2410C',
  brandLight: '#FED7AA',
  brandSurface: '#FFF7ED',
  shadow: '#000000',
};

export const darkTheme: Theme = {
  name: 'dark',
  bg: '#0F0D0B',
  surface: '#1A1814',
  card: '#1F1B16',
  cardElevated: '#26201A',
  text: '#FAFAF8',
  textMuted: '#A8A29E',
  textDim: '#78716C',
  border: '#3D352D',
  borderLight: '#2A251F',
  brand: '#FB923C',
  brandDark: '#FDBA74',
  brandLight: '#7C2D12',
  brandSurface: '#1F1813',
  shadow: '#000000',
};

export type ThemeMode = 'light' | 'dark' | 'system';
