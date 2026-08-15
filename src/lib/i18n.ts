import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import sv from "@/locales/sv.json";
import en from "@/locales/en.json";
import no from "@/locales/no.json";
import da from "@/locales/da.json";
import fi from "@/locales/fi.json";

// Five supported UI languages — see src/locales/*.json for the translation
// resources. "no" covers Norwegian Bokmål (the only Norwegian variant this
// app ships a translation for).
export const SUPPORTED_LANGUAGES = ["sv", "en", "no", "da", "fi"] as const;
export type LanguageCode = (typeof SUPPORTED_LANGUAGES)[number];

export const LANGUAGE_NAMES: Record<LanguageCode, string> = {
  sv: "Svenska",
  en: "English",
  no: "Norsk",
  da: "Dansk",
  fi: "Suomi",
};

const LANG_STORAGE_KEY = "aquafulness:lang:v1";

function isSupportedLanguage(v: string | null): v is LanguageCode {
  return !!v && (SUPPORTED_LANGUAGES as readonly string[]).includes(v);
}

export function loadStoredLanguage(): LanguageCode | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(LANG_STORAGE_KEY);
    return isSupportedLanguage(raw) ? raw : null;
  } catch {
    return null;
  }
}

function storeLanguage(lang: LanguageCode) {
  try {
    window.localStorage.setItem(LANG_STORAGE_KEY, lang);
  } catch {
    /* quota or privacy mode — ignore */
  }
}

// Best-effort match of the browser's locale list (e.g. "nb-NO", "da-DK") to
// one of our five supported languages — "nb"/"nn" both map to "no" since the
// app only ships one Norwegian translation. Falls back to Swedish, the
// app's original language.
export function detectBrowserLanguage(): LanguageCode {
  if (typeof navigator === "undefined") return "sv";
  const candidates =
    navigator.languages && navigator.languages.length ? navigator.languages : [navigator.language];
  for (const raw of candidates) {
    const base = raw.toLowerCase().split("-")[0];
    if (base === "nb" || base === "nn" || base === "no") return "no";
    if (isSupportedLanguage(base)) return base;
  }
  return "sv";
}

// Changes the active language and persists the choice — the one path the
// language switcher UI should use (plain i18n.changeLanguage() would skip
// the localStorage write).
export function changeLanguage(lang: LanguageCode) {
  storeLanguage(lang);
  void i18n.changeLanguage(lang);
}

// Server and the very first client render always use "sv" (the app's
// original language) so hydration never mismatches; a client-only effect in
// routes/index.tsx applies the stored/detected language immediately after
// mount, before the user can interact with anything.
i18n.use(initReactI18next).init({
  resources: {
    sv: { translation: sv },
    en: { translation: en },
    no: { translation: no },
    da: { translation: da },
    fi: { translation: fi },
  },
  lng: "sv",
  fallbackLng: "sv",
  interpolation: { escapeValue: false },
  returnNull: false,
});

if (typeof window !== "undefined") {
  i18n.on("languageChanged", (lng) => {
    document.documentElement.lang = lng === "no" ? "nb" : lng;
  });
}

export default i18n;
