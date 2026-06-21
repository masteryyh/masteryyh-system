import { useMemo } from "react";
import { toast } from "sonner";

import { useTranslation } from "@/hooks/use-translation";
import { normalizeError, AppError } from "@/lib/errors";

export interface NotifyApi {
    /** 立即弹一条错误 toast；自动 normalize 任意捕获到的异常。 */
    error: (
        error: unknown,
        options?: { description?: string; titleKey?: string },
    ) => void;
    /** 立即弹一条成功 toast，标题走 i18n key。 */
    success: (
        messageKey: string,
        options?: {
            description?: string;
            params?: Record<string, string | number>;
        },
    ) => void;
    /**
     * 仅把任意异常翻译成 {@code { messageKey, text }}，调用方自行决定如何展示
     * （如塞进表单内的 inline 错误条）。
     */
    describe: (error: unknown) => {
        messageKey: string;
        text: string;
        error: AppError;
    };
}

/**
 * 应用内唯一的错误/反馈通知入口；与 sonner toast 集成。
 *
 * 使用约定：
 * - 表单提交失败 / 页面加载失败 → 用 {@link describe} 拿到中文文案塞进 inline banner；
 * - 异步副作用（创建/删除成功、复制失败等）→ 直接 {@link error} / {@link success} 弹 toast。
 */
export function useNotify(): NotifyApi {
    const { t } = useTranslation();

    return useMemo(
        () => ({
            error: (error, options) => {
                const err = normalizeError(error);
                const title = options?.titleKey
                    ? t(options.titleKey, undefined, err.fallbackMessage)
                    : t(err.messageKey, undefined, err.fallbackMessage);
                toast.error(title, {
                    description: options?.description,
                });
            },
            success: (messageKey, options) => {
                toast.success(t(messageKey, options?.params), {
                    description: options?.description,
                });
            },
            describe: (error) => {
                const err = normalizeError(error);
                return {
                    messageKey: err.messageKey,
                    text: t(err.messageKey, undefined, err.fallbackMessage),
                    error: err,
                };
            },
        }),
        [t],
    );
}
