import { useCallback, useEffect, useRef, useState } from "react";

import { useApi } from "@/hooks/use-api";

const REFRESH_INTERVAL_MS = 5000;

/**
 * 通用 Docker 资源获取 hook：
 *
 * - 进入时立即拉取一次；
 * - 之后每 {@link REFRESH_INTERVAL_MS} 自动轮询刷新；
 * - `fetcher` 用 ref 持有，避免调用方内联箭头函数导致 effect 高频重跑；
 * - 轮询与手动刷新均不会与正在进行的请求重叠。
 *
 * 仅在 Docker 平台在线时使用；非 Docker / 离线场景由调用方自行处理。
 */
export function useDockerResource<T>(
    platformId: string,
    fetcher: (api: ReturnType<typeof useApi>, id: string) => Promise<T>,
    enabled: boolean,
) {
    const api = useApi();
    const [data, setData] = useState<T | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<unknown>(null);

    const fetcherRef = useRef(fetcher);
    useEffect(() => {
        fetcherRef.current = fetcher;
    });
    const inflightRef = useRef(false);

    const load = useCallback(
        async (silent = false) => {
            if (!enabled || !platformId) return;
            if (inflightRef.current) return;
            inflightRef.current = true;
            if (!silent) setLoading(true);
            setError(null);
            try {
                setData(await fetcherRef.current(api, platformId));
            } catch (err) {
                setData(null);
                setError(err);
            } finally {
                if (!silent) setLoading(false);
                inflightRef.current = false;
            }
        },
        [api, enabled, platformId],
    );

    useEffect(() => {
        if (!enabled || !platformId) return;
        const timeout = window.setTimeout(() => void load(false), 0);
        const interval = window.setInterval(
            () => void load(true),
            REFRESH_INTERVAL_MS,
        );
        return () => {
            window.clearTimeout(timeout);
            window.clearInterval(interval);
        };
    }, [load, enabled, platformId]);

    return { data, loading, error, reload: () => void load(false) };
}
