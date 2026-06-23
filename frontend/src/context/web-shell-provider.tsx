import { useCallback, useMemo, useState, type ReactNode } from "react";

import type { ShellStatus } from "@/components/web-shell";
import { WebShellContext, type ShellSession } from "@/context/web-shell-context";
import type { AppPlatform } from "@/types/api";

let idCounter = 0;

function nextId(): string {
    idCounter += 1;
    return `shell-${idCounter}`;
}

/**
 * 全局 webshell 会话状态：维护已打开的 shell 列表与当前激活 tab。
 * 挂在 ConsoleShell 内（SessionProvider 之下），登录后任意页面可用底部 shell 栏。
 */
export function WebShellProvider({ children }: { children: ReactNode }) {
    const [sessions, setSessions] = useState<ShellSession[]>([]);
    const [activeId, setActiveId] = useState<string | null>(null);

    const openShell = useCallback((platform: AppPlatform) => {
        const session: ShellSession = {
            id: nextId(),
            platformId: platform.id,
            platformName: platform.name,
            status: "connecting",
        };
        setSessions((prev) => [...prev, session]);
        setActiveId(session.id);
    }, []);

    const closeShell = useCallback((id: string) => {
        setSessions((prev) => prev.filter((s) => s.id !== id));
        setActiveId((cur) => {
            if (cur !== id) return cur;
            const remaining = sessions.filter((s) => s.id !== id);
            return remaining.length ? remaining[remaining.length - 1].id : null;
        });
    }, [sessions]);

    const setActive = useCallback((id: string) => setActiveId(id), []);

    const setStatus = useCallback((id: string, status: ShellStatus) => {
        setSessions((prev) =>
            prev.map((s) => (s.id === id ? { ...s, status } : s)),
        );
    }, []);

    const value = useMemo(
        () => ({ sessions, activeId, openShell, closeShell, setActive, setStatus }),
        [sessions, activeId, openShell, closeShell, setActive, setStatus],
    );

    return (
        <WebShellContext.Provider value={value}>
            {children}
        </WebShellContext.Provider>
    );
}
