import { useEffect, useRef } from "react";

import { useSession } from "@/hooks/use-session";
import { EventStreamClient } from "@/lib/ws/event-client";

export interface UseEventStreamOptions {
    /** 需要订阅的 channel 列表（建议 useMemo 稳定引用）。 */
    channels: string[];
    /** 收到 event 帧时回调；用 ref 透传，更新回调不会触发重连。 */
    onEvent: (channel: string, event: string, data: unknown) => void;
    /** 是否启用，默认 true；false 时不建连。 */
    enabled?: boolean;
}

/**
 * 通用事件流：维护到 /v1/ws 的单连接，按 {@link UseEventStreamOptions.channels} 动态订阅。
 *
 * - channels 变化时与上一次 diff：新增 subscribe、移除 unsubscribe；
 * - 连接 open 后每 30s 发 ping 保活；
 * - 断开指数退避重连（1s→2s→4s，封顶 15s），重连后重新订阅当前 channels；
 * - 卸载或 token 失效时关闭连接。
 */
export function useEventStream({
    channels,
    onEvent,
    enabled = true,
}: UseEventStreamOptions) {
    const { session } = useSession();
    const token = session?.token;

    const onEventRef = useRef(onEvent);
    const channelsRef = useRef<string[]>(channels);
    useEffect(() => {
        onEventRef.current = onEvent;
        channelsRef.current = channels;
    });

    const clientRef = useRef<EventStreamClient | null>(null);
    const subscribedRef = useRef<Set<string>>(new Set());

    // 连接生命周期
    useEffect(() => {
        if (!enabled || !token) return;

        let reconnectTimer: number | undefined;
        let pingTimer: number | undefined;
        let attempt = 0;
        let disposed = false;

        const clearTimers = () => {
            if (reconnectTimer !== undefined) {
                window.clearTimeout(reconnectTimer);
                reconnectTimer = undefined;
            }
            if (pingTimer !== undefined) {
                window.clearInterval(pingTimer);
                pingTimer = undefined;
            }
        };

        const connect = () => {
            const client = new EventStreamClient({
                token,
                onOpen: () => {
                    attempt = 0;
                    // 重连/首次 open 后统一订阅当前全集
                    channelsRef.current.forEach((ch) => client.subscribe(ch));
                    subscribedRef.current = new Set(channelsRef.current);
                    if (pingTimer !== undefined) {
                        window.clearInterval(pingTimer);
                    }
                    pingTimer = window.setInterval(
                        () => clientRef.current?.ping(),
                        30000,
                    );
                },
                onClose: () => {
                    if (pingTimer !== undefined) {
                        window.clearInterval(pingTimer);
                        pingTimer = undefined;
                    }
                    if (disposed) return;
                    const delay = Math.min(1000 * 2 ** attempt, 15000);
                    attempt += 1;
                    reconnectTimer = window.setTimeout(connect, delay);
                },
                onEvent: (channel, event, data) =>
                    onEventRef.current(channel, event, data),
            });
            clientRef.current = client;
            client.connect();
        };

        connect();

        return () => {
            disposed = true;
            clearTimers();
            clientRef.current?.close();
            clientRef.current = null;
            subscribedRef.current = new Set();
        };
    }, [enabled, token]);

    // channels diff：连接已 open 时增量 subscribe/unsubscribe
    useEffect(() => {
        const client = clientRef.current;
        const next = new Set(channels);
        if (!client || !client.isOpen) {
            // 未连接时只记账，等 onOpen 统一订阅
            subscribedRef.current = next;
            return;
        }
        const prev = subscribedRef.current;
        next.forEach((ch) => {
            if (!prev.has(ch)) client.subscribe(ch);
        });
        prev.forEach((ch) => {
            if (!next.has(ch)) client.unsubscribe(ch);
        });
        subscribedRef.current = next;
    }, [channels]);
}
