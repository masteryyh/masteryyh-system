import { backendWebSocketUrl } from "@/lib/backend-url";

/**
 * 通用事件流 WebSocket 客户端（/v1/ws）。
 *
 * 浏览器原生 WebSocket 无法携带 Authorization 头，token 通过 `?token=<jwt>` 在握手阶段
 * 由后端 `GenericWsHandshakeAuthInterceptor` 校验。
 *
 * 协议（文本 JSON 帧）：
 * - 客户端 → 服务端：`{type:"subscribe"|"unsubscribe",channel}`、`{type:"ping"}`。
 * - 服务端 → 客户端：`{type:"connected"}`、`{type:"ack",action,channel}`、`{type:"pong"}`、
 *   `{type:"error",...}`、`{type:"event",channel,event,data}`。
 *
 * 本客户端只解析 `event` 帧并回调 `onEvent`，其余控制帧由调用方按需处理；心跳与重连
 * 编排交给 `useEventStream` hook，保持客户端纯粹。
 */
export interface EventStreamClientOptions {
    token: string;
    onEvent: (channel: string, event: string, data: unknown) => void;
    onOpen?: () => void;
    onClose?: () => void;
    onError?: (event: Event) => void;
}

export class EventStreamClient {
    private ws: WebSocket | null = null;
    private readonly opts: EventStreamClientOptions;

    constructor(opts: EventStreamClientOptions) {
        this.opts = opts;
    }

    connect(): void {
        const ws = new WebSocket(buildEventWsUrl(this.opts.token));
        this.ws = ws;
        ws.onopen = () => this.opts.onOpen?.();
        ws.onclose = () => this.opts.onClose?.();
        ws.onerror = (event) => this.opts.onError?.(event);
        ws.onmessage = (event) => this.handleMessage(event);
    }

    private handleMessage(event: MessageEvent): void {
        if (typeof event.data !== "string") return;
        let msg: {
            type?: string;
            channel?: string;
            event?: string;
            data?: unknown;
        };
        try {
            msg = JSON.parse(event.data);
        } catch {
            return;
        }
        if (msg.type === "event" && msg.channel && msg.event) {
            this.opts.onEvent(msg.channel, msg.event, msg.data);
        }
    }

    subscribe(channel: string): void {
        this.send({ type: "subscribe", channel });
    }

    unsubscribe(channel: string): void {
        this.send({ type: "unsubscribe", channel });
    }

    ping(): void {
        this.send({ type: "ping" });
    }

    private send(payload: unknown): void {
        if (this.ws && this.ws.readyState === WebSocket.OPEN) {
            this.ws.send(JSON.stringify(payload));
        }
    }

    get isOpen(): boolean {
        return this.ws?.readyState === WebSocket.OPEN;
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

function buildEventWsUrl(token: string): string {
    const params = new URLSearchParams({ token });
    return backendWebSocketUrl("/v1/ws", params);
}
