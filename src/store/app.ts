import { create } from 'zustand';
import { en } from '../locales/en';
import { zh } from '../locales/zh';

type Language = 'en' | 'zh';
type Translations = typeof en;

interface AppState {
    language: Language;
    t: Translations;
    setLanguage: (lang: Language) => void;
    toggleLanguage: () => void;
}

export const useAppStore = create<AppState>((set) => ({
    language: 'zh', // Default to Chinese
    t: zh,
    setLanguage: (lang) => set({ language: lang, t: lang === 'en' ? en : zh }),
    toggleLanguage: () => set((state) => {
        const newLang = state.language === 'en' ? 'zh' : 'en';
        return { language: newLang, t: newLang === 'en' ? en : zh };
    }),
}));
