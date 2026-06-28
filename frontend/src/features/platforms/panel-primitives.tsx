import { type ReactNode } from "react";
import { RefreshCw } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
    ErrorBanner,
    LoadingState,
} from "@/components/resource-ui";
import { useTranslation } from "@/hooks/use-translation";
import { cn } from "@/lib/utils";

/**
 * 详情页区块卡片：紧凑的标题条 + 内容区，标题右侧可放操作（如刷新）。
 */
export function SectionCard({
    title,
    description,
    action,
    children,
    bodyClassName,
}: {
    title: string;
    description?: string;
    action?: ReactNode;
    children: ReactNode;
    bodyClassName?: string;
}) {
    return (
        <section className="w-full overflow-hidden rounded-xl border bg-card shadow-sm">
            <header className="flex items-center justify-between gap-3 border-b bg-muted/30 px-4 py-2.5">
                <div className="min-w-0">
                    <h2 className="truncate text-sm font-semibold">{title}</h2>
                    {description ? (
                        <p className="mt-0.5 truncate text-xs text-muted-foreground">
                            {description}
                        </p>
                    ) : null}
                </div>
                {action}
            </header>
            <div className={cn("p-0", bodyClassName)}>{children}</div>
        </section>
    );
}

export function RefreshButton({
    onClick,
    loading,
}: {
    onClick: () => void;
    loading: boolean;
}) {
    const { t } = useTranslation();
    return (
        <Button
            variant="ghost"
            size="sm"
            onClick={onClick}
            disabled={loading}
        >
            <RefreshCw className={cn("size-4", loading && "animate-spin")} />
            {t("platforms.detail.refresh")}
        </Button>
    );
}

export interface Column<Row> {
    key: string;
    header: string;
    render: (row: Row) => ReactNode;
    className?: string;
    headerClassName?: string;
}

/**
 * 高密度数据表，用于 Docker 容器/镜像/网络/卷等列表。空数据由调用方自行处理。
 */
export function DataTable<Row>({
    columns,
    rows,
    rowKey,
    emptyHint,
}: {
    columns: Column<Row>[];
    rows: Row[];
    rowKey: (row: Row) => string;
    emptyHint: string;
}) {
    if (rows.length === 0) {
        return (
            <div className="grid min-h-32 place-items-center px-4 py-8 text-sm text-muted-foreground">
                {emptyHint}
            </div>
        );
    }
    return (
        <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-left text-sm">
                <thead className="border-b bg-muted/25 text-xs text-muted-foreground">
                    <tr>
                        {columns.map((column) => (
                            <th
                                key={column.key}
                                className={cn(
                                    "px-4 py-2.5 font-medium",
                                    column.headerClassName,
                                )}
                            >
                                {column.header}
                            </th>
                        ))}
                    </tr>
                </thead>
                <tbody className="divide-y">
                    {rows.map((row) => (
                        <tr
                            key={rowKey(row)}
                            className="transition-colors hover:bg-muted/25"
                        >
                            {columns.map((column) => (
                                <td
                                    key={column.key}
                                    className={cn(
                                        "px-4 py-2.5 align-top",
                                        column.className,
                                    )}
                                >
                                    {column.render(row)}
                                </td>
                            ))}
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
}

/**
 * 单个资源面板的统一外壳：处理加载/错误/数据三态。
 */
export function ResourcePanelBody<Row>({
    loading,
    error,
    rows,
    rowKey,
    columns,
    emptyHint,
    fallbackKey = "platforms.detail.fallback.loadFailed",
}: {
    loading: boolean;
    error: unknown;
    rows: Row[];
    rowKey: (row: Row) => string;
    columns: Column<Row>[];
    emptyHint: string;
    fallbackKey?: string;
}) {
    if (loading) return <LoadingState />;
    if (error) return <ErrorBanner error={error} fallbackKey={fallbackKey} />;
    return (
        <DataTable
            columns={columns}
            rows={rows}
            rowKey={rowKey}
            emptyHint={emptyHint}
        />
    );
}
