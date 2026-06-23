import { useTranslation } from "@/hooks/use-translation";
import { formatDate } from "@/lib/formatters";

/**
 * 凭据过期 badge：
 *   null（永不过期） → neutral muted
 *   < 0 天             → destructive 红
 *   < 30 天            → amber 警示
 *   其余                → emerald 正常
 *
 * 适用于所有凭据类型；X509 的 notAfter 也通过本组件展示。
 */
export function ExpiryIndicator({
    expiresAt,
}: {
    expiresAt: string | null;
}) {
    const { t } = useTranslation();

    if (!expiresAt) {
        return (
            <span className="inline-flex items-center gap-1 rounded-md border border-border bg-muted/40 px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
                {t("credentials.expiry.none")}
            </span>
        );
    }

    const expiresOn = new Date(expiresAt);
    const now = new Date();
    const days = Math.floor(
        (expiresOn.getTime() - now.getTime()) / (1000 * 60 * 60 * 24),
    );

    const tone =
        days < 0
            ? "border-destructive/40 bg-destructive/10 text-destructive"
            : days < 30
              ? "border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-300"
              : "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300";

    const label =
        days < 0
            ? t("credentials.expiry.expired", { date: formatDate(expiresAt) })
            : days < 30
              ? t("credentials.expiry.expiringSoon", { days })
              : t("credentials.expiry.validUntil", {
                    date: formatDate(expiresAt),
                });

    return (
        <span
            className={`inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-[10px] font-medium ${tone}`}
        >
            {label}
        </span>
    );
}
