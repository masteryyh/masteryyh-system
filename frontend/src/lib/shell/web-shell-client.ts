import { backendWebSocketUrl } from "@/lib/backend-url";

/**
 * WebShell WebSocket 客户端。
 *
 * 浏览器原生 WebSocket 无法携带 Authorization 头，token 通过查询参数 ?token=<jwt> 传入，
 * 由后端 WebShellHandshakeAuthInterceptor 在握手阶段校验。
 *
 * 协议：
 * - 服务端 → 客户端：shell 输出走二进制帧（原始字节，前端直接喂给 xterm）；控制消息
 *   （closed/error）走文本 JSON 帧。
 * - 客户端 → 服务端：统一文本 JSON 帧（input/resize）。
 */
export type ShellControlMessage = {
    type: "closed";
    reason?: string;
} | {
    type: "error";
    message?: string;
};

export interface WebShellClientOptions {
    platformId: string;
    token: string;
    cols: number;
    rows: number;
    onData: (data: Uint8Array) => void;
    onControl: (msg: ShellControlMessage) => void;
    onOpen: () => void;
    onClose: () => void;
    onError: (event: Event) => void;
}

export class WebShellClient {
    private ws: WebSocket | null = null;
    private readonly opts: WebShellClientOptions;

    constructor(opts: WebShellClientOptions) {
        this.opts = opts;
    }

    connect(): void {
        const url = buildWsUrl(
            this.opts.platformId,
            this.opts.token,
            this.opts.cols,
            this.opts.rows,
        );
        const ws = new WebSocket(url);
        ws.binaryType = "arraybuffer";
        this.ws = ws;
        ws.onopen = () => this.opts.onOpen();
        ws.onclose = () => this.opts.onClose();
        ws.onerror = (event) => this.opts.onError(event);
        ws.onmessage = (event) => this.handleMessage(event);
    }

    private handleMessage(event: MessageEvent): void {
        if (event.data instanceof ArrayBuffer) {
            this.opts.onData(new Uint8Array(event.data));
            return;
        }
        if (typeof event.data === "string") {
            try {
                const msg = JSON.parse(event.data) as ShellControlMessage;
                if (msg.type === "closed" || msg.type === "error") {
                    this.opts.onControl(msg);
                }
            } catch {
                // 忽略无法解析的控制帧
            }
        }
    }

    sendInput(data: string): void {
        if (this.ws && this.ws.readyState === WebSocket.OPEN) {
            this.ws.send(JSON.stringify({ type: "input", data }));
        }
    }

    resize(cols: number, rows: number): void {
        if (this.ws && this.ws.readyState === WebSocket.OPEN) {
            this.ws.send(JSON.stringify({ type: "resize", cols, rows }));
        }
    }

    close(): void {
        const ws = this.ws;
        if (!ws) return;
        ws.onopen = null;
        ws.onclose = null;
        ws.onerror = null;
        ws.onmessage = null;
        try {
            ws.close();
        } catch {
            // ignore
        }
        this.ws = null;
    }
}

function buildWsUrl(
    platformId: string,
    token: string,
    cols: number,
    rows: number,
): string {
    const params = new URLSearchParams({
        token,
        cols: String(cols),
        rows: String(rows),
    });
    return backendWebSocketUrl(`/v1/webshell/${platformId}`, params);
}
