import type { ReactNode } from "react";
import { AlertCircle, ChevronLeft, ChevronRight, LoaderCircle } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function PageHeader({
    eyebrow,
    title,
    description,
    action,
}: {
    eyebrow: string;
    title: string;
    description: string;
    action?: ReactNode;
}) {
    return (
        <div className="flex flex-col gap-4 border-b pb-6 sm:flex-row sm:items-end sm:justify-between">
            <div>
                <p className="font-mono text-[0.68rem] font-semibold tracking-[0.18em] text-muted-foreground uppercase">
                    {eyebrow}
                </p>
                <h1 className="mt-2 text-2xl font-semibold tracking-tight sm:text-3xl">
                    {title}
                </h1>
                <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
                    {description}
                </p>
            </div>
            {action}
        </div>
    );
}

export function InlineMessage({
    children,
    variant = "error",
}: {
    children: ReactNode;
    variant?: "error" | "success";
}) {
    return (
        <div
            className={cn(
                "flex items-start gap-2 rounded-lg border px-3 py-2 text-sm",
                variant === "error"
                    ? "border-destructive/25 bg-destructive/8 text-destructive"
                    : "border-emerald-600/20 bg-emerald-500/8 text-emerald-700",
            )}
        >
            <AlertCircle className="mt-0.5 size-4 shrink-0" />
            <span>{children}</span>
        </div>
    );
}

export function LoadingState() {
    return (
        <div className="grid min-h-56 place-items-center text-sm text-muted-foreground">
            <div className="flex items-center gap-2">
                <LoaderCircle className="size-4 animate-spin" />
                正在读取数据
            </div>
        </div>
    );
}

export function EmptyState({
    title,
    description,
}: {
    title: string;
    description: string;
}) {
    return (
        <div className="grid min-h-56 place-items-center px-6 text-center">
            <div>
                <p className="font-medium">{title}</p>
                <p className="mt-1 text-sm text-muted-foreground">
                    {description}
                </p>
            </div>
        </div>
    );
}

export function Pagination({
    page,
    totalPages,
    totalData,
    onPageChange,
}: {
    page: number;
    totalPages: number;
    totalData: number;
    onPageChange: (page: number) => void;
}) {
    return (
        <div className="flex items-center justify-between border-t px-4 py-3 text-sm">
            <span className="text-muted-foreground">共 {totalData} 条</span>
            <div className="flex items-center gap-2">
                <Button
                    type="button"
                    variant="outline"
                    size="icon-sm"
                    disabled={page <= 1}
                    onClick={() => onPageChange(page - 1)}
                >
                    <ChevronLeft />
                    <span className="sr-only">上一页</span>
                </Button>
                <span className="min-w-16 text-center font-mono text-xs">
                    {page} / {Math.max(totalPages, 1)}
                </span>
                <Button
                    type="button"
                    variant="outline"
                    size="icon-sm"
                    disabled={page >= totalPages}
                    onClick={() => onPageChange(page + 1)}
                >
                    <ChevronRight />
                    <span className="sr-only">下一页</span>
                </Button>
            </div>
        </div>
    );
}
