import { useContext, useMemo } from "react";

import { I18nContext } from "@/i18n/context";
import { lookupMessage, type Locale } from "@/i18n";

export interface Translator {
    /** 按 key 查翻译；缺失时回退到 {@code fallback} 或 key 自身。 */
    t: (
        key: string,
        params?: Record<string, string | number>,
        fallback?: string,
    ) => string;
    locale: Locale;
    setLocale: (locale: Locale) => void;
}

export function useTranslation(): Translator {
    const { locale, messages, setLocale } = useContext(I18nContext);

    return useMemo(
        () => ({
            locale,
            setLocale,
            t: (key, params, fallback) =>
                lookupMessage(messages, key, params, fallback),
        }),
        [locale, messages, setLocale],
    );
}
