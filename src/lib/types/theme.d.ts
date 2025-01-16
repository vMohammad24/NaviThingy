
export interface ThemeColors {
    primary: string;
    secondary: string;
    background: string;
    surface: string;
    text: string;
    textSecondary: string;
}

export interface Theme {
    id: string;
    name: string;
    colors: ThemeColors;
}