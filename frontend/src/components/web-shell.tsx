import { useEffect, useRef } from "react";
import { Terminal } from "@xterm/xterm";
import { FitAddon } from "@xterm/addon-fit";
import { WebLinksAddon } from "@xterm/addon-web-links";

import { useSession } from "@/hooks/use-session";
import { WebShellClient } from "@/lib/shell/web-shell-client";

import "@xterm/xterm/css/xterm.css";

export type ShellStatus = "connecting" | "connected" | "disconnected";

export interface WebShellProps {
    platformId: string;
    active: boolean;
    onStatusChange: (status: ShellStatus) => void;
}

const FONT_FAMILY =
    'ui-monospace, SFMono-Regular, Menlo, Monaco, "JetBrains Mono", Consolas, monospace';

/**
 * 读取 index.css 中的 oklch 主题变量派生 xterm 配色。
 * 背景与前景跟随网页主题；ANSI 16 色按浅/深模式给一套与 shadcn neutral 协调的固定色板。
 */
function readTheme() {
    const root = getComputedStyle(document.documentElement);
    const isDark = document.documentElement.classList.contains("dark");
    const bg =
        root.getPropertyValue("--background").trim() ||
        (isDark ? "#0a0a0a" : "#ffffff");
    const fg =
        root.getPropertyValue("--foreground").trim() ||
        (isDark ? "#fafafa" : "#0a0a0a");
    return {
        background: bg,
        foreground: fg,
        cursor: fg,
        cursorAccent: bg,
        selectionBackground: isDark
            ? "rgba(255,255,255,0.18)"
            : "rgba(0,0,0,0.16)",
        black: isDark ? "#0a0a0a" : "#1f1f1f",
        red: isDark ? "#ff6b6b" : "#c0392b",
        green: isDark ? "#5dd9a0" : "#27ae60",
        yellow: isDark ? "#f5c97a" : "#b7791f",
        blue: isDark ? "#6aa9ff" : "#2563eb",
        magenta: isDark ? "#c084fc" : "#9333ea",
        cyan: isDark ? "#5fd4e6" : "#0891b2",
        white: isDark ? "#e5e5e5" : "#525252",
        brightBlack: isDark ? "#737373" : "#a3a3a3",
        brightRed: isDark ? "#ff9a9a" : "#e74c3c",
        brightGreen: isDark ? "#86efac" : "#2ecc71",
        brightYellow: isDark ? "#fde68a" : "#f1c40f",
        brightBlue: isDark ? "#93c5fd" : "#3b82f6",
        brightMagenta: isDark ? "#d8b4fe" : "#a855f7",
        brightCyan: isDark ? "#67e8f9" : "#06b6d4",
        brightWhite: isDark ? "#fafafa" : "#171717",
    };
}

/**
 * 单个 webshell 终端：管理 xterm Terminal + FitAddon + WebLinksAddon + WebSocket 生命周期，
 * 配色随 <html> 的 dark class 切换。非 active 时容器 display:none，但仍保留连接与输出缓冲，
 * 切回 active 时重新 fit。
 */
export function WebShell({ platformId, active, onStatusChange }: WebShellProps) {
    const { session } = useSession();
    const containerRef = useRef<HTMLDivElement>(null);
    const fitRef = useRef<FitAddon | null>(null);
    const onStatusRef = useRef(onStatusChange);
    const activeRef = useRef(active);

    useEffect(() => {
        onStatusRef.current = onStatusChange;
    });
    useEffect(() => {
        activeRef.current = active;
    }, [active]);

    useEffect(() => {
        const container = containerRef.current;
        if (!container || !session?.token) return;

        const terminal = new Terminal({
            fontFamily: FONT_FAMILY,
            fontSize: 13,
            cursorBlink: true,
            theme: readTheme(),
            allowProposedApi: true,
            scrollback: 5000,
        });
        const fitAddon = new FitAddon();
        terminal.loadAddon(fitAddon);
        terminal.loadAddon(new WebLinksAddon());
        terminal.open(container);
        fitRef.current = fitAddon;
        if (activeRef.current) {
            try {
                fitAddon.fit();
            } catch {
                // 容器尚未完成布局
            }
        }

        const client = new WebShellClient({
            platformId,
            token: session.token,
            cols: terminal.cols,
            rows: terminal.rows,
            onData: (data) => terminal.write(data),
            onControl: (msg) => {
                if (msg.type === "closed") {
                    terminal.write("\r\n\x1b[90m[session closed]\x1b[0m\r\n");
                } else if (msg.type === "error") {
                    terminal.write(
                        `\r\n\x1b[31m[error] ${msg.message ?? ""}\x1b[0m\r\n`,
                    );
                }
                onStatusRef.current("disconnected");
            },
            onOpen: () => onStatusRef.current("connected"),
            onClose: () => onStatusRef.current("disconnected"),
            onError: () => onStatusRef.current("disconnected"),
        });
        client.connect();
        onStatusRef.current("connecting");

        const dataDisposable = terminal.onData((d) => client.sendInput(d));
        const resizeDisposable = terminal.onResize(({ cols, rows }) =>
            client.resize(cols, rows),
        );

        const resizeObserver = new ResizeObserver(() => {
            if (!activeRef.current) return;
            try {
                fitAddon.fit();
            } catch {
                // ignore
            }
        });
        resizeObserver.observe(container);

        const themeObserver = new MutationObserver(() => {
            terminal.options.theme = readTheme();
        });
        themeObserver.observe(document.documentElement, {
            attributes: true,
            attributeFilter: ["class"],
        });

        return () => {
            resizeObserver.disconnect();
            themeObserver.disconnect();
            dataDisposable.dispose();
            resizeDisposable.dispose();
            client.close();
            terminal.dispose();
            fitRef.current = null;
        };
    }, [platformId, session?.token]);

    // 切回 active 时容器从 display:none 恢复，重新计算列行并通知后端 resize。
    useEffect(() => {
        if (!active) return;
        const raf = requestAnimationFrame(() => {
            try {
                fitRef.current?.fit();
            } catch {
                // ignore
            }
        });
        return () => cancelAnimationFrame(raf);
    }, [active]);

    return <div ref={containerRef} className="h-full w-full" />;
}
