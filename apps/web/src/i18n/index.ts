import i18next from "i18next";
import { initReactI18next } from "react-i18next";
import en from "./locales/en.json";
import ar from "./locales/ar.json";

export type Language = "en" | "ar";

const STORAGE_KEY = "teriac:lang";

const initialLang: Language =
  (typeof window !== "undefined" && (localStorage.getItem(STORAGE_KEY) as Language)) ||
  (import.meta.env.VITE_DEFAULT_LOCALE as Language) ||
  "en";

void i18next.use(initReactI18next).init({
  resources: {
    en: { translation: en },
    ar: { translation: ar },
  },
  lng: initialLang,
  fallbackLng: "en",
  interpolation: { escapeValue: false },
  returnNull: false,
});

applyDirection(initialLang);

export const i18n = i18next;

export function getCurrentLanguage(): Language {
  return (i18next.language as Language) || "en";
}

export function setLanguage(lang: Language): void {
  void i18next.changeLanguage(lang);
  localStorage.setItem(STORAGE_KEY, lang);
  applyDirection(lang);
}

function applyDirection(lang: Language): void {
  if (typeof document === "undefined") return;
  document.documentElement.lang = lang;
  document.documentElement.dir = lang === "ar" ? "rtl" : "ltr";
}
