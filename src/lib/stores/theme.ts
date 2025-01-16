import { writable } from 'svelte/store';
import type { Theme } from '../types/theme';

const defaultThemes: Theme[] = [
    {
        id: 'catppuccin-frappe',
        name: 'Catppuccin Frappé',
        colors: {
            primary: '#8caaee',
            secondary: '#a6d189',
            background: '#303446',
            surface: '#414559',
            text: '#c6d0f5',
            textSecondary: '#b5bfe2'
        }
    },
    {
        id: 'catppuccin-macchiato',
        name: 'Catppuccin Macchiato',
        colors: {
            primary: '#8aadf4',
            secondary: '#a6da95',
            background: '#24273a',
            surface: '#363a4f',
            text: '#cad3f5',
            textSecondary: '#b8c0e0'
        }
    },
    {
        id: 'catppuccin-mocha',
        name: 'Catppuccin Mocha',
        colors: {
            primary: '#89b4fa',
            secondary: '#a6e3a1',
            background: '#1e1e2e',
            surface: '#313244',
            text: '#cdd6f4',
            textSecondary: '#bac2de'
        }
    },
    {
        id: 'catppuccin-latte',
        name: 'Catppuccin Latte',
        colors: {
            primary: '#1e66f5',
            secondary: '#40a02b',
            background: '#eff1f5',
            surface: '#ccd0da',
            text: '#4c4f69',
            textSecondary: '#5c5f77'
        }
    }
];

const key = 'selected_theme';
const customKey = 'custom_themes';

function createThemeStore() {
    const stored = typeof localStorage !== 'undefined'
        ? localStorage.getItem(key) || 'default'
        : 'default';

    const { subscribe, set } = writable<string>(stored);

    const storedCustomThemes = typeof localStorage !== 'undefined'
        ? JSON.parse(localStorage.getItem(customKey) || '[]')
        : [];

    let customThemes = storedCustomThemes;

    return {
        subscribe,
        setTheme: (themeId: string) => {
            localStorage.setItem(key, themeId);
            set(themeId);
        },
        addTheme: (newTheme: Theme) => {
            customThemes = [...customThemes, newTheme];
            localStorage.setItem(customKey, JSON.stringify(customThemes));
        },
        removeTheme: (themeId: string) => {
            customThemes = customThemes.filter((t: Theme) => t.id !== themeId);
            localStorage.setItem(customKey, JSON.stringify(customThemes));
        },
        get themes() {
            return [...defaultThemes, ...customThemes];
        }
    };
}

export const theme = createThemeStore();