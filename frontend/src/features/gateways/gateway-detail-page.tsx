import {
    useCallback,
    useEffect,
    useMemo,
    useState,
    type FormEvent,
    type ReactNode,
} from "react";
import {
    ArrowLeft,
    FileArchive,
    Globe2,
    LockKeyhole,
    Network,
    Pencil,
    Plus,
    Route,
    ServerCog,
    Trash2,
    Upload,
} from "lucide-react";
import { Link, useParams } from "react-router";

import { ErrorBanner, LoadingState } from "@/components/resource-ui";
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
import type {
    Credential,
    GatewayConfig,
    GatewayEntryPoint,
    GatewayEntryPointRequest,
    GatewayRoute,
    GatewayRouteRequest,
    GatewayRouteType,
    StoredFile,
} from "@/types/api";

const controlClass =
    "h-9 w-full rounded-lg border border-input bg-transparent px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50";

const credentialPageSize = 1000;

function certificateCredentials(credentials: Credential[]) {
    return credentials.filter(
        (credential) => credential.credentialType === "X509_CERTIFICATE",
    );
}

export function GatewayDetailPage() {
    const { gatewayId = "" } = useParams();
    const api = useApi();
    const notify = useNotify();
    const { t } = useTranslation();
    const [gateway, setGateway] = useState<GatewayConfig | null>(null);
    const [entryPoints, setEntryPoints] = useState<GatewayEntryPoint[]>([]);
    const [routes, setRoutes] = useState<Record<string, GatewayRoute[]>>({});
    const [credentials, setCredentials] = useState<Credential[]>([]);
    const [files, setFiles] = useState<StoredFile[]>([]);
    const [selectedId, setSelectedId] = useState("");
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<unknown>(null);
    const [entryDialog, setEntryDialog] = useState(false);
    const [routeDialog, setRouteDialog] = useState(false);
    const [editingEntry, setEditingEntry] = useState<GatewayEntryPoint | null>(null);
    const [editingRoute, setEditingRoute] = useState<GatewayRoute | null>(null);
    const [saving, setSaving] = useState(false);
    const [loadingCredentials, setLoadingCredentials] = useState(false);
    const [formError, setFormError] = useState<unknown>(null);
    const [entryForm, setEntryForm] = useState({
        name: "",
        listenPort: "80",
        domains: "",
        certificateCredentialId: "",
    });
    const [routeForm, setRouteForm] = useState({
        name: "",
        pathPrefix: "/",
        routeType: "PROXY" as GatewayRouteType,
        priority: "0",
        proxyTarget: "",
        staticFileId: "",
    });

    const loadCertificateCredentials = useCallback(async () => {
        const credentialPage = await api.credentials.list({
            page: 1,
            pageSize: credentialPageSize,
        });
        setCredentials(certificateCredentials(credentialPage.data));
    }, [api.credentials]);

    const load = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const [gatewayData, entries, credentialPage, filePage] =
                await Promise.all([
                    api.gateways.get(gatewayId),
                    api.gateways.listEntryPoints(gatewayId),
                    api.credentials.list({
                        page: 1,
                        pageSize: credentialPageSize,
                    }),
                    api.files.list({ page: 1, pageSize: 1000 }),
                ]);
            const routePairs = await Promise.all(
                entries.map(async (entry) => [
                    entry.id,
                    await api.gateways.listRoutes(gatewayId, entry.id),
                ] as const),
            );
            setGateway(gatewayData);
            setEntryPoints(entries);
            setRoutes(Object.fromEntries(routePairs));
            setCredentials(certificateCredentials(credentialPage.data));
            setFiles(filePage.data);
            setSelectedId((current) =>
                entries.some((entry) => entry.id === current)
                    ? current
                    : (entries[0]?.id ?? ""),
            );
        } catch (loadError) {
            setError(loadError);
        } finally {
            setLoading(false);
        }
    }, [api.credentials, api.files, api.gateways, gatewayId]);

    useEffect(() => {
        const timeout = window.setTimeout(() => void load(), 0);
        return () => window.clearTimeout(timeout);
    }, [load]);

    const selected = useMemo(
        () => entryPoints.find((entry) => entry.id === selectedId) ?? null,
        [entryPoints, selectedId],
    );

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
                  }
                : {
                      name: "",
                      listenPort: "80",
                      domains: "",
                      certificateCredentialId: "",
                  },
        );
        setFormError(null);
        setEntryDialog(true);
        setLoadingCredentials(true);
        try {
            await loadCertificateCredentials();
        } catch (loadError) {
            setFormError(loadError);
        } finally {
            setLoadingCredentials(false);
        }
    }

    function openRoute(route?: GatewayRoute) {
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
                  }
                : {
                      name: "",
                      pathPrefix: "/",
                      routeType: "PROXY",
                      priority: "0",
                      proxyTarget: "",
                      staticFileId: "",
                  },
        );
        setFormError(null);
        setRouteDialog(true);
    }

    async function saveEntry(event: FormEvent) {
        event.preventDefault();
        setSaving(true);
        setFormError(null);
        const body: GatewayEntryPointRequest = {
            name: entryForm.name.trim(),
            listenPort: Number(entryForm.listenPort),
            domainNames: entryForm.domains
                .split(",")
                .map((domain) => domain.trim())
                .filter(Boolean),
            certificateCredentialId:
                entryForm.certificateCredentialId || null,
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
            await load();
        } catch (saveError) {
            setFormError(saveError);
        } finally {
            setSaving(false);
        }
    }

    async function saveRoute(event: FormEvent) {
        event.preventDefault();
        if (!selected) return;
        setSaving(true);
        setFormError(null);
        const body: GatewayRouteRequest = {
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
        };
        try {
            if (editingRoute) {
                await api.gateways.updateRoute(
                    gatewayId,
                    selected.id,
                    editingRoute.id,
                    body,
                );
            } else {
                await api.gateways.createRoute(gatewayId, selected.id, body);
            }
            setRouteDialog(false);
            notify.success("gatewayDetail.success.routeSaved");
            await load();
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
            setFiles((current) => [stored, ...current]);
            setRouteForm((current) => ({
                ...current,
                routeType: "STATIC",
                staticFileId: stored.id,
            }));
        } catch (uploadError) {
            setFormError(uploadError);
        } finally {
            setSaving(false);
        }
    }

    async function removeEntry(entry: GatewayEntryPoint) {
        if (!window.confirm(t("gatewayDetail.entry.deleteConfirm", { name: entry.name }))) return;
        await api.gateways.removeEntryPoint(gatewayId, entry.id);
        notify.success("gatewayDetail.success.entryDeleted");
        await load();
    }

    async function removeRoute(route: GatewayRoute) {
        if (!selected || !window.confirm(t("gatewayDetail.route.deleteConfirm", { name: route.name }))) return;
        await api.gateways.removeRoute(gatewayId, selected.id, route.id);
        notify.success("gatewayDetail.success.routeDeleted");
        await load();
    }

    if (loading) return <LoadingState />;

    return (
        <div className="space-y-6">
            <div>
                <Button asChild variant="ghost" size="sm" className="-ml-2 mb-3">
                    <Link to="/gateways">
                        <ArrowLeft />
                        {t("gatewayDetail.back")}
                    </Link>
                </Button>
                <div className="flex flex-col gap-4 border-b pb-6 sm:flex-row sm:items-end sm:justify-between">
                    <div>
                        <p className="font-mono text-[0.68rem] font-semibold tracking-[0.18em] text-muted-foreground uppercase">
                            {t("gatewayDetail.eyebrow")}
                        </p>
                        <h1 className="mt-2 text-3xl font-semibold tracking-tight">
                            {gateway?.name}
                        </h1>
                        <p className="mt-2 text-sm text-muted-foreground">
                            {gateway?.description || t("gatewayDetail.description")}
                        </p>
                    </div>
                    <Button onClick={() => void openEntry()}>
                        <Plus />
                        {t("gatewayDetail.entry.add")}
                    </Button>
                </div>
            </div>
            <ErrorBanner error={error} fallbackKey="gatewayDetail.loadFailed" />

            <div className="grid gap-5 lg:grid-cols-[280px_minmax(0,1fr)]">
                <aside className="space-y-2">
                    <p className="px-1 text-xs font-medium text-muted-foreground">
                        {t("gatewayDetail.entry.title")}
                    </p>
                    {entryPoints.map((entry) => (
                        <button
                            key={entry.id}
                            type="button"
                            onClick={() => setSelectedId(entry.id)}
                            className={cn(
                                "w-full rounded-xl border p-4 text-left transition",
                                selectedId === entry.id
                                    ? "border-blue-500/50 bg-blue-500/[0.06] shadow-sm"
                                    : "bg-card hover:bg-muted/30",
                            )}
                        >
                            <div className="flex items-center justify-between">
                                <span className="font-medium">{entry.name}</span>
                                {entry.certificateCredentialId ? (
                                    <LockKeyhole className="size-4 text-violet-600" />
                                ) : (
                                    <Globe2 className="size-4 text-blue-600" />
                                )}
                            </div>
                            <div className="mt-3 flex items-baseline gap-2">
                                <span className="font-mono text-2xl font-semibold text-blue-700">
                                    :{entry.listenPort}
                                </span>
                                <span className="text-[0.68rem] font-medium text-muted-foreground uppercase">
                                    {entry.certificateCredentialId ? "HTTPS" : "HTTP"}
                                </span>
                            </div>
                            <p className="mt-2 truncate font-mono text-[0.68rem] text-muted-foreground">
                                {entry.domainNames.join(" · ")}
                            </p>
                        </button>
                    ))}
                    {!entryPoints.length ? (
                        <div className="rounded-xl border border-dashed p-5 text-center text-sm text-muted-foreground">
                            {t("gatewayDetail.entry.empty")}
                        </div>
                    ) : null}
                </aside>

                <section className="min-w-0 rounded-2xl border bg-card shadow-sm">
                    {selected ? (
                        <>
                            <header className="flex flex-col gap-4 border-b p-5 sm:flex-row sm:items-center sm:justify-between">
                                <div className="flex items-center gap-4">
                                    <span className="grid size-11 place-items-center rounded-xl bg-blue-600 text-white shadow-sm">
                                        <Network className="size-5" />
                                    </span>
                                    <div>
                                        <p className="font-medium">
                                            {selected.domainNames.join(", ")}
                                        </p>
                                        <p className="mt-1 font-mono text-xs text-muted-foreground">
                                            {selected.certificateCredentialId ? "TLS" : "TCP"} / {selected.listenPort}
                                        </p>
                                    </div>
                                </div>
                                <div className="flex gap-2">
                                    <Button variant="outline" size="sm" onClick={() => void openEntry(selected)}>
                                        <Pencil />
                                        {t("common.edit")}
                                    </Button>
                                    <Button variant="outline" size="sm" onClick={() => void removeEntry(selected)}>
                                        <Trash2 />
                                        {t("common.delete")}
                                    </Button>
                                </div>
                            </header>
                            <div className="p-5">
                                <div className="mb-4 flex items-center justify-between">
                                    <div>
                                        <h2 className="font-semibold">{t("gatewayDetail.route.title")}</h2>
                                        <p className="mt-1 text-xs text-muted-foreground">
                                            {t("gatewayDetail.route.description")}
                                        </p>
                                    </div>
                                    <Button size="sm" onClick={() => openRoute()}>
                                        <Plus />
                                        {t("gatewayDetail.route.add")}
                                    </Button>
                                </div>
                                <div className="space-y-2">
                                    {(routes[selected.id] ?? []).map((route) => {
                                        const file = files.find((item) => item.id === route.staticFileId);
                                        return (
                                            <div key={route.id} className="group grid gap-3 rounded-xl border p-4 sm:grid-cols-[minmax(120px,0.45fr)_24px_minmax(0,1fr)_auto] sm:items-center">
                                                <div>
                                                    <p className="font-medium">{route.name}</p>
                                                    <code className="mt-1 block text-xs text-blue-700">{route.pathPrefix}</code>
                                                </div>
                                                <Route className="hidden size-4 text-muted-foreground sm:block" />
                                                <div className="min-w-0">
                                                    <div className="flex items-center gap-2">
                                                        {route.routeType === "STATIC" ? <FileArchive className="size-4 text-violet-600" /> : <ServerCog className="size-4 text-emerald-600" />}
                                                        <span className="text-xs font-medium">{t(`gatewayDetail.route.type.${route.routeType}`)}</span>
                                                    </div>
                                                    <p className="mt-1 truncate font-mono text-[0.68rem] text-muted-foreground">
                                                        {route.routeType === "STATIC" ? file?.originalFilename : route.proxyTarget}
                                                    </p>
                                                </div>
                                                <div className="flex justify-end gap-1">
                                                    <Button variant="ghost" size="icon-sm" onClick={() => openRoute(route)}><Pencil /></Button>
                                                    <Button variant="ghost" size="icon-sm" onClick={() => void removeRoute(route)}><Trash2 /></Button>
                                                </div>
                                            </div>
                                        );
                                    })}
                                    {!routes[selected.id]?.length ? (
                                        <div className="rounded-xl border border-dashed p-8 text-center text-sm text-muted-foreground">
                                            {t("gatewayDetail.route.empty")}
                                        </div>
                                    ) : null}
                                </div>
                            </div>
                        </>
                    ) : (
                        <div className="grid min-h-72 place-items-center p-8 text-sm text-muted-foreground">
                            {t("gatewayDetail.entry.select")}
                        </div>
                    )}
                </section>
            </div>

            <Dialog open={entryDialog} onOpenChange={setEntryDialog}>
                <DialogContent className="max-w-lg">
                    <form onSubmit={saveEntry} className="space-y-5">
                        <DialogHeader>
                            <DialogTitle>{editingEntry ? t("gatewayDetail.entry.edit") : t("gatewayDetail.entry.create")}</DialogTitle>
                            <DialogDescription>{t("gatewayDetail.entry.formDescription")}</DialogDescription>
                        </DialogHeader>
                        <div className="grid gap-4">
                            <Field label={t("gatewayDetail.entry.name")} htmlFor="entry-name">
                                <Input id="entry-name" required value={entryForm.name} onChange={(event) => setEntryForm({ ...entryForm, name: event.target.value })} />
                            </Field>
                            <div className="grid gap-4 sm:grid-cols-2">
                                <Field label={t("gatewayDetail.entry.port")} htmlFor="entry-port">
                                    <Input id="entry-port" type="number" min={1} max={65535} required value={entryForm.listenPort} onChange={(event) => setEntryForm({ ...entryForm, listenPort: event.target.value })} />
                                </Field>
                                <Field label={t("gatewayDetail.entry.certificate")} htmlFor="entry-cert">
                                    <select id="entry-cert" className={controlClass} value={entryForm.certificateCredentialId} disabled={loadingCredentials} onChange={(event) => setEntryForm({ ...entryForm, certificateCredentialId: event.target.value })}>
                                        <option value="">{t("gatewayDetail.entry.noCertificate")}</option>
                                        {loadingCredentials ? <option value="" disabled>{t("common.loadingData")}</option> : null}
                                        {credentials.map((credential) => <option key={credential.id} value={credential.id}>{credential.name}</option>)}
                                    </select>
                                </Field>
                            </div>
                            <Field label={t("gatewayDetail.entry.domains")} htmlFor="entry-domains">
                                <Input id="entry-domains" required placeholder="example.com, *.lab.example.com" value={entryForm.domains} onChange={(event) => setEntryForm({ ...entryForm, domains: event.target.value })} />
                            </Field>
                        </div>
                        <ErrorBanner error={formError} fallbackKey="gatewayDetail.saveFailed" />
                        <DialogFooter>
                            <Button type="button" variant="outline" onClick={() => setEntryDialog(false)}>{t("common.cancel")}</Button>
                            <Button type="submit" disabled={saving}>{saving ? t("common.saving") : t("common.save")}</Button>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>

            <Dialog open={routeDialog} onOpenChange={setRouteDialog}>
                <DialogContent className="max-w-xl">
                    <form onSubmit={saveRoute} className="space-y-5">
                        <DialogHeader>
                            <DialogTitle>{editingRoute ? t("gatewayDetail.route.edit") : t("gatewayDetail.route.create")}</DialogTitle>
                            <DialogDescription>{t("gatewayDetail.route.formDescription")}</DialogDescription>
                        </DialogHeader>
                        <div className="grid gap-4">
                            <div className="grid gap-4 sm:grid-cols-2">
                                <Field label={t("gatewayDetail.route.name")} htmlFor="route-name">
                                    <Input id="route-name" required value={routeForm.name} onChange={(event) => setRouteForm({ ...routeForm, name: event.target.value })} />
                                </Field>
                                <Field label={t("gatewayDetail.route.path")} htmlFor="route-path">
                                    <Input id="route-path" required value={routeForm.pathPrefix} onChange={(event) => setRouteForm({ ...routeForm, pathPrefix: event.target.value })} />
                                </Field>
                            </div>
                            <div className="grid gap-4 sm:grid-cols-2">
                                <Field label={t("gatewayDetail.route.typeField")} htmlFor="route-type">
                                    <select id="route-type" className={controlClass} value={routeForm.routeType} onChange={(event) => setRouteForm({ ...routeForm, routeType: event.target.value as GatewayRouteType })}>
                                        <option value="PROXY">{t("gatewayDetail.route.type.PROXY")}</option>
                                        <option value="STATIC">{t("gatewayDetail.route.type.STATIC")}</option>
                                    </select>
                                </Field>
                                <Field label={t("gatewayDetail.route.priority")} htmlFor="route-priority">
                                    <Input id="route-priority" type="number" min={0} value={routeForm.priority} onChange={(event) => setRouteForm({ ...routeForm, priority: event.target.value })} />
                                </Field>
                            </div>
                            {routeForm.routeType === "PROXY" ? (
                                <Field label={t("gatewayDetail.route.proxyTarget")} htmlFor="route-target">
                                    <Input id="route-target" required placeholder="http://10.0.0.8:8080" value={routeForm.proxyTarget} onChange={(event) => setRouteForm({ ...routeForm, proxyTarget: event.target.value })} />
                                </Field>
                            ) : (
                                <>
                                    <Field label={t("gatewayDetail.route.staticFile")} htmlFor="route-file">
                                        <select id="route-file" className={controlClass} required value={routeForm.staticFileId} onChange={(event) => setRouteForm({ ...routeForm, staticFileId: event.target.value })}>
                                            <option value="">{t("gatewayDetail.route.chooseFile")}</option>
                                            {files.filter((file) => file.originalFilename.toLowerCase().endsWith(".zip")).map((file) => <option key={file.id} value={file.id}>{file.name} · {file.originalFilename}</option>)}
                                        </select>
                                    </Field>
                                    <label className="flex cursor-pointer items-center justify-center gap-2 rounded-xl border border-dashed bg-muted/20 px-4 py-4 text-sm font-medium hover:bg-muted/35">
                                        <Upload className="size-4 text-violet-600" />
                                        {t("gatewayDetail.route.uploadZip")}
                                        <input type="file" accept=".zip,application/zip" className="sr-only" onChange={(event) => {
                                            const file = event.target.files?.[0];
                                            if (file) void uploadStatic(file);
                                        }} />
                                    </label>
                                </>
                            )}
                        </div>
                        <ErrorBanner error={formError} fallbackKey="gatewayDetail.saveFailed" />
                        <DialogFooter>
                            <Button type="button" variant="outline" onClick={() => setRouteDialog(false)}>{t("common.cancel")}</Button>
                            <Button type="submit" disabled={saving}>{saving ? t("common.saving") : t("common.save")}</Button>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>
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
