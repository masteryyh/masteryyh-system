import {
    useEffect,
    useRef,
    useState,
    type FormEvent,
    type ReactNode,
} from "react";
import {
    ChevronRight,
    FileArchive,
    Globe2,
    LockKeyhole,
    Pencil,
    Plus,
    ServerCog,
    Trash2,
    Upload,
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useApi } from "@/hooks/use-api";
import { useNotify } from "@/hooks/use-notify";
import { useTranslation } from "@/hooks/use-translation";
import { cn } from "@/lib/utils";
import { SectionCard } from "@/features/platforms/panel-primitives";
import type {
    Credential,
    GatewayEntryPoint,
    GatewayRoute,
    GatewayRouteType,
} from "@/types/api";
import { useGatewayDetailContext } from "./use-gateway-detail-context";

const controlClass =
    "h-9 w-full rounded-lg border border-input bg-transparent px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50";

interface EntryFormState {
    name: string;
    listenPort: string;
    domains: string;
    certificateCredentialId: string;
    wsEnabled: boolean;
    clientMaxBodySize: string;
}

interface RouteFormState {
    name: string;
    pathPrefix: string;
    routeType: GatewayRouteType;
    priority: string;
    proxyTarget: string;
    staticFileId: string;
    wsMode: "inherit" | "enable" | "disable";
    clientMaxBodySize: string;
}

const emptyEntryForm: EntryFormState = {
    name: "",
    listenPort: "80",
    domains: "",
    certificateCredentialId: "",
    wsEnabled: false,
    clientMaxBodySize: "",
};

const emptyRouteForm: RouteFormState = {
    name: "",
    pathPrefix: "/",
    routeType: "PROXY",
    priority: "0",
    proxyTarget: "",
    staticFileId: "",
    wsMode: "inherit",
    clientMaxBodySize: "",
};

function certificateCredentials(credentials: Credential[]) {
    return credentials.filter(
        (credential) => credential.credentialType === "X509_CERTIFICATE",
    );
}

export function GatewayRoutesPanel() {
    const {
        gateway,
        gatewayId,
        entryPoints,
        routes,
        files,
        credentials,
        reload,
    } = useGatewayDetailContext();
    const api = useApi();
    const notify = useNotify();
    const { t } = useTranslation();

    const [expanded, setExpanded] = useState<Set<string>>(new Set());
    const initialized = useRef(false);

    const [entryDialog, setEntryDialog] = useState(false);
    const [routeDialog, setRouteDialog] = useState(false);
    const [editingEntry, setEditingEntry] = useState<GatewayEntryPoint | null>(
        null,
    );
    const [editingRoute, setEditingRoute] = useState<GatewayRoute | null>(null);
    const [routeContextEntryId, setRouteContextEntryId] = useState("");
    const [saving, setSaving] = useState(false);
    const [formError, setFormError] = useState<unknown>(null);
    const [entryForm, setEntryForm] =
        useState<EntryFormState>(emptyEntryForm);
    const [routeForm, setRouteForm] =
        useState<RouteFormState>(emptyRouteForm);

    // 默认展开第一个入口（仅初始化一次）
    useEffect(() => {
        if (!initialized.current && entryPoints.length) {
            initialized.current = true;
            setExpanded(new Set([entryPoints[0].id]));
        }
    }, [entryPoints]);

    function toggleExpand(id: string) {
        setExpanded((prev) => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
        });
    }

    async function openEntry(entry?: GatewayEntryPoint) {
        setEditingEntry(entry ?? null);
        setEntryForm(
            entry
                ? {
                      name: entry.name,
                      listenPort: String(entry.listenPort),
                      domains: entry.domainNames.join(", "),
                      certificateCredentialId:
                          entry.certificateCredentialId ?? "",
                      wsEnabled: entry.extraConfig?.webSocket ?? false,
                      clientMaxBodySize:
                          entry.extraConfig?.clientMaxBodySize ?? "",
                  }
                : { ...emptyEntryForm },
        );
        setFormError(null);
        setEntryDialog(true);
    }

    function openRoute(entryId: string, route?: GatewayRoute) {
        setRouteContextEntryId(entryId);
        setEditingRoute(route ?? null);
        setRouteForm(
            route
                ? {
                      name: route.name,
                      pathPrefix: route.pathPrefix,
                      routeType: route.routeType,
                      priority: String(route.priority),
                      proxyTarget: route.proxyTarget ?? "",
                      staticFileId: route.staticFileId ?? "",
                      wsMode:
                          route.extraConfig?.webSocket == null
                              ? "inherit"
                              : route.extraConfig.webSocket
                                ? "enable"
                                : "disable",
                      clientMaxBodySize:
                          route.extraConfig?.clientMaxBodySize ?? "",
                  }
                : { ...emptyRouteForm },
        );
        setFormError(null);
        setRouteDialog(true);
    }

    function updateEntryCertificate(certificateCredentialId: string) {
        setEntryForm((current) => ({
            ...current,
            certificateCredentialId,
            listenPort: editingEntry
                ? current.listenPort
                : certificateCredentialId
                  ? "443"
                  : "80",
        }));
    }

    async function saveEntry(event: FormEvent) {
        event.preventDefault();
        setSaving(true);
        setFormError(null);
        const body = {
            name: entryForm.name.trim(),
            listenPort: Number(entryForm.listenPort),
            domainNames: entryForm.domains
                .split(",")
                .map((domain) => domain.trim())
                .filter(Boolean),
            certificateCredentialId:
                entryForm.certificateCredentialId || null,
            extraConfig: {
                webSocket: entryForm.wsEnabled,
                clientMaxBodySize: entryForm.clientMaxBodySize.trim() || null,
            },
        };
        try {
            if (editingEntry) {
                await api.gateways.updateEntryPoint(
                    gatewayId,
                    editingEntry.id,
                    body,
                );
            } else {
                await api.gateways.createEntryPoint(gatewayId, body);
            }
            setEntryDialog(false);
            notify.success("gatewayDetail.success.entrySaved");
            await reload();
        } catch (saveError) {
            setFormError(saveError);
        } finally {
            setSaving(false);
        }
    }

    async function saveRoute(event: FormEvent) {
        event.preventDefault();
        if (!routeContextEntryId) return;
        setSaving(true);
        setFormError(null);
        const body = {
            name: routeForm.name.trim(),
            pathPrefix: routeForm.pathPrefix.trim(),
            routeType: routeForm.routeType,
            priority: Number(routeForm.priority),
            proxyTarget:
                routeForm.routeType === "PROXY"
                    ? routeForm.proxyTarget.trim()
                    : null,
            staticFileId:
                routeForm.routeType === "STATIC"
                    ? routeForm.staticFileId
                    : null,
            extraConfig: {
                webSocket:
                    routeForm.wsMode === "inherit"
                        ? null
                        : routeForm.wsMode === "enable",
                clientMaxBodySize:
                    routeForm.clientMaxBodySize.trim() || null,
            },
        };
        try {
            if (editingRoute) {
                await api.gateways.updateRoute(
                    gatewayId,
                    routeContextEntryId,
                    editingRoute.id,
                    body,
                );
            } else {
                await api.gateways.createRoute(
                    gatewayId,
                    routeContextEntryId,
                    body,
                );
            }
            setRouteDialog(false);
            notify.success("gatewayDetail.success.routeSaved");
            await reload();
        } catch (saveError) {
            setFormError(saveError);
        } finally {
            setSaving(false);
        }
    }

    async function uploadStatic(file: File) {
        setSaving(true);
        setFormError(null);
        try {
            const stored = await api.files.create(
                `${gateway?.name ?? "gateway"}-${file.name}-${Date.now()}`,
                t("gatewayDetail.route.uploadDescription"),
                file,
            );
            setRouteForm((current) => ({
                ...current,
                routeType: "STATIC",
                staticFileId: stored.id,
            }));
            // 上传后刷新文件列表（reload 会同步 files 到 context）
            await reload();
        } catch (uploadError) {
            setFormError(uploadError);
        } finally {
            setSaving(false);
        }
    }

    async function removeEntry(entry: GatewayEntryPoint) {
        if (
            !window.confirm(
                t("gatewayDetail.entry.deleteConfirm", { name: entry.name }),
            )
        )
            return;
        await api.gateways.removeEntryPoint(gatewayId, entry.id);
        notify.success("gatewayDetail.success.entryDeleted");
        await reload();
    }

    async function removeRoute(entryId: string, route: GatewayRoute) {
        if (
            !window.confirm(
                t("gatewayDetail.route.deleteConfirm", { name: route.name }),
            )
        )
            return;
        await api.gateways.removeRoute(gatewayId, entryId, route.id);
        notify.success("gatewayDetail.success.routeDeleted");
        await reload();
    }

    const certCredentials = certificateCredentials(credentials);

    return (
        <SectionCard
            title={t("gatewayDetail.nav.routes")}
            description={t("gatewayDetail.route.description")}
            action={
                <Button size="sm" onClick={() => void openEntry()}>
                    <Plus />
                    {t("gatewayDetail.entry.add")}
                </Button>
            }
            bodyClassName="p-0"
        >
            {entryPoints.length === 0 ? (
                <div className="grid min-h-40 place-items-center px-4 py-10 text-sm text-muted-foreground">
                    {t("gatewayDetail.entry.empty")}
                </div>
            ) : (
                <ul className="divide-y">
                    {entryPoints.map((entry) => {
                        const isExpanded = expanded.has(entry.id);
                        const entryRoutes = routes[entry.id] ?? [];
                        const changed =
                            (entry.currentConfigContent ?? "") !==
                            (entry.lastConfigContent ?? "");
                        return (
                            <li key={entry.id}>
                                <div
                                    role="button"
                                    tabIndex={0}
                                    onClick={() => toggleExpand(entry.id)}
                                    onKeyDown={(event) => {
                                        if (
                                            event.key === "Enter" ||
                                            event.key === " "
                                        ) {
                                            event.preventDefault();
                                            toggleExpand(entry.id);
                                        }
                                    }}
                                    className={cn(
                                        "flex cursor-pointer items-center gap-3 px-3 py-2.5 transition-colors hover:bg-muted/30",
                                        isExpanded && "bg-muted/20",
                                    )}
                                >
                                    <ChevronRight
                                        className={cn(
                                            "size-4 shrink-0 text-muted-foreground transition-transform",
                                            isExpanded && "rotate-90",
                                        )}
                                    />
                                    {entry.certificateCredentialId ? (
                                        <LockKeyhole className="size-4 shrink-0 text-violet-600" />
                                    ) : (
                                        <Globe2 className="size-4 shrink-0 text-blue-600" />
                                    )}
                                    <span className="min-w-0 shrink-0 font-medium">
                                        {entry.name}
                                    </span>
                                    <span className="shrink-0 font-mono text-xs text-blue-700">
                                        :{entry.listenPort}
                                    </span>
                                    <span className="hidden shrink-0 rounded border bg-muted/40 px-1.5 py-0.5 text-[0.68rem] font-medium text-muted-foreground sm:inline">
                                        {entry.certificateCredentialId
                                            ? "HTTPS"
                                            : "HTTP"}
                                    </span>
                                    <span
                                        className="min-w-0 flex-1 truncate font-mono text-[0.68rem] text-muted-foreground"
                                        title={entry.domainNames.join(", ")}
                                    >
                                        {entry.domainNames.join(" · ")}
                                    </span>
                                    {changed ? (
                                        <span className="hidden shrink-0 rounded border border-amber-300/70 bg-amber-50 px-1.5 py-0.5 text-[0.68rem] text-amber-700 md:inline">
                                            {t("gatewayDetail.deploy.changed")}
                                        </span>
                                    ) : null}
                                    <span className="hidden shrink-0 text-xs text-muted-foreground lg:inline">
                                        {t("gatewayDetail.entry.routeCount", {
                                            count: entryRoutes.length,
                                        })}
                                    </span>
                                    <div
                                        className="flex shrink-0 items-center gap-1"
                                        onClick={(event) =>
                                            event.stopPropagation()
                                        }
                                    >
                                        <Button
                                            variant="ghost"
                                            size="icon-sm"
                                            onClick={() =>
                                                void openEntry(entry)
                                            }
                                            aria-label={t("common.edit")}
                                        >
                                            <Pencil className="size-4" />
                                        </Button>
                                        <Button
                                            variant="ghost"
                                            size="icon-sm"
                                            onClick={() =>
                                                void removeEntry(entry)
                                            }
                                            aria-label={t("common.delete")}
                                        >
                                            <Trash2 className="size-4" />
                                        </Button>
                                    </div>
                                </div>

                                {isExpanded ? (
                                    <RoutesTable
                                        routes={entryRoutes}
                                        files={files}
                                        onAdd={() => openRoute(entry.id)}
                                        onEdit={(route) =>
                                            openRoute(entry.id, route)
                                        }
                                        onRemove={(route) =>
                                            void removeRoute(entry.id, route)
                                        }
                                    />
                                ) : null}
                            </li>
                        );
                    })}
                </ul>
            )}

            <Dialog open={entryDialog} onOpenChange={setEntryDialog}>
                <DialogContent className="max-w-lg">
                    <form onSubmit={saveEntry} className="space-y-5">
                        <DialogHeader>
                            <DialogTitle>
                                {editingEntry
                                    ? t("gatewayDetail.entry.edit")
                                    : t("gatewayDetail.entry.create")}
                            </DialogTitle>
                            <DialogDescription>
                                {t("gatewayDetail.entry.formDescription")}
                            </DialogDescription>
                        </DialogHeader>
                        <div className="grid gap-4">
                            <Field
                                label={t("gatewayDetail.entry.name")}
                                htmlFor="entry-name"
                            >
                                <Input
                                    id="entry-name"
                                    required
                                    value={entryForm.name}
                                    onChange={(event) =>
                                        setEntryForm({
                                            ...entryForm,
                                            name: event.target.value,
                                        })
                                    }
                                />
                            </Field>
                            <div className="grid gap-4 sm:grid-cols-2">
                                <Field
                                    label={t("gatewayDetail.entry.port")}
                                    htmlFor="entry-port"
                                >
                                    <Input
                                        id="entry-port"
                                        type="number"
                                        min={1}
                                        max={65535}
                                        required
                                        value={entryForm.listenPort}
                                        onChange={(event) =>
                                            setEntryForm({
                                                ...entryForm,
                                                listenPort: event.target.value,
                                            })
                                        }
                                    />
                                </Field>
                                <Field
                                    label={t("gatewayDetail.entry.certificate")}
                                    htmlFor="entry-cert"
                                >
                                    <select
                                        id="entry-cert"
                                        className={controlClass}
                                        value={
                                            entryForm.certificateCredentialId
                                        }
                                        onChange={(event) =>
                                            updateEntryCertificate(
                                                event.target.value,
                                            )
                                        }
                                    >
                                        <option value="">
                                            {t(
                                                "gatewayDetail.entry.noCertificate",
                                            )}
                                        </option>
                                        {certCredentials.map((credential) => (
                                            <option
                                                key={credential.id}
                                                value={credential.id}
                                            >
                                                {credential.name}
                                            </option>
                                        ))}
                                    </select>
                                </Field>
                            </div>
                            <Field
                                label={t("gatewayDetail.entry.domains")}
                                htmlFor="entry-domains"
                            >
                                <Input
                                    id="entry-domains"
                                    required
                                    placeholder="example.com, *.lab.example.com"
                                    value={entryForm.domains}
                                    onChange={(event) =>
                                        setEntryForm({
                                            ...entryForm,
                                            domains: event.target.value,
                                        })
                                    }
                                />
                            </Field>
                            <div className="rounded-lg border bg-muted/20 p-3">
                                <p className="mb-3 text-xs font-medium text-muted-foreground">
                                    {t("gatewayDetail.entry.extraConfig.title")}
                                </p>
                                <div className="grid gap-4 sm:grid-cols-2">
                                    <Field
                                        label={t(
                                            "gatewayDetail.entry.extraConfig.webSocket",
                                        )}
                                        htmlFor="entry-ws"
                                    >
                                        <select
                                            id="entry-ws"
                                            className={controlClass}
                                            value={String(entryForm.wsEnabled)}
                                            onChange={(event) =>
                                                setEntryForm({
                                                    ...entryForm,
                                                    wsEnabled:
                                                        event.target.value ===
                                                        "true",
                                                })
                                            }
                                        >
                                            <option value="false">
                                                {t(
                                                    "gatewayDetail.entry.extraConfig.disabled",
                                                )}
                                            </option>
                                            <option value="true">
                                                {t(
                                                    "gatewayDetail.entry.extraConfig.enabled",
                                                )}
                                            </option>
                                        </select>
                                    </Field>
                                    <Field
                                        label={t(
                                            "gatewayDetail.entry.extraConfig.clientMaxBodySize",
                                        )}
                                        htmlFor="entry-body"
                                    >
                                        <Input
                                            id="entry-body"
                                            placeholder="100m / 0"
                                            value={entryForm.clientMaxBodySize}
                                            onChange={(event) =>
                                                setEntryForm({
                                                    ...entryForm,
                                                    clientMaxBodySize:
                                                        event.target.value,
                                                })
                                            }
                                        />
                                        <p className="text-[0.7rem] text-muted-foreground">
                                            {t(
                                                "gatewayDetail.entry.extraConfig.clientMaxBodySizeHint",
                                            )}
                                        </p>
                                    </Field>
                                </div>
                            </div>
                        </div>
                        <ErrorBanner
                            error={formError}
                            fallbackKey="gatewayDetail.saveFailed"
                        />
                        <DialogFooter>
                            <Button
                                type="button"
                                variant="outline"
                                onClick={() => setEntryDialog(false)}
                            >
                                {t("common.cancel")}
                            </Button>
                            <Button type="submit" disabled={saving}>
                                {saving
                                    ? t("common.saving")
                                    : t("common.save")}
                            </Button>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>

            <Dialog open={routeDialog} onOpenChange={setRouteDialog}>
                <DialogContent className="max-w-xl">
                    <form onSubmit={saveRoute} className="space-y-5">
                        <DialogHeader>
                            <DialogTitle>
                                {editingRoute
                                    ? t("gatewayDetail.route.edit")
                                    : t("gatewayDetail.route.create")}
                            </DialogTitle>
                            <DialogDescription>
                                {t("gatewayDetail.route.formDescription")}
                            </DialogDescription>
                        </DialogHeader>
                        <div className="grid gap-4">
                            <div className="grid gap-4 sm:grid-cols-2">
                                <Field
                                    label={t("gatewayDetail.route.name")}
                                    htmlFor="route-name"
                                >
                                    <Input
                                        id="route-name"
                                        required
                                        value={routeForm.name}
                                        onChange={(event) =>
                                            setRouteForm({
                                                ...routeForm,
                                                name: event.target.value,
                                            })
                                        }
                                    />
                                </Field>
                                <Field
                                    label={t("gatewayDetail.route.path")}
                                    htmlFor="route-path"
                                >
                                    <Input
                                        id="route-path"
                                        required
                                        value={routeForm.pathPrefix}
                                        onChange={(event) =>
                                            setRouteForm({
                                                ...routeForm,
                                                pathPrefix: event.target.value,
                                            })
                                        }
                                    />
                                </Field>
                            </div>
                            <div className="grid gap-4 sm:grid-cols-2">
                                <Field
                                    label={t("gatewayDetail.route.typeField")}
                                    htmlFor="route-type"
                                >
                                    <select
                                        id="route-type"
                                        className={controlClass}
                                        value={routeForm.routeType}
                                        onChange={(event) =>
                                            setRouteForm({
                                                ...routeForm,
                                                routeType: event.target
                                                    .value as GatewayRouteType,
                                            })
                                        }
                                    >
                                        <option value="PROXY">
                                            {t("gatewayDetail.route.type.PROXY")}
                                        </option>
                                        <option value="STATIC">
                                            {t(
                                                "gatewayDetail.route.type.STATIC",
                                            )}
                                        </option>
                                    </select>
                                </Field>
                                <Field
                                    label={t("gatewayDetail.route.priority")}
                                    htmlFor="route-priority"
                                >
                                    <Input
                                        id="route-priority"
                                        type="number"
                                        min={0}
                                        value={routeForm.priority}
                                        onChange={(event) =>
                                            setRouteForm({
                                                ...routeForm,
                                                priority: event.target.value,
                                            })
                                        }
                                    />
                                </Field>
                            </div>
                            {routeForm.routeType === "PROXY" ? (
                                <>
                                    <Field
                                        label={t(
                                            "gatewayDetail.route.proxyTarget",
                                        )}
                                        htmlFor="route-target"
                                    >
                                        <Input
                                            id="route-target"
                                            required
                                            placeholder="http://10.0.0.8:8080"
                                            value={routeForm.proxyTarget}
                                            onChange={(event) =>
                                                setRouteForm({
                                                    ...routeForm,
                                                    proxyTarget:
                                                        event.target.value,
                                                })
                                            }
                                        />
                                    </Field>
                                    <div className="grid gap-4 sm:grid-cols-2">
                                        <Field
                                            label={t(
                                                "gatewayDetail.route.extraConfig.webSocket",
                                            )}
                                            htmlFor="route-ws"
                                        >
                                            <select
                                                id="route-ws"
                                                className={controlClass}
                                                value={routeForm.wsMode}
                                                onChange={(event) =>
                                                    setRouteForm({
                                                        ...routeForm,
                                                        wsMode: event.target
                                                            .value as
                                                            | "inherit"
                                                            | "enable"
                                                            | "disable",
                                                    })
                                                }
                                            >
                                                <option value="inherit">
                                                    {t(
                                                        "gatewayDetail.route.extraConfig.wsInherit",
                                                    )}
                                                </option>
                                                <option value="enable">
                                                    {t(
                                                        "gatewayDetail.route.extraConfig.wsEnable",
                                                    )}
                                                </option>
                                                <option value="disable">
                                                    {t(
                                                        "gatewayDetail.route.extraConfig.wsDisable",
                                                    )}
                                                </option>
                                            </select>
                                        </Field>
                                        <Field
                                            label={t(
                                                "gatewayDetail.route.extraConfig.clientMaxBodySize",
                                            )}
                                            htmlFor="route-body"
                                        >
                                            <Input
                                                id="route-body"
                                                placeholder={t(
                                                    "gatewayDetail.route.extraConfig.clientMaxBodySizeInherit",
                                                )}
                                                value={
                                                    routeForm.clientMaxBodySize
                                                }
                                                onChange={(event) =>
                                                    setRouteForm({
                                                        ...routeForm,
                                                        clientMaxBodySize:
                                                            event.target.value,
                                                    })
                                                }
                                            />
                                        </Field>
                                    </div>
                                </>
                            ) : (
                                <>
                                    <Field
                                        label={t(
                                            "gatewayDetail.route.staticFile",
                                        )}
                                        htmlFor="route-file"
                                    >
                                        <select
                                            id="route-file"
                                            className={controlClass}
                                            required
                                            value={routeForm.staticFileId}
                                            onChange={(event) =>
                                                setRouteForm({
                                                    ...routeForm,
                                                    staticFileId:
                                                        event.target.value,
                                                })
                                            }
                                        >
                                            <option value="">
                                                {t(
                                                    "gatewayDetail.route.chooseFile",
                                                )}
                                            </option>
                                            {files
                                                .filter((file) =>
                                                    file.originalFilename
                                                        .toLowerCase()
                                                        .endsWith(".zip"),
                                                )
                                                .map((file) => (
                                                    <option
                                                        key={file.id}
                                                        value={file.id}
                                                    >
                                                        {file.name} ·{" "}
                                                        {file.originalFilename}
                                                    </option>
                                                ))}
                                        </select>
                                    </Field>
                                    <label className="flex cursor-pointer items-center justify-center gap-2 rounded-xl border border-dashed bg-muted/20 px-4 py-4 text-sm font-medium hover:bg-muted/35">
                                        <Upload className="size-4 text-violet-600" />
                                        {t("gatewayDetail.route.uploadZip")}
                                        <input
                                            type="file"
                                            accept=".zip,application/zip"
                                            className="sr-only"
                                            onChange={(event) => {
                                                const file =
                                                    event.target.files?.[0];
                                                if (file)
                                                    void uploadStatic(file);
                                            }}
                                        />
                                    </label>
                                </>
                            )}
                        </div>
                        <ErrorBanner
                            error={formError}
                            fallbackKey="gatewayDetail.saveFailed"
                        />
                        <DialogFooter>
                            <Button
                                type="button"
                                variant="outline"
                                onClick={() => setRouteDialog(false)}
                            >
                                {t("common.cancel")}
                            </Button>
                            <Button type="submit" disabled={saving}>
                                {saving
                                    ? t("common.saving")
                                    : t("common.save")}
                            </Button>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>
        </SectionCard>
    );
}

function RoutesTable({
    routes,
    files,
    onAdd,
    onEdit,
    onRemove,
}: {
    routes: GatewayRoute[];
    files: { id: string; originalFilename: string }[];
    onAdd: () => void;
    onEdit: (route: GatewayRoute) => void;
    onRemove: (route: GatewayRoute) => void;
}) {
    const { t } = useTranslation();
    return (
        <div className="border-t bg-muted/10 px-3 py-3">
            <div className="mb-2 flex items-center justify-between px-1">
                <p className="text-xs font-medium text-muted-foreground">
                    {t("gatewayDetail.route.title")}
                </p>
                <Button variant="ghost" size="sm" onClick={onAdd}>
                    <Plus />
                    {t("gatewayDetail.route.add")}
                </Button>
            </div>
            {routes.length === 0 ? (
                <div className="rounded-lg border border-dashed px-4 py-6 text-center text-xs text-muted-foreground">
                    {t("gatewayDetail.route.empty")}
                </div>
            ) : (
                <div className="overflow-x-auto">
                    <table className="w-full min-w-[560px] text-left text-xs">
                        <thead className="border-b text-muted-foreground">
                            <tr>
                                <th className="px-2 py-1.5 font-medium">
                                    {t("gatewayDetail.route.path")}
                                </th>
                                <th className="px-2 py-1.5 font-medium">
                                    {t("gatewayDetail.route.typeField")}
                                </th>
                                <th className="px-2 py-1.5 font-medium">
                                    {t("gatewayDetail.route.proxyTarget")}
                                </th>
                                <th className="px-2 py-1.5 font-medium">
                                    {t("gatewayDetail.route.priority")}
                                </th>
                                <th className="w-16 px-2 py-1.5" />
                            </tr>
                        </thead>
                        <tbody className="divide-y">
                            {routes.map((route) => {
                                const file = files.find(
                                    (item) => item.id === route.staticFileId,
                                );
                                return (
                                    <tr
                                        key={route.id}
                                        className="transition-colors hover:bg-background"
                                    >
                                        <td className="px-2 py-2">
                                            <code className="text-blue-700">
                                                {route.pathPrefix}
                                            </code>
                                        </td>
                                        <td className="px-2 py-2">
                                            <span className="inline-flex items-center gap-1.5">
                                                {route.routeType === "STATIC" ? (
                                                    <FileArchive className="size-3.5 text-violet-600" />
                                                ) : (
                                                    <ServerCog className="size-3.5 text-emerald-600" />
                                                )}
                                                {t(
                                                    `gatewayDetail.route.type.${route.routeType}`,
                                                )}
                                            </span>
                                        </td>
                                        <td className="max-w-64 px-2 py-2">
                                            <span
                                                className="block truncate font-mono text-muted-foreground"
                                                title={
                                                    route.routeType === "STATIC"
                                                        ? file?.originalFilename
                                                        : route.proxyTarget ??
                                                          undefined
                                                }
                                            >
                                                {route.routeType === "STATIC"
                                                    ? (file?.originalFilename ||
                                                        t("common.dash"))
                                                    : (route.proxyTarget ||
                                                        t("common.dash"))}
                                            </span>
                                        </td>
                                        <td className="px-2 py-2 font-mono text-muted-foreground">
                                            {route.priority}
                                        </td>
                                        <td className="px-2 py-2">
                                            <div className="flex items-center justify-end gap-1">
                                                <Button
                                                    variant="ghost"
                                                    size="icon-sm"
                                                    onClick={() => onEdit(route)}
                                                    aria-label={t(
                                                        "common.edit",
                                                    )}
                                                >
                                                    <Pencil className="size-4" />
                                                </Button>
                                                <Button
                                                    variant="ghost"
                                                    size="icon-sm"
                                                    onClick={() =>
                                                        onRemove(route)
                                                    }
                                                    aria-label={t(
                                                        "common.delete",
                                                    )}
                                                >
                                                    <Trash2 className="size-4" />
                                                </Button>
                                            </div>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
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
