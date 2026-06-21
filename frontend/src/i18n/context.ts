import { createContext } from "react";

import {
    type Locale,
    type Messages,
    defaultLocale,
    getMessages,
} from "@/i18n";

export interface I18nContextValue {
    locale: Locale;
    messages: Messages;
    setLocale: (locale: Locale) => void;
}

export const I18nContext = createContext<I18nContextValue>({
    locale: defaultLocale,
    messages: getMessages(defaultLocale),
    setLocale: () => {},
});
