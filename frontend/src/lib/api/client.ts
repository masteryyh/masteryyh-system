import { AppError } from "@/lib/errors";
import type { PagedResponse } from "@/types/api";

/**
 * 后端 {@code GenericResponse} 的统一外层结构。
 */
interface ApiEnvelope<T> {
    code?: number;
    message?: string;
    messageKey?: string | null;
    data?: T;
}

export interface ApiClientContext {
    /** 访问令牌；空串等同于未登录 */
    token?: string;
    /** 收到 401 时的回调（一般是 logout + 跳登录页） */
    onUnauthorized?: () => void;
}

/**
 * 基础 HTTP 客户端：所有按业务域划分的 Api class 都通过它发出请求。
 *
 * - 自动注入 {@code Authorization: Bearer <token>}（context.token 非空时）；
 * - 自动给 JSON body 加 {@code Content-Type: application/json}；
 * - 解析后端 {@code GenericResponse} 外层，统一抛出 {@link AppError}；
 * - 401 时调用 {@code context.onUnauthorized?.()} 再抛错；
 * - {@link requestPaged} 内部做分页 envelope 形状校验。
 */
export class BaseApiClient {
    private readonly context: ApiClientContext;

    constructor(context: ApiClientContext = {}) {
        this.context = context;
    }

    /**
     * 拼装 path + query；undefined 值自动跳过。
     */
    url(
        path: string,
        query?: Record<string, string | number | undefined>,
    ): string {
        if (!query) return path;
        const params = new URLSearchParams();
        Object.entries(query).forEach(([key, value]) => {
            if (value !== undefined) {
                params.set(key, String(value));
            }
        });
        const qs = params.toString();
        return qs ? `${path}?${qs}` : path;
    }

    async request<T>(path: string, init: RequestInit = {}): Promise<T> {
        const headers = new Headers(init.headers);
        if (
            init.body &&
            !(init.body instanceof FormData) &&
            !headers.has("Content-Type")
        ) {
            headers.set("Content-Type", "application/json");
        }
        if (this.context.token) {
            headers.set("Authorization", `Bearer ${this.context.token}`);
        }

        let response: Response;
        try {
            response = await fetch(path, { ...init, headers });
        } catch (error) {
            throw new AppError(
                0,
                "error.network",
                error instanceof Error ? error.message : String(error),
                error,
            );
        }

        const contentType = response.headers.get("content-type") ?? "";
        const payload = contentType.includes("application/json")
            ? ((await response.json().catch(() => undefined)) as unknown)
            : undefined;

        const envelope = isEnvelope<T>(payload) ? payload : undefined;
        const code = envelope?.code ?? response.status;

        if (response.status === 401 || code === 401) {
            this.context.onUnauthorized?.();
            throw new AppError(
                401,
                envelope?.messageKey ?? "error.unauthorized",
                envelope?.message ?? "Login session expired",
            );
        }

        if (!response.ok || code >= 400) {
            throw new AppError(
                code,
                envelope?.messageKey ?? "error.unknown",
                envelope?.message ?? `Request failed (${response.status})`,
            );
        }

        return (envelope ? envelope.data : payload) as T;
    }

    async download(path: string): Promise<Blob> {
        const headers = new Headers();
        if (this.context.token) {
            headers.set("Authorization", `Bearer ${this.context.token}`);
        }
        const response = await fetch(path, { headers });
        if (response.status === 401) {
            this.context.onUnauthorized?.();
            throw new AppError(401, "error.unauthorized", "Login session expired");
        }
        if (!response.ok) {
            throw new AppError(
                response.status,
                "error.unknown",
                `Download failed (${response.status})`,
            );
        }
        return response.blob();
    }

    /**
     * 校验响应是后端 {@code PagedResponse} 形状；不符抛 {@code error.envelopeMalformed}。
     */
    async requestPaged<T>(
        path: string,
        init: RequestInit = {},
    ): Promise<PagedResponse<T>> {
        const value = await this.request<unknown>(path, init);
        if (
            typeof value !== "object" ||
            value === null ||
            !("data" in value) ||
            !Array.isArray((value as { data: unknown }).data) ||
            !("page" in value) ||
            typeof (value as { page: unknown }).page !== "number" ||
            !("pageSize" in value) ||
            typeof (value as { pageSize: unknown }).pageSize !== "number" ||
            !("totalPages" in value) ||
            typeof (value as { totalPages: unknown }).totalPages !== "number" ||
            !("totalData" in value) ||
            typeof (value as { totalData: unknown }).totalData !== "number"
        ) {
            throw new AppError(
                0,
                "error.envelopeMalformed",
                "Paginated response shape mismatched",
            );
        }
        return value as PagedResponse<T>;
    }
}

function isEnvelope<T>(payload: unknown): payload is ApiEnvelope<T> {
    return (
        typeof payload === "object" &&
        payload !== null &&
        "code" in payload &&
        typeof (payload as { code: unknown }).code === "number"
    );
}
