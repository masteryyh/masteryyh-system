import { useCallback, useMemo, useState, type ReactNode } from "react";

import { I18nContext } from "@/i18n/context";
import {
    availableLocales,
    defaultLocale,
    getMessages,
    type Locale,
} from "@/i18n";

const STORAGE_KEY = "masteryyh-system.locale";

function readPersistedLocale(): Locale {
    if (typeof window === "undefined") return defaultLocale;
    try {
        const raw = window.localStorage.getItem(STORAGE_KEY);
        if (raw && (availableLocales as readonly string[]).includes(raw)) {
            return raw as Locale;
        }
    } catch {
        // ignore storage errors (privacy mode etc.)
    }
    return defaultLocale;
}

export function I18nProvider({ children }: { children: ReactNode }) {
    const [locale, setLocaleState] = useState<Locale>(() =>
        readPersistedLocale(),
    );

    const setLocale = useCallback((next: Locale) => {
        setLocaleState(next);
        try {
            window.localStorage.setItem(STORAGE_KEY, next);
        } catch {
            // ignore
        }
    }, []);

    const value = useMemo(
        () => ({
            locale,
            messages: getMessages(locale),
            setLocale,
        }),
        [locale, setLocale],
    );

    return (
        <I18nContext.Provider value={value}>{children}</I18nContext.Provider>
    );
}
