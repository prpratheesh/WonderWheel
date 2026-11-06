import type { ThemeId } from '../types/wheel';

export interface Theme {
  id: ThemeId;
  name: string;
  palette: string[];
  bgFrom: string;
  bgTo: string;
  border: string;
  pointer: string;
  hub: string;
  separator: string;
  /** Accent used for UI highlights on the wheel screen. */
  accent: string;
}

export const THEMES: Record<ThemeId, Theme> = {
  rainbow: {
    id: 'rainbow',
    name: 'Rainbow',
    palette: ['#FF4D6D', '#FF9F1C', '#FFD23F', '#06D6A0', '#2EC4B6', '#3A86FF', '#8338EC', '#FF5DA2'],
    bgFrom: '#4338ca',
    bgTo: '#c026d3',
    border: '#FFD166',
    pointer: '#FF3B5C',
    hub: '#5B21B6',
    separator: '#ffffff',
    accent: '#FFD166',
  },
  pastel: {
    id: 'pastel',
    name: 'Pastel',
    palette: ['#FFADAD', '#FFD6A5', '#FDFFB6', '#CAFFBF', '#9BF6FF', '#A0C4FF', '#BDB2FF', '#FFC6FF'],
    bgFrom: '#818cf8',
    bgTo: '#f472b6',
    border: '#ffffff',
    pointer: '#7C3AED',
    hub: '#A78BFA',
    separator: '#ffffff',
    accent: '#ffffff',
  },
  ocean: {
    id: 'ocean',
    name: 'Ocean',
    palette: ['#0077B6', '#00B4D8', '#023E8A', '#48CAE4', '#0096C7', '#90E0EF', '#03045E', '#00A6A6'],
    bgFrom: '#0c4a6e',
    bgTo: '#0891b2',
    border: '#E0F7FF',
    pointer: '#FF7B54',
    hub: '#03045E',
    separator: '#E0F7FF',
    accent: '#7DD3FC',
  },
  candy: {
    id: 'candy',
    name: 'Candy',
    palette: ['#FF5FA2', '#B388FF', '#7CF5FF', '#FFE066', '#FF9EBB', '#A0F0C0', '#FF7AC6', '#C3B1FF'],
    bgFrom: '#ec4899',
    bgTo: '#8b5cf6',
    border: '#FFF0F8',
    pointer: '#FF2E88',
    hub: '#DB2777',
    separator: '#ffffff',
    accent: '#FFE066',
  },
  space: {
    id: 'space',
    name: 'Space',
    palette: ['#7209B7', '#3A0CA3', '#4361EE', '#4CC9F0', '#F72585', '#560BAD', '#4895EF', '#B5179E'],
    bgFrom: '#0b0420',
    bgTo: '#1e1b4b',
    border: '#C7D2FE',
    pointer: '#FDE047',
    hub: '#1E1B4B',
    separator: '#E0E7FF',
    accent: '#FDE047',
  },
  classroom: {
    id: 'classroom',
    name: 'Classroom',
    palette: ['#E63946', '#F4A261', '#2A9D8F', '#E9C46A', '#457B9D', '#8AB17D', '#F28482', '#264653'],
    bgFrom: '#14532d',
    bgTo: '#166534',
    border: '#B07842',
    pointer: '#FFFFFF',
    hub: '#7C4A1E',
    separator: '#FFF8E7',
    accent: '#FDE68A',
  },
  custom: {
    id: 'custom',
    name: 'Custom',
    palette: ['#FF4D6D', '#FF9F1C', '#FFD23F', '#06D6A0', '#3A86FF', '#8338EC'],
    bgFrom: '#334155',
    bgTo: '#6d28d9',
    border: '#FFFFFF',
    pointer: '#FF3B5C',
    hub: '#334155',
    separator: '#ffffff',
    accent: '#FFD166',
  },
};

export const THEME_LIST: Theme[] = Object.values(THEMES);

export function getTheme(id: ThemeId): Theme {
  return THEMES[id] ?? THEMES.rainbow;
}

