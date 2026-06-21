/**
 * 统一前后端错误模型。
 *
 * - {@link AppError.messageKey} 总是带值；当无法解析具体业务错误时使用 {@code "error.unknown"} 之类的通用 key。
 * - {@link AppError.fallbackMessage} 是开发者可读的英文/中文兜底文案；当前端 i18n 未匹配 key 时直接展示。
 * - {@link AppError.code} 对应后端 HTTP 状态或业务 code；前端无来源时使用 {@code 0}。
 */
export class AppError extends Error {
    public readonly code: number;
    public readonly messageKey: string;
    public readonly fallbackMessage: string;
    public readonly cause?: unknown;

    constructor(
        code: number,
        messageKey: string,
        fallbackMessage?: string,
        cause?: unknown,
    ) {
        super(fallbackMessage ?? messageKey);
        this.name = "AppError";
        this.code = code;
        this.messageKey = messageKey;
        this.fallbackMessage = fallbackMessage ?? messageKey;
        this.cause = cause;
    }
}

/**
 * 把任意捕获到的异常规整为 {@link AppError}：
 *
 * - 已经是 {@link AppError} 的原样返回；
 * - {@link TypeError}（fetch 网络失败）映射为 {@code error.network}；
 * - 其它 {@link Error} 与未知类型映射为 {@code error.unknown}。
 */
export function normalizeError(error: unknown): AppError {
    if (error instanceof AppError) {
        return error;
    }
    if (error instanceof TypeError) {
        return new AppError(0, "error.network", error.message, error);
    }
    if (error instanceof Error) {
        return new AppError(0, "error.unknown", error.message, error);
    }
    return new AppError(0, "error.unknown", String(error));
}
