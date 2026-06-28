import {
    useCallback,
    useEffect,
    useMemo,
    useState,
    type FormEvent,
    type ReactNode,
} from "react";
import {
    CheckCircle2,
    ChevronRight,
    Container,
    LoaderCircle,
    Network,
    Pencil,
    Plus,
    RefreshCw,
    Server,
    SlidersHorizontal,
    Trash2,
    XCircle,
} from "lucide-react";
import { Link } from "react-router";

import {
    EmptyState,
    ErrorBanner,
    LoadingState,
    PageHeader,
    Pagination,
    SuccessBanner,
} from "@/components/resource-ui";
import { Button } from "@/components/ui/button";
import { CodeEditor } from "@/components/code-editor";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useApi } from "@/hooks/use-api";
import { useEventStream } from "@/hooks/use-event-stream";
import { useNotify } from "@/hooks/use-notify";
import { useTranslation } from "@/hooks/use-translation";
import { formatDate } from "@/lib/formatters";
import { cn } from "@/lib/utils";
import type {
    AddGatewayConfigRequest,
    AppPlatform,
    GatewayConfig,
    GatewayStatus,
    PagedResponse,
    PlatformType,
    UpdateGatewayConfigRequest,
} from "@/types/api";

const pageSize = 10;
const platformPageSize = 1000;
const controlClass =
    "h-8 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50";

const PROGRESSING_STATUS: GatewayStatus[] = ["STARTING", "STOPPING"];

interface GatewayFormState {
    name: string;
    description: string;
    platformId: string;
    appVersion: string;
    containerImage: string;
    configContent: string;
}

const emptyForm: GatewayFormState = {
    name: "",
    description: "",
    platformId: "",
    appVersion: "",
    containerImage: "nginx:alpine",
    configContent: "",
};

interface ProgressEntry {
    step: string;
    message: string;
    state: "running" | "done" | "failed";
}

export function GatewaysPage() {
    const api = useApi();
    const notify = useNotify();
    const { t } = useTranslation();

    const [page, setPage] = useState(1);
    const [result, setResult] = useState<PagedResponse<GatewayConfig> | null>(
        null,
    );
    const [platformById, setPlatformById] = useState<
        Record<string, AppPlatform>
    >({});
    const [platforms, setPlatforms] = useState<AppPlatform[]>([]);
    const [loading, setLoading] = useState(true);
    const [loadError, setLoadError] = useState<unknown>(null);
    const [successKey, setSuccessKey] = useState("");

    const [formOpen, setFormOpen] = useState(false);
    const [editing, setEditing] = useState<GatewayConfig | null>(null);
    const [form, setForm] = useState<GatewayFormState>(emptyForm);
    const [formError, setFormError] = useState<unknown>(null);
    const [saving, setSaving] = useState(false);

    const [deleting, setDeleting] = useState<GatewayConfig | null>(null);
    const [deleteError, setDeleteError] = useState<unknown>(null);

    const [logs, setLogs] = useState<Record<string, ProgressEntry[]>>({});
    const [expanded, setExpanded] = useState<Set<string>>(new Set());
    const [deployingIds, setDeployingIds] = useState<Set<string>>(new Set());

    const loadGateways = useCallback(async () => {
        setLoading(true);
        setLoadError(null);
        try {
            const [gatewayData, platformData] = await Promise.all([
                api.gateways.list({ page, pageSize }),
                api.platforms.list({ page: 1, pageSize: platformPageSize }),
            ]);
            setResult(gatewayData);
            setPlatforms(platformData.data);
            setPlatformById(
                Object.fromEntries(
                    platformData.data.map((platform) => [
                        platform.id,
                        platform,
                    ]),
                ),
            );
            if (
                gatewayData.totalPages > 0 &&
                page > gatewayData.totalPages
            ) {
                setPage(gatewayData.totalPages);
            }
        } catch (error) {
            setResult(null);
            setPlatforms([]);
            setPlatformById({});
            setLoadError(error);
        } finally {
            setLoading(false);
        }
    }, [api.gateways, api.platforms, page]);

    useEffect(() => {
        const timeout = window.setTimeout(() => void loadGateways(), 0);
        return () => window.clearTimeout(timeout);
    }, [loadGateways]);

    const channels = useMemo(
        () =>
            (result?.data ?? [])
                .filter(
                    (g) =>
                        PROGRESSING_STATUS.includes(g.status) ||
                        deployingIds.has(g.id),
                )
                .map((g) => `gateway:${g.id}`),
        [deployingIds, result],
    );

    const handleEvent = useCallback(
        (channel: string, event: string, data: unknown) => {
            const match = channel.match(/^gateway:(.+)$/);
            if (!match) return;
            const id = match[1];
            const payload = (data ?? {}) as {
                step?: string;
                message?: string;
                status?: string;
            };

            if (event === "progress") {
                const step = payload.step ?? "progress";
                const message = payload.message ?? "";
                setLogs((prev) => {
                    const list = prev[id] ? [...prev[id]] : [];
                    const idx = list.findIndex(
                        (e) => e.step === step && e.state === "running",
                    );
                    if (idx >= 0) {
                        list[idx] = { ...list[idx], message };
                    } else {
                        list.push({ step, message, state: "running" });
                    }
                    return { ...prev, [id]: list };
                });
                return;
            }

            if (event === "failed") {
                setDeployingIds((prev) => {
                    const next = new Set(prev);
                    next.delete(id);
                    return next;
                });
                setExpanded((prev) => {
                    const next = new Set(prev);
                    next.add(id);
                    return next;
                });
                setResult((current) =>
                    current
                        ? {
                              ...current,
                              data: current.data.map((gateway) =>
                                  gateway.id === id
                                      ? {
                                            ...gateway,
                                            pendingChanges: true,
                                            status: gateway.status === "STARTING"
                                                ? "HEALTHY"
                                                : gateway.status,
                                        }
                                      : gateway,
                              ),
                          }
                        : current,
                );
                setLogs((prev) => {
                    const finished = (prev[id] ?? []).map((e) =>
                        e.state === "running"
                            ? { ...e, state: "failed" as const }
                            : e,
                    );
                    return {
                        ...prev,
                        [id]: [
                            ...finished,
                            {
                                step: payload.step ?? "failed",
                                message:
                                    payload.message ??
                                    t("gateways.fallback.deployFailed"),
                                state: "failed",
                            },
                        ],
                    };
                });
                notify.error(new Error("Gateway deployment failed"), {
                    titleKey: "gateways.fallback.deployFailed",
                });
            } else if (payload.status === "DELETED") {
                setDeployingIds((prev) => {
                    const next = new Set(prev);
                    next.delete(id);
                    return next;
                });
                setLogs((prev) => {
                    const list = (prev[id] ?? []).map((e) =>
                        e.state === "running"
                            ? { ...e, state: "done" as const }
                            : e,
                    );
                    return { ...prev, [id]: list };
                });
                notify.success("gateways.success.deleted");
                setSuccessKey("gateways.success.deleted");
            } else {
                setDeployingIds((prev) => {
                    const next = new Set(prev);
                    next.delete(id);
                    return next;
                });
                setResult((current) =>
                    current
                        ? {
                              ...current,
                              data: current.data.map((gateway) =>
                                  gateway.id === id
                                      ? {
                                            ...gateway,
                                            pendingChanges: false,
                                            status:
                                                (payload.status as
                                                    | GatewayStatus
                                                    | undefined) ??
                                                gateway.status,
                                        }
                                      : gateway,
                              ),
                          }
                        : current,
                );
                setLogs((prev) => {
                    const list = (prev[id] ?? []).map((e) =>
                        e.state === "running"
                            ? { ...e, state: "done" as const }
                            : e,
                    );
                    return { ...prev, [id]: list };
                });
                notify.success("gateways.success.deployed");
                setSuccessKey("gateways.success.deployed");
            }
            window.setTimeout(() => void loadGateways(), 1200);
        },
        [loadGateways, notify, t],
    );

    useEventStream({ channels, onEvent: handleEvent });

    function openCreate() {
        setEditing(null);
        setForm({ ...emptyForm });
        setFormError(null);
        setFormOpen(true);
    }

    function openEdit(gateway: GatewayConfig) {
        setEditing(gateway);
        setForm({
            name: gateway.name,
            description: gateway.description ?? "",
            platformId: gateway.platformId,
            appVersion: gateway.appVersion ?? "",
            containerImage: gateway.containerImage ?? "nginx:alpine",
            configContent: gateway.configContent ?? "",
        });
        setFormError(null);
        setFormOpen(true);
    }

    function updateForm<Key extends keyof GatewayFormState>(
        key: Key,
        value: GatewayFormState[Key],
    ) {
        setForm((current) => ({ ...current, [key]: value }));
    }

    const selectedPlatformType: PlatformType | undefined = form.platformId
        ? platformById[form.platformId]?.platformType
        : undefined;

    function buildRequest():
        | AddGatewayConfigRequest
        | UpdateGatewayConfigRequest {
        const base = {
            name: form.name.trim(),
            description: form.description.trim(),
            configContent: form.configContent,
        };
        if (editing) {
            const update: UpdateGatewayConfigRequest = { ...base };
            if (selectedPlatformType === "DOCKER") {
                update.containerImage = form.containerImage.trim();
            } else {
                update.appVersion = form.appVersion.trim();
            }
            return update;
        }
        const create: AddGatewayConfigRequest = {
            ...base,
            platformId: form.platformId,
        };
        if (selectedPlatformType === "DOCKER") {
            create.containerImage = form.containerImage.trim();
        } else {
            create.appVersion = form.appVersion.trim();
        }
        return create;
    }

    async function saveGateway(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();
        setSaving(true);
        setFormError(null);
        try {
            const body = buildRequest();
            if (editing) {
                await api.gateways.update(editing.id, body);
                setSuccessKey("gateways.success.updated");
                notify.success("gateways.success.updated");
            } else {
                await api.gateways.create(body as AddGatewayConfigRequest);
                setSuccessKey("gateways.success.created");
                notify.success("gateways.success.created");
                setPage(1);
            }
            setFormOpen(false);
            await loadGateways();
        } catch (saveError) {
            setFormError(saveError);
        } finally {
            setSaving(false);
        }
    }

    async function deleteGateway() {
        if (!deleting) return;
        setSaving(true);
        setDeleteError(null);
        try {
            await api.gateways.remove(deleting.id);
            setDeleting(null);
            await loadGateways();
        } catch (error) {
            setDeleteError(error);
        } finally {
            setSaving(false);
        }
    }

    async function deployGateway(gateway: GatewayConfig) {
        setDeployingIds((prev) => {
            const next = new Set(prev);
            next.add(gateway.id);
            return next;
        });
        setExpanded((prev) => {
            const next = new Set(prev);
            next.add(gateway.id);
            return next;
        });
        setLogs((prev) => ({ ...prev, [gateway.id]: [] }));
        try {
            await api.gateways.deploy(gateway.id);
            setResult((current) =>
                current
                    ? {
                          ...current,
                          data: current.data.map((item) =>
                              item.id === gateway.id
                                  ? {
                                        ...item,
                                        status: "STARTING",
                                        pendingChanges: false,
                                    }
                                  : item,
                          ),
                      }
                    : current,
            );
            notify.success("gatewayDetail.success.deployStarted");
        } catch (deployError) {
            setDeployingIds((prev) => {
                const next = new Set(prev);
                next.delete(gateway.id);
                return next;
            });
            setLogs((prev) => ({
                ...prev,
                [gateway.id]: [
                    ...(prev[gateway.id] ?? []),
                    {
                        step: "failed",
                        message: notify.describe(deployError).text,
                        state: "failed",
                    },
                ],
            }));
            notify.error(new Error("Gateway deployment failed"), {
                titleKey: "gateways.fallback.deployFailed",
            });
        }
    }

    function toggleExpand(id: string) {
        setExpanded((prev) => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
        });
    }

    return (
        <div className="space-y-6">
            <PageHeader
                eyebrow={t("gateways.eyebrow")}
                title={t("gateways.title")}
                description={t("gateways.description")}
                action={
                    <Button onClick={openCreate}>
                        <Plus />
                        {t("gateways.addButton")}
                    </Button>
                }
            />

            {successKey ? <SuccessBanner messageKey={successKey} /> : null}
            <ErrorBanner
                error={loadError}
                fallbackKey="gateways.fallback.loadFailed"
            />

            <section className="w-full max-w-full overflow-hidden rounded-xl border bg-card shadow-sm">
                {loading ? (
                    <LoadingState />
                ) : !result?.data.length ? (
                    <EmptyState
                        title={t("gateways.empty.title")}
                        description={t("gateways.empty.description")}
                    />
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full min-w-[980px] text-left text-sm">
                            <thead className="border-b bg-muted/45 text-xs text-muted-foreground">
                                <tr>
                                    <th className="px-4 py-3 font-medium">
                                        {t("gateways.columns.name")}
                                    </th>
                                    <th className="px-4 py-3 font-medium">
                                        {t("gateways.columns.platform")}
                                    </th>
                                    <th className="px-4 py-3 font-medium">
                                        {t("gateways.columns.version")}
                                    </th>
                                    <th className="px-4 py-3 font-medium">
                                        {t("gateways.columns.status")}
                                    </th>
                                    <th className="px-4 py-3 font-medium">
                                        {t("gateways.columns.updatedAt")}
                                    </th>
                                    <th className="w-12 px-4 py-3" />
                                </tr>
                            </thead>
                            <tbody className="divide-y">
                                {result.data.map((gateway) => {
                                    const platform =
                                        platformById[gateway.platformId];
                                    const inProgress =
                                        PROGRESSING_STATUS.includes(
                                            gateway.status,
                                        );
                                    const isExpanded =
                                        inProgress || expanded.has(gateway.id);
                                    return (
                                        <GatewayRow
                                            key={gateway.id}
                                            gateway={gateway}
                                            platform={platform}
                                            entries={logs[gateway.id] ?? []}
                                            isExpanded={isExpanded}
                                            onToggleExpand={() =>
                                                toggleExpand(gateway.id)
                                            }
                                            onEdit={() => openEdit(gateway)}
                                            onDeploy={
                                                gateway.pendingChanges
                                                    ? () => void deployGateway(gateway)
                                                    : undefined
                                            }
                                            onDelete={() => {
                                                setDeleteError(null);
                                                setDeleting(gateway);
                                            }}
                                        />
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                )}
                {result ? (
                    <Pagination
                        page={result.page}
                        totalPages={result.totalPages}
                        totalData={result.totalData}
                        onPageChange={setPage}
                    />
                ) : null}
            </section>

            <Dialog open={formOpen} onOpenChange={setFormOpen}>
                <DialogContent className="max-w-xl">
                    <form onSubmit={saveGateway} className="space-y-5">
                        <DialogHeader>
                            <DialogTitle>
                                {editing
                                    ? t("gateways.form.editTitle")
                                    : t("gateways.form.createTitle")}
                            </DialogTitle>
                            <DialogDescription>
                                {editing
                                    ? t("gateways.form.editDescription")
                                    : t("gateways.form.createDescription")}
                            </DialogDescription>
                        </DialogHeader>

                        <div className="grid gap-4">
                            <Field
                                label={t("gateways.form.name")}
                                htmlFor="gateway-name"
                            >
                                <Input
                                    id="gateway-name"
                                    required
                                    placeholder={t(
                                        "gateways.form.namePlaceholder",
                                    )}
                                    value={form.name}
                                    onChange={(event) =>
                                        updateForm("name", event.target.value)
                                    }
                                />
                            </Field>
                            <Field
                                label={t("gateways.form.descriptionField")}
                                htmlFor="gateway-description"
                            >
                                <Input
                                    id="gateway-description"
                                    placeholder={t(
                                        "gateways.form.descriptionPlaceholder",
                                    )}
                                    value={form.description}
                                    onChange={(event) =>
                                        updateForm(
                                            "description",
                                            event.target.value,
                                        )
                                    }
                                />
                            </Field>
                            <Field
                                label={t("gateways.form.platform")}
                                htmlFor="gateway-platform"
                            >
                                <select
                                    id="gateway-platform"
                                    className={controlClass}
                                    disabled={Boolean(editing)}
                                    required={!editing}
                                    value={form.platformId}
                                    onChange={(event) =>
                                        updateForm(
                                            "platformId",
                                            event.target.value,
                                        )
                                    }
                                >
                                    <option value="">
                                        {t(
                                            "gateways.form.platformPlaceholder",
                                        )}
                                    </option>
                                    {platforms.map((platform) => (
                                        <option
                                            key={platform.id}
                                            value={platform.id}
                                        >
                                            {platform.name} ·{" "}
                                            {t(
                                                `platforms.type.${platform.platformType}`,
                                            )}
                                        </option>
                                    ))}
                                </select>
                            </Field>

                            {selectedPlatformType === "DOCKER" ? (
                                <div className="grid gap-4">
                                    <Field
                                        label={t(
                                            "gateways.form.containerImage",
                                        )}
                                        htmlFor="gateway-image"
                                    >
                                        <Input
                                            id="gateway-image"
                                            required
                                            placeholder={t(
                                                "gateways.form.containerImagePlaceholder",
                                            )}
                                            value={form.containerImage}
                                            onChange={(event) =>
                                                updateForm(
                                                    "containerImage",
                                                    event.target.value,
                                                )
                                            }
                                        />
                                    </Field>
                                </div>
                            ) : selectedPlatformType === "HOST" ? (
                                <Field
                                    label={t("gateways.form.appVersion")}
                                    htmlFor="gateway-version"
                                >
                                    <Input
                                        id="gateway-version"
                                        required
                                        placeholder={t(
                                            "gateways.form.appVersionPlaceholder",
                                        )}
                                        value={form.appVersion}
                                        onChange={(event) =>
                                            updateForm(
                                                "appVersion",
                                                event.target.value,
                                            )
                                        }
                                    />
                                </Field>
                            ) : null}

                            <Field
                                label={t("gateways.form.configContent")}
                                htmlFor="gateway-config-content"
                            >
                                <CodeEditor
                                    id="gateway-config-content"
                                    language="ini"
                                    height={200}
                                    value={form.configContent}
                                    onChange={(next) =>
                                        updateForm("configContent", next)
                                    }
                                    accept=".conf,text/plain"
                                    onUploadError={notify.error}
                                />
                                <p className="text-xs text-muted-foreground">
                                    {t("gateways.form.configContentHint")}
                                </p>
                            </Field>
                        </div>

                        <ErrorBanner
                            error={formError}
                            fallbackKey="gateways.fallback.saveFailed"
                        />
                        <DialogFooter>
                            <Button
                                type="button"
                                variant="outline"
                                onClick={() => setFormOpen(false)}
                            >
                                {t("common.cancel")}
                            </Button>
                            <Button type="submit" disabled={saving}>
                                {saving
                                    ? t("common.saving")
                                    : editing
                                      ? t("gateways.form.submitEdit")
                                      : t("gateways.form.submitCreate")}
                            </Button>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>

            <Dialog
                open={Boolean(deleting)}
                onOpenChange={(open) => {
                    if (!open) setDeleting(null);
                }}
            >
                <DialogContent className="max-w-md">
                    <DialogHeader>
                        <DialogTitle>
                            {t("gateways.deleteDialog.title")}
                        </DialogTitle>
                        <DialogDescription>
                            {t("gateways.deleteDialog.description", {
                                name: deleting?.name ?? "",
                            })}
                        </DialogDescription>
                    </DialogHeader>
                    <ErrorBanner
                        error={deleteError}
                        fallbackKey="gateways.fallback.deleteFailed"
                    />
                    <DialogFooter>
                        <Button
                            type="button"
                            variant="outline"
                            onClick={() => setDeleting(null)}
                        >
                            {t("common.cancel")}
                        </Button>
                        <Button
                            type="button"
                            variant="destructive"
                            disabled={saving}
                            onClick={() => void deleteGateway()}
                        >
                            {saving
                                ? t("common.deleting")
                                : t("gateways.deleteDialog.confirm")}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}

function GatewayRow({
    gateway,
    platform,
    entries,
    isExpanded,
    onToggleExpand,
    onEdit,
    onDeploy,
    onDelete,
}: {
    gateway: GatewayConfig;
    platform: AppPlatform | undefined;
    entries: ProgressEntry[];
    isExpanded: boolean;
    onToggleExpand: () => void;
    onEdit: () => void;
    onDeploy?: () => void;
    onDelete: () => void;
}) {
    const { t } = useTranslation();
    const platformType = platform?.platformType;
    const inProgress = PROGRESSING_STATUS.includes(gateway.status);
    const version =
        platformType === "DOCKER"
            ? gateway.containerImage
            : gateway.appVersion;

    return (
        <>
            <tr className="transition-colors hover:bg-muted/25">
                <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                        <span className="grid size-8 shrink-0 place-items-center rounded-lg border bg-background">
                            <Network className="size-4 text-muted-foreground" />
                        </span>
                        <div className="min-w-0">
                            <p className="font-medium">{gateway.name}</p>
                            <p className="max-w-52 truncate text-xs text-muted-foreground">
                                {gateway.description ||
                                    t("gateways.eyebrow")}
                            </p>
                        </div>
                    </div>
                </td>
                <td className="px-4 py-3">
                    {platform ? (
                        <div className="flex items-center gap-2">
                            {platformType === "DOCKER" ? (
                                <Container className="size-4 text-muted-foreground" />
                            ) : (
                                <Server className="size-4 text-muted-foreground" />
                            )}
                            <div className="min-w-0">
                                <p className="truncate text-xs font-medium">
                                    {platform.name}
                                </p>
                                <p className="text-xs text-muted-foreground">
                                    {t(`platforms.type.${platformType}`)}
                                </p>
                            </div>
                        </div>
                    ) : (
                        <span className="text-xs text-muted-foreground">
                            {t("common.dash")}
                        </span>
                    )}
                </td>
                <td className="px-4 py-3">
                    <p
                        className="max-w-56 truncate font-mono text-xs"
                        title={version ?? undefined}
                    >
                        {version || t("common.dash")}
                    </p>
                </td>
                <td className="px-4 py-3">
                    <StatusBadge
                        status={gateway.status}
                        pendingChanges={gateway.pendingChanges}
                    />
                </td>
                <td className="px-4 py-3 text-xs text-muted-foreground">
                    {formatDate(gateway.updatedAt)}
                </td>
                <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-1">
                        <Button
                            asChild
                            variant="ghost"
                            size="icon-sm"
                        >
                            <Link
                                to={`/gateways/${gateway.id}`}
                                aria-label={t("gateways.actions.manage")}
                            >
                                <SlidersHorizontal className="size-4" />
                            </Link>
                        </Button>
                        <Button
                            variant="ghost"
                            size="icon-sm"
                            onClick={onToggleExpand}
                            aria-label={t("gateways.actions.toggleLog")}
                        >
                            <ChevronRight
                                className={cn(
                                    "size-4 transition-transform",
                                    isExpanded && "rotate-90",
                                )}
                            />
                        </Button>
                        <Button
                            variant="ghost"
                            size="icon-sm"
                            onClick={onEdit}
                            aria-label={t("common.edit")}
                        >
                            <Pencil className="size-4" />
                        </Button>
                        {onDeploy && !inProgress ? (
                            <Button
                                variant="ghost"
                                size="icon-sm"
                                onClick={onDeploy}
                                aria-label={t("gateways.actions.deploy")}
                            >
                                <RefreshCw className="size-4" />
                            </Button>
                        ) : null}
                        <Button
                            variant="ghost"
                            size="icon-sm"
                            onClick={onDelete}
                            aria-label={t("common.delete")}
                        >
                            <Trash2 className="size-4" />
                        </Button>
                    </div>
                </td>
            </tr>
            {isExpanded ? (
                <tr>
                    <td colSpan={6} className="bg-muted/25 px-4 py-3">
                        <ProgressLog entries={entries} inProgress={inProgress} />
                    </td>
                </tr>
            ) : null}
        </>
    );
}

function StatusBadge({
    status,
    pendingChanges = false,
}: {
    status: GatewayStatus;
    pendingChanges?: boolean;
}) {
    const { t } = useTranslation();
    const config = statusConfig(status);
    return (
        <span className="inline-flex flex-wrap items-center gap-2 text-xs font-medium">
            <span className="inline-flex items-center gap-2 whitespace-nowrap">
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
            {pendingChanges ? (
                <span className="rounded border border-amber-300/70 bg-amber-50 px-1.5 py-0.5 text-[0.68rem] text-amber-700">
                    {t("gateways.status.pendingChanges")}
                </span>
            ) : null}
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
                    : t("gateways.progress.idle")}
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
                            {t(`gateways.step.${entry.step}`, undefined, entry.step)}
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

function Field({
    label,
    htmlFor,
    children,
}: {
    label: string;
    htmlFor: string;
    children: ReactNode;
}) {
    return (
        <div className="space-y-2">
            <Label htmlFor={htmlFor}>{label}</Label>
            {children}
        </div>
    );
}
