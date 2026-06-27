const backendBaseUrl = normalizeBackendBaseUrl(import.meta.env.VITE_BACKEND_URL);

export function backendHttpUrl(path: string): string {
    const normalizedPath = normalizePath(path);
    return backendBaseUrl ? `${backendBaseUrl}${normalizedPath}` : normalizedPath;
}

export function backendWebSocketUrl(path: string, params: URLSearchParams): string {
    const normalizedPath = normalizePath(path);
    const url = backendBaseUrl
        ? new URL(`${backendBaseUrl}${normalizedPath}`)
        : new URL(normalizedPath, window.location.origin);
    url.protocol = url.protocol === "https:" ? "wss:" : "ws:";
    url.search = params.toString();
    return url.toString();
}

function normalizeBackendBaseUrl(value: string | undefined): string {
    return (value ?? "").trim().replace(/\/+$/, "");
}

function normalizePath(path: string): string {
    return path.startsWith("/") ? path : `/${path}`;
}
