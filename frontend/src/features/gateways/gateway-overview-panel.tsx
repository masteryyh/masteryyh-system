import { useCallback, useMemo, useState } from "react";
import { DiffEditor } from "@monaco-editor/react";
import {
    CheckCircle2,
    Container,
    LoaderCircle,
    RefreshCw,
    Server,
    XCircle,
} from "lucide-react";

import { ErrorBanner } from "@/components/resource-ui";
import { Button } from "@/components/ui/button";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { useApi } from "@/hooks/use-api";
import { useEventStream } from "@/hooks/use-event-stream";
import { useMonacoTheme } from "@/hooks/use-monaco-theme";
import { useNotify } from "@/hooks/use-notify";
import { useTranslation } from "@/hooks/use-translation";
import { formatDate } from "@/lib/formatters";
import { cn } from "@/lib/utils";
import type { GatewayStatus } from "@/types/api";
import { SectionCard } from "@/features/platforms/panel-primitives";
import { useGatewayDetailContext } from "./use-gateway-detail-context";

interface ProgressEntry {
    step: string;
    message: string;
    state: "running" | "done" | "failed";
}

export function GatewayOverviewPanel() {
    const {
        gateway,
        platform,
        entryPoints,
        reload,
    } = useGatewayDetailContext();
    const api = useApi();
    const notify = useNotify();
    const { t } = useTranslation();
    const theme = useMonacoTheme();

    const [deployDialog, setDeployDialog] = useState(false);
    const [deploying, setDeploying] = useState(false);
    const [deployError, setDeployError] = useState<unknown>(null);
    const [diffEntryId, setDiffEntryId] = useState("");
    const [deployLogs, setDeployLogs] = useState<ProgressEntry[]>([]);

    const changedEntryPoints = useMemo(
        () =>
            entryPoints.filter(
                (entry) =>
                    (entry.currentConfigContent ?? "") !==
                    (entry.lastConfigContent ?? ""),
            ),
        [entryPoints],
    );

    const diffEntry = useMemo(
        () =>
            entryPoints.find((entry) => entry.id === diffEntryId) ??
            changedEntryPoints[0] ??
            entryPoints[0] ??
            null,
        [changedEntryPoints, diffEntryId, entryPoints],
    );

    const channels = useMemo(
        () => (gateway ? [`gateway:${gateway.id}`] : []),
        [gateway],
    );

    const handleEvent = useCallback(
        (_channel: string, event: string, data: unknown) => {
            const payload = (data ?? {}) as {
                step?: string;
                message?: string;
                status?: string;
            };
            if (event === "progress") {
                const step = payload.step ?? "progress";
                const message = payload.message ?? "";
                setDeployLogs((current) => {
                    const next = [...current];
                    const idx = next.findIndex(
                        (entry) =>
                            entry.step === step && entry.state === "running",
                    );
                    if (idx >= 0) {
                        next[idx] = { ...next[idx], message };
                    } else {
                        next.push({ step, message, state: "running" });
                    }
                    return next;
                });
                return;
            }
            if (event === "failed") {
                setDeployLogs((current) => {
                    const finished = current.map((entry) =>
                        entry.state === "running"
                            ? { ...entry, state: "failed" as const }
                            : entry,
                    );
                    return [
                        ...finished,
                        {
                            step: payload.step ?? "failed",
                            message:
                                payload.message ??
                                t("gateways.fallback.deployFailed"),
                            state: "failed",
                        },
                    ];
                });
                notify.error(new Error("Gateway deployment failed"), {
                    titleKey: "gateways.fallback.deployFailed",
                });
                setDeploying(false);
                window.setTimeout(() => void reload(), 800);
                return;
            }
            if (event === "done") {
                setDeployLogs((current) =>
                    current.map((entry) =>
                        entry.state === "running"
                            ? { ...entry, state: "done" }
                            : entry,
                    ),
                );
                notify.success("gatewayDetail.success.deployed");
                setDeploying(false);
                window.setTimeout(() => void reload(), 800);
            }
        },
        [notify, reload, t],
    );

    useEventStream({ channels, onEvent: handleEvent });

    function openDeployDialog() {
        setDeployError(null);
        setDiffEntryId(
            changedEntryPoints[0]?.id ?? entryPoints[0]?.id ?? "",
        );
        setDeployDialog(true);
    }

    async function deployGateway() {
        if (!gateway) return;
        setDeploying(true);
        setDeployError(null);
        setDeployLogs([]);
        try {
            await api.gateways.deploy(gateway.id);
            setDeployDialog(false);
            notify.success("gatewayDetail.success.deployStarted");
            await reload();
        } catch (deployError) {
            setDeployError(deployError);
            setDeploying(false);
        }
    }

    if (!gateway) return null;

    const version =
        platform?.platformType === "DOCKER"
            ? gateway.containerImage
            : gateway.appVersion;

    return (
        <div className="space-y-5">
            <SectionCard title={t("gatewayDetail.eyebrow")}>
                <dl className="grid gap-x-6 gap-y-4 px-4 py-4 sm:grid-cols-2">
                    <OverviewField label={t("gatewayDetail.overview.platform")}>
                        {platform ? (
                            <div className="flex items-center gap-2">
                                {platform.platformType === "DOCKER" ? (
                                    <Container className="size-4 text-muted-foreground" />
                                ) : (
                                    <Server className="size-4 text-muted-foreground" />
                                )}
                                <span className="truncate text-sm font-medium">
                                    {platform.name}
                                </span>
                                <span className="text-xs text-muted-foreground">
                                    {t(
                                        `platforms.type.${platform.platformType}`,
                                    )}
                                </span>
                            </div>
                        ) : (
                            <span className="text-sm text-muted-foreground">
                                {t("common.dash")}
                            </span>
                        )}
                    </OverviewField>
                    <OverviewField
                        label={t("gatewayDetail.overview.version")}
                    >
                        <p
                            className="truncate font-mono text-xs"
                            title={version ?? undefined}
                        >
                            {version || t("common.dash")}
                        </p>
                    </OverviewField>
                    <OverviewField label={t("gatewayDetail.overview.status")}>
                        <StatusInline status={gateway.status} />
                    </OverviewField>
                    <OverviewField
                        label={t("gatewayDetail.overview.updatedAt")}
                    >
                        <p className="text-sm text-muted-foreground">
                            {formatDate(gateway.updatedAt)}
                        </p>
                    </OverviewField>
                    {gateway.description ? (
                        <OverviewField
                            label={t("gatewayDetail.overview.description")}
                            className="sm:col-span-2"
                        >
                            <p className="text-sm text-muted-foreground">
                                {gateway.description}
                            </p>
                        </OverviewField>
                    ) : null}
                </dl>
            </SectionCard>

            <SectionCard
                title={t("gatewayDetail.overview.deploySection")}
                description={
                    gateway.pendingChanges
                        ? t("gatewayDetail.pending")
                        : undefined
                }
                action={
                    <Button
                        variant={
                            gateway.pendingChanges ? "default" : "outline"
                        }
                        size="sm"
                        onClick={openDeployDialog}
                        disabled={deploying}
                    >
                        {deploying ? (
                            <LoaderCircle className="animate-spin" />
                        ) : (
                            <RefreshCw />
                        )}
                        {gateway.pendingChanges
                            ? t("gatewayDetail.deploy.apply")
                            : t("gatewayDetail.deploy.redeploy")}
                    </Button>
                }
            >
                <div className="px-4 py-3">
                    <ProgressLog
                        entries={deployLogs}
                        inProgress={deploying}
                    />
                </div>
            </SectionCard>

            <Dialog open={deployDialog} onOpenChange={setDeployDialog}>
                <DialogContent className="max-w-5xl">
                    <DialogHeader>
                        <DialogTitle>
                            {t("gatewayDetail.deploy.title")}
                        </DialogTitle>
                        <DialogDescription>
                            {gateway.pendingChanges
                                ? t("gatewayDetail.deploy.descriptionPending")
                                : t("gatewayDetail.deploy.descriptionRedeploy")}
                        </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4">
                        {entryPoints.length ? (
                            <>
                                <div className="flex flex-wrap items-center justify-between gap-3">
                                    <select
                                        className="h-9 min-w-60 rounded-lg border border-input bg-transparent px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
                                        value={diffEntry?.id ?? ""}
                                        onChange={(event) =>
                                            setDiffEntryId(event.target.value)
                                        }
                                    >
                                        {entryPoints.map((entry) => {
                                            const changed =
                                                (entry.currentConfigContent ??
                                                    "") !==
                                                (entry.lastConfigContent ?? "");
                                            return (
                                                <option
                                                    key={entry.id}
                                                    value={entry.id}
                                                >
                                                    {entry.name} :{entry.listenPort}
                                                    {changed
                                                        ? ` · ${t("gatewayDetail.deploy.changed")}`
                                                        : ""}
                                                </option>
                                            );
                                        })}
                                    </select>
                                    <span className="inline-flex items-center gap-2 text-xs text-muted-foreground">
                                        {changedEntryPoints.length ? (
                                            <XCircle className="size-4 text-amber-600" />
                                        ) : (
                                            <CheckCircle2 className="size-4 text-emerald-600" />
                                        )}
                                        {t(
                                            "gatewayDetail.deploy.changedCount",
                                            { count: changedEntryPoints.length },
                                        )}
                                    </span>
                                </div>
                                <div className="overflow-hidden rounded-lg border">
                                    <DiffEditor
                                        height={420}
                                        language="plaintext"
                                        theme={theme}
                                        original={
                                            diffEntry?.lastConfigContent ?? ""
                                        }
                                        modified={
                                            diffEntry?.currentConfigContent ?? ""
                                        }
                                        options={{
                                            readOnly: true,
                                            renderSideBySide: true,
                                            minimap: { enabled: false },
                                            fontSize: 12,
                                            lineNumbersMinChars: 3,
                                            scrollBeyondLastLine: false,
                                            automaticLayout: true,
                                            contextmenu: false,
                                            wordWrap: "on",
                                        }}
                                    />
                                </div>
                            </>
                        ) : (
                            <div className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
                                {t("gatewayDetail.deploy.noEntryPoints")}
                            </div>
                        )}
                        <ErrorBanner
                            error={deployError}
                            fallbackKey="gateways.fallback.deployFailed"
                        />
                    </div>
                    <DialogFooter>
                        <Button
                            type="button"
                            variant="outline"
                            onClick={() => setDeployDialog(false)}
                        >
                            {t("common.cancel")}
                        </Button>
                        <Button
                            type="button"
                            disabled={deploying}
                            onClick={() => void deployGateway()}
                        >
                            {deploying ? (
                                <LoaderCircle className="animate-spin" />
                            ) : (
                                <RefreshCw />
                            )}
                            {deploying
                                ? t("gatewayDetail.deploy.deploying")
                                : t("gatewayDetail.deploy.confirm")}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}

function OverviewField({
    label,
    children,
    className,
}: {
    label: string;
    children: React.ReactNode;
    className?: string;
}) {
    return (
        <div className={cn("min-w-0", className)}>
            <dt className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
                {label}
            </dt>
            <dd className="mt-1.5 min-w-0">{children}</dd>
        </div>
    );
}

function StatusInline({ status }: { status: GatewayStatus }) {
    const { t } = useTranslation();
    const config = statusConfig(status);
    return (
        <span className="inline-flex items-center gap-2 text-sm font-medium">
            {config.spin ? (
                <LoaderCircle className="size-3.5 animate-spin text-muted-foreground" />
            ) : (
                <span
                    className={cn(
                        "size-2 rounded-full",
                        config.dot,
                        config.glow,
                    )}
                />
            )}
            {t(`gateways.status.${status}`)}
        </span>
    );
}

function statusConfig(status: GatewayStatus): {
    dot: string;
    glow: string;
    spin: boolean;
} {
    switch (status) {
        case "HEALTHY":
            return {
                dot: "bg-emerald-500",
                glow: "shadow-[0_0_0_3px_rgba(16,185,129,0.14)]",
                spin: false,
            };
        case "STARTING":
            return { dot: "bg-sky-500", glow: "", spin: true };
        case "STOPPING":
            return { dot: "bg-amber-500", glow: "", spin: true };
        case "UNHEALTHY":
            return {
                dot: "bg-rose-500",
                glow: "shadow-[0_0_0_3px_rgba(244,63,94,0.14)]",
                spin: false,
            };
        case "STOPPED":
        default:
            return { dot: "bg-slate-400", glow: "", spin: false };
    }
}

function ProgressLog({
    entries,
    inProgress,
}: {
    entries: ProgressEntry[];
    inProgress: boolean;
}) {
    const { t } = useTranslation();
    if (!entries.length) {
        return (
            <p className="px-1 py-2 text-xs text-muted-foreground">
                {inProgress
                    ? t("gateways.progress.empty")
                    : t("gatewayDetail.overview.idle")}
            </p>
        );
    }
    return (
        <div className="space-y-1.5">
            <p className="px-1 text-[0.68rem] font-semibold tracking-[0.18em] text-muted-foreground uppercase">
                {t("gateways.progress.title")}
            </p>
            <div className="space-y-1 font-mono text-xs">
                {entries.map((entry, idx) => (
                    <div
                        key={`${entry.step}-${idx}`}
                        className="flex items-start gap-2 px-1"
                    >
                        <StepIcon state={entry.state} />
                        <span className="shrink-0 rounded bg-background px-1.5 py-0.5 text-[0.68rem] font-semibold text-muted-foreground ring-1 ring-border/60">
                            {t(
                                `gateways.step.${entry.step}`,
                                undefined,
                                entry.step,
                            )}
                        </span>
                        <span className="min-w-0 break-all text-foreground/80">
                            {entry.message}
                        </span>
                    </div>
                ))}
            </div>
        </div>
    );
}

function StepIcon({ state }: { state: ProgressEntry["state"] }) {
    if (state === "done") {
        return (
            <CheckCircle2 className="mt-0.5 size-3.5 shrink-0 text-emerald-500" />
        );
    }
    if (state === "failed") {
        return <XCircle className="mt-0.5 size-3.5 shrink-0 text-rose-500" />;
    }
    return (
        <LoaderCircle className="mt-0.5 size-3.5 shrink-0 animate-spin text-muted-foreground" />
    );
}
