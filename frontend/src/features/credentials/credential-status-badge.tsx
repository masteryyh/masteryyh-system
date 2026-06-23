import type { CredentialStatus } from "@/types/api";
import { useTranslation } from "@/hooks/use-translation";

/**
 * 凭据生命周期状态指示器。极小尺寸 + 状态点 + 短标签，
 * 设计语言与 fingerprint 列的 mono 字体形成对比，适合表格密集行。
 *
 * 与 ExpiryIndicator 协同工作：状态由后端 status 字段决定，
 * 过期 badge 由前端基于 expiresAt 计算，二者互相补充而非重复。
 */
const tones: Record<
    CredentialStatus,
    { dot: string; chip: string; labelKey: string }
> = {
    ACTIVE: {
        dot: "bg-slate-400 dark:bg-slate-500",
        chip: "border-border bg-muted/35 text-muted-foreground",
        labelKey: "credentials.status.ACTIVE",
    },
    IN_USE: {
        dot: "bg-sky-500",
        chip: "border-sky-500/30 bg-sky-500/10 text-sky-700 dark:text-sky-300",
        labelKey: "credentials.status.IN_USE",
    },
    EXPIRING_SOON: {
        dot: "bg-amber-500",
        chip: "border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-300",
        labelKey: "credentials.status.EXPIRING_SOON",
    },
    EXPIRED: {
        dot: "bg-destructive",
        chip: "border-destructive/40 bg-destructive/10 text-destructive",
        labelKey: "credentials.status.EXPIRED",
    },
};

export function CredentialStatusBadge({ status }: { status: CredentialStatus }) {
    const { t } = useTranslation();
    const tone = tones[status];

    return (
        <span
            className={`inline-flex items-center gap-1.5 rounded-md border px-1.5 py-0.5 text-[10px] font-medium ${tone.chip}`}
        >
            <span className={`size-1.5 rounded-full ${tone.dot}`} />
            {t(tone.labelKey)}
        </span>
    );
}
