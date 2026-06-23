import { useCallback, useEffect, useMemo, useState } from "react";

import {
    Tooltip,
    TooltipContent,
    TooltipTrigger,
} from "@/components/ui/tooltip";
import { useNotify } from "@/hooks/use-notify";
import { useTranslation } from "@/hooks/use-translation";
import { formatFingerprint } from "@/lib/formatters";

const RESET_DELAY_MS = 1500;

async function writeToClipboard(value: string) {
    if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(value);
        return;
    }
    // 兜底：在不支持 Clipboard API（如非 HTTPS / 老浏览器）的环境下降级
    const textarea = document.createElement("textarea");
    textarea.value = value;
    textarea.setAttribute("readonly", "");
    textarea.style.position = "fixed";
    textarea.style.opacity = "0";
    document.body.appendChild(textarea);
    textarea.select();
    try {
        const ok = document.execCommand("copy");
        if (!ok) throw new Error("execCommand returned false");
    } finally {
        document.body.removeChild(textarea);
    }
}

export function FingerprintBadge({ fingerprint }: { fingerprint: string }) {
    const { t } = useTranslation();
    const notify = useNotify();

    const formatted = useMemo(
        () => formatFingerprint(fingerprint),
        [fingerprint],
    );

    // 使用计数器而不是 boolean，方便用户连续点击时每次都重置 1.5s 倒计时
    const [openByHover, setOpenByHover] = useState(false);
    const [copyTick, setCopyTick] = useState(0);
    const copied = copyTick > 0;

    const handleCopy = useCallback(async () => {
        try {
            await writeToClipboard(formatted);
            setCopyTick((tick) => tick + 1);
        } catch (error) {
            console.error("Copy fingerprint failed", error);
            notify.error(error, { titleKey: "fingerprint.copyFailed" });
        }
    }, [formatted, notify]);

    useEffect(() => {
        if (copyTick === 0) return;
        const timer = window.setTimeout(
            () => setCopyTick(0),
            RESET_DELAY_MS,
        );
        return () => window.clearTimeout(timer);
    }, [copyTick]);

    return (
        <Tooltip
            open={openByHover || copied}
            onOpenChange={setOpenByHover}
        >
            <TooltipTrigger asChild>
                {/* 用 <code> 而不是 <button>，确保胶囊样式与原版 1:1 一致；
                    role/tabIndex/onKeyDown 让它仍然键盘可达 */}
                <code
                    role="button"
                    tabIndex={0}
                    onClick={() => void handleCopy()}
                    onKeyDown={(event) => {
                        if (event.key === "Enter" || event.key === " ") {
                            event.preventDefault();
                            void handleCopy();
                        }
                    }}
                    aria-label={
                        copied
                            ? t("fingerprint.ariaCopied")
                            : t("fingerprint.ariaCopy", {
                                  fingerprint: formatted,
                              })
                    }
                    className="block max-w-64 cursor-pointer truncate rounded-md bg-slate-950 px-2 py-1.5 font-mono text-[0.7rem] text-slate-100 outline-none focus-visible:ring-2 focus-visible:ring-ring/60"
                >
                    {formatted}
                </code>
            </TooltipTrigger>

            <TooltipContent
                side="top"
                align="start"
                sideOffset={6}
                className="max-w-sm px-3 py-2"
            >
                <div className="flex flex-col gap-1">
                    <p className="break-all font-mono text-[0.7rem] leading-relaxed tracking-wide">
                        {formatted}
                    </p>
                    <p
                        aria-live="polite"
                        className="text-[0.65rem] opacity-60"
                    >
                        {copied
                            ? t("fingerprint.tooltipCopied")
                            : t("fingerprint.tooltipCopyHint")}
                    </p>
                </div>
            </TooltipContent>
        </Tooltip>
    );
}
