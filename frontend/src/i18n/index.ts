import enUS from "@/i18n/messages/en-US.json";
import zhCN from "@/i18n/messages/zh-CN.json";

export type Locale = "zh-CN" | "en-US";

export type Messages = Record<string, unknown>;

export const defaultLocale: Locale = "zh-CN";

export const availableLocales: readonly Locale[] = ["zh-CN", "en-US"] as const;

const dictionaries: Record<Locale, Messages> = {
    "zh-CN": zhCN as Messages,
    "en-US": enUS as Messages,
};

export function getMessages(locale: Locale): Messages {
    return dictionaries[locale] ?? dictionaries[defaultLocale];
}

/**
 * 按点号路径在嵌套 JSON 里查找一条翻译；找不到时返回 fallback 或 key 本身。
 * 支持 {@code {paramName}} 形式的参数插值。
 *
 * @example
 *   t(messages, "credentials.success.created"); // "凭据已创建"
 *   t(messages, "home.title", { username: "admin" });
 */
export function lookupMessage(
    messages: Messages,
    key: string,
    params?: Record<string, string | number>,
    fallback?: string,
): string {
    const segments = key.split(".");
    let cursor: unknown = messages;
    for (const segment of segments) {
        if (typeof cursor !== "object" || cursor === null) {
            return interpolate(fallback ?? key, params);
        }
        cursor = (cursor as Record<string, unknown>)[segment];
    }
    if (typeof cursor !== "string") {
        return interpolate(fallback ?? key, params);
    }
    return interpolate(cursor, params);
}

function interpolate(
    template: string,
    params?: Record<string, string | number>,
): string {
    if (!params) return template;
    return template.replace(/\{(\w+)\}/g, (_, name) => {
        const value = params[name];
        return value === undefined ? `{${name}}` : String(value);
    });
}
