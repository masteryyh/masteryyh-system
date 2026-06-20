import type { PagedResponse } from "@/types/api";

interface ApiEnvelope<T> {
    code?: number;
    message?: string;
    data?: T;
}

interface RequestContext {
    token?: string;
    onUnauthorized?: () => void;
}

export class ApiError extends Error {
    public readonly code?: number;

    constructor(
        message: string,
        code?: number,
    ) {
        super(message);
        this.name = "ApiError";
        this.code = code;
    }
}

function isEnvelope<T>(payload: unknown): payload is ApiEnvelope<T> {
    return (
        typeof payload === "object" &&
        payload !== null &&
        "code" in payload &&
        typeof payload.code === "number"
    );
}

export function requirePagedResponse<T>(
    value: unknown,
    resourceName: string,
): PagedResponse<T> {
    if (
        typeof value !== "object" ||
        value === null ||
        !("data" in value) ||
        !Array.isArray(value.data) ||
        !("page" in value) ||
        typeof value.page !== "number" ||
        !("pageSize" in value) ||
        typeof value.pageSize !== "number" ||
        !("totalPages" in value) ||
        typeof value.totalPages !== "number" ||
        !("totalData" in value) ||
        typeof value.totalData !== "number"
    ) {
        throw new ApiError(`${resourceName}分页响应格式不正确`);
    }

    return value as PagedResponse<T>;
}

export async function apiRequest<T>(
    path: string,
    options: RequestInit = {},
    context: RequestContext = {},
): Promise<T> {
    const headers = new Headers(options.headers);

    if (options.body && !headers.has("Content-Type")) {
        headers.set("Content-Type", "application/json");
    }
    if (context.token) {
        headers.set("Authorization", `Bearer ${context.token}`);
    }

    const response = await fetch(path, { ...options, headers });
    const contentType = response.headers.get("content-type") ?? "";
    const payload = contentType.includes("application/json")
        ? ((await response.json()) as unknown)
        : undefined;
    const envelope = isEnvelope<T>(payload) ? payload : undefined;
    const code = envelope?.code ?? response.status;

    if (response.status === 401 || code === 401) {
        context.onUnauthorized?.();
        throw new ApiError(envelope?.message || "登录状态已失效", 401);
    }

    if (!response.ok || code >= 400) {
        throw new ApiError(
            envelope?.message || `请求失败（${response.status}）`,
            code,
        );
    }

    return (envelope ? envelope.data : payload) as T;
}

export function toQuery(
    values: Record<string, string | number | undefined>,
): string {
    const params = new URLSearchParams();
    Object.entries(values).forEach(([key, value]) => {
        if (value !== undefined) {
            params.set(key, String(value));
        }
    });
    return params.toString();
}
