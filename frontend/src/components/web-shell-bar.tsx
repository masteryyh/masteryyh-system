import { useState } from "react";
import { ChevronDown, ChevronUp, TerminalSquare, X } from "lucide-react";

import { WebShell, type ShellStatus } from "@/components/web-shell";
import { Button } from "@/components/ui/button";
import { useWebShell } from "@/hooks/use-web-shell";
import { useTranslation } from "@/hooks/use-translation";
import { cn } from "@/lib/utils";

const STATUS_DOT: Record<ShellStatus, string> = {
    connecting: "bg-amber-500",
    connected: "bg-emerald-500",
    disconnected: "bg-slate-400",
};

/**
 * 底部常驻 shell 栏（Rancher 风格）：顶部 tab 行切换/关闭会话，下方终端区渲染当前激活会话。
 * 无会话时不渲染。可折叠为仅 tab 行。
 */
export function WebShellBar() {
    const { t } = useTranslation();
    const { sessions, activeId, setActive, closeShell, setStatus } = useWebShell();
    const [collapsed, setCollapsed] = useState(false);

    if (sessions.length === 0) return null;

    return (
        <div className="flex shrink-0 flex-col border-t bg-card">
            <div className="flex items-center gap-1 border-b px-2 py-1">
                <TerminalSquare className="size-3.5 shrink-0 text-muted-foreground" />
                <div className="flex min-w-0 flex-1 items-center gap-1 overflow-x-auto">
                    {sessions.map((s) => (
                        <button
                            key={s.id}
                            type="button"
                            onClick={() => setActive(s.id)}
                            className={cn(
                                "group inline-flex shrink-0 items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium transition-colors",
                                s.id === activeId
                                    ? "bg-secondary text-secondary-foreground"
                                    : "text-muted-foreground hover:bg-muted",
                            )}
                        >
                            <span
                                className={cn(
                                    "size-1.5 rounded-full",
                                    STATUS_DOT[s.status],
                                )}
                            />
                            <span className="max-w-40 truncate">{s.platformName}</span>
                            <span
                                role="button"
                                tabIndex={-1}
                                aria-label={t("shell.close")}
                                onClick={(e) => {
                                    e.stopPropagation();
                                    closeShell(s.id);
                                }}
                                className="ml-0.5 rounded p-0.5 opacity-0 transition-opacity hover:bg-background group-hover:opacity-100"
                            >
                                <X className="size-3" />
                            </span>
                        </button>
                    ))}
                </div>
                <Button
                    variant="ghost"
                    size="icon-sm"
                    aria-label={collapsed ? t("shell.expand") : t("shell.collapse")}
                    onClick={() => setCollapsed((c) => !c)}
                >
                    {collapsed ? <ChevronUp /> : <ChevronDown />}
                </Button>
            </div>
            {!collapsed && (
                <div className="h-64 w-full bg-background">
                    {sessions.map((s) => (
                        <div
                            key={s.id}
                            className={cn(
                                "h-full w-full",
                                s.id === activeId ? "block" : "hidden",
                            )}
                        >
                            <WebShell
                                platformId={s.platformId}
                                active={s.id === activeId}
                                onStatusChange={(status) => setStatus(s.id, status)}
                            />
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
