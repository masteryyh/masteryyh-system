import {
    useCallback,
    useEffect,
    useState,
    type FormEvent,
    type ReactNode,
} from "react";
import {
    Container,
    MoreHorizontal,
    Pencil,
    Plus,
    Server,
    Trash2,
} from "lucide-react";

import {
    EmptyState,
    ErrorBanner,
    LoadingState,
    PageHeader,
    Pagination,
    SuccessBanner,
} from "@/components/resource-ui";
import { Button } from "@/components/ui/button";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FingerprintBadge } from "@/features/credentials/fingerprint-badge";
import { useApi } from "@/hooks/use-api";
import { useNotify } from "@/hooks/use-notify";
import { useTranslation } from "@/hooks/use-translation";
import { formatDate } from "@/lib/formatters";
import type {
    AppPlatform,
    AppPlatformRequest,
    Credential,
    PagedResponse,
    PlatformType,
} from "@/types/api";

const pageSize = 10;
const credentialPageSize = 1000;
const controlClass =
    "h-8 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50";
const textAreaClass =
    "min-h-24 w-full resize-y rounded-lg border border-input bg-transparent px-2.5 py-2 font-mono text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50";

interface PlatformFormState {
    name: string;
    description: string;
    platformType: PlatformType;
    dockerHost: string;
    systemdSSHHost: string;
    systemdSSHPort: string;
    systemdSSHUsername: string;
    credentialId: string;
    hostKeys: string;
}

const emptyForm: PlatformFormState = {
    name: "",
    description: "",
    platformType: "SYSTEMD",
    dockerHost: "tcp://",
    systemdSSHHost: "",
    systemdSSHPort: "22",
    systemdSSHUsername: "",
    credentialId: "",
    hostKeys: "",
};

export function PlatformsPage() {
    const api = useApi();
    const notify = useNotify();
    const { t } = useTranslation();

    const [page, setPage] = useState(1);
    const [result, setResult] = useState<PagedResponse<AppPlatform> | null>(
        null,
    );
    const [credentials, setCredentials] = useState<Credential[]>([]);
    const [credentialById, setCredentialById] = useState<
        Record<string, Credential>
    >({});
    const [loading, setLoading] = useState(true);
    const [loadError, setLoadError] = useState<unknown>(null);
    const [successKey, setSuccessKey] = useState("");
    const [formOpen, setFormOpen] = useState(false);
    const [editing, setEditing] = useState<AppPlatform | null>(null);
    const [form, setForm] = useState<PlatformFormState>(emptyForm);
    const [formError, setFormError] = useState<unknown>(null);
    const [saving, setSaving] = useState(false);
    const [deleting, setDeleting] = useState<AppPlatform | null>(null);
    const [deleteError, setDeleteError] = useState<unknown>(null);

    const loadPlatforms = useCallback(async () => {
        setLoading(true);
        setLoadError(null);
        try {
            const [platformData, credentialData] = await Promise.all([
                api.platforms.list({ page, pageSize }),
                api.credentials.list({
                    page: 1,
                    pageSize: credentialPageSize,
                }),
            ]);

            const credentialMap: Record<string, Credential> =
                Object.fromEntries(
                    credentialData.data.map((credential) => [
                        credential.id,
                        credential,
                    ]),
                );

            const missingIds = [
                ...new Set(
                    platformData.data
                        .map((platform) => platform.credentialId)
                        .filter(
                            (id): id is string =>
                                Boolean(id) && !credentialMap[id as string],
                        ),
                ),
            ];
            const missingCredentials = await Promise.all(
                missingIds.map((id) => api.credentials.get(id)),
            );
            missingCredentials.forEach((credential) => {
                credentialMap[credential.id] = credential;
            });

            setResult(platformData);
            setCredentials(
                credentialData.data.filter(
                    (credential) =>
                        credential.credentialType === "SSH_PRIVATE_KEY" ||
                        credential.credentialType === "TEXT_PASSWORD",
                ),
            );
            setCredentialById(credentialMap);
            if (
                platformData.totalPages > 0 &&
                page > platformData.totalPages
            ) {
                setPage(platformData.totalPages);
            }
        } catch (error) {
            setResult(null);
            setCredentials([]);
            setCredentialById({});
            setLoadError(error);
        } finally {
            setLoading(false);
        }
    }, [api.credentials, api.platforms, page]);

    useEffect(() => {
        const timeout = window.setTimeout(() => void loadPlatforms(), 0);
        return () => window.clearTimeout(timeout);
    }, [loadPlatforms]);

    function openCreate() {
        setEditing(null);
        setForm(emptyForm);
        setFormError(null);
        setFormOpen(true);
    }

    function openEdit(platform: AppPlatform) {
        setEditing(platform);
        setForm({
            name: platform.name,
            description: platform.description ?? "",
            platformType: platform.platformType,
            dockerHost: platform.dockerHost ?? "tcp://",
            systemdSSHHost: platform.systemdSSHHost ?? "",
            systemdSSHPort: String(platform.systemdSSHPort ?? 22),
            systemdSSHUsername: platform.systemdSSHUsername ?? "",
            credentialId: platform.credentialId ?? "",
            hostKeys: platform.hostKeys?.join("\n") ?? "",
        });
        setFormError(null);
        setFormOpen(true);
    }

    function updateForm<Key extends keyof PlatformFormState>(
        key: Key,
        value: PlatformFormState[Key],
    ) {
        setForm((current) => ({ ...current, [key]: value }));
    }

    function buildRequest(): AppPlatformRequest {
        const base: AppPlatformRequest = {
            name: form.name.trim(),
            description: form.description.trim(),
        };
        if (!editing) {
            base.platformType = form.platformType;
        }
        if (form.platformType === "DOCKER") {
            return {
                ...base,
                dockerHost: form.dockerHost.trim(),
                credentialId: null,
            };
        }
        return {
            ...base,
            systemdSSHHost: form.systemdSSHHost.trim(),
            systemdSSHPort: Number(form.systemdSSHPort || 22),
            systemdSSHUsername: form.systemdSSHUsername.trim(),
            credentialId: form.credentialId || null,
            hostKeys: form.hostKeys
                .split("\n")
                .map((key) => key.trim())
                .filter(Boolean),
        };
    }

    async function savePlatform(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();
        setSaving(true);
        setFormError(null);
        try {
            const body = buildRequest();
            if (editing) {
                await api.platforms.update(editing.id, body);
                setSuccessKey("platforms.success.updated");
                notify.success("platforms.success.updated");
            } else {
                await api.platforms.create(body);
                setSuccessKey("platforms.success.created");
                notify.success("platforms.success.created");
                setPage(1);
            }
            setFormOpen(false);
            await loadPlatforms();
        } catch (saveError) {
            setFormError(saveError);
        } finally {
            setSaving(false);
        }
    }

    async function deletePlatform() {
        if (!deleting) return;
        setSaving(true);
        setDeleteError(null);
        try {
            await api.platforms.remove(deleting.id);
            setDeleting(null);
            setSuccessKey("platforms.success.deleted");
            notify.success("platforms.success.deleted");
            await loadPlatforms();
        } catch (error) {
            setDeleteError(error);
        } finally {
            setSaving(false);
        }
    }

    return (
        <div className="space-y-6">
            <PageHeader
                eyebrow={t("platforms.eyebrow")}
                title={t("platforms.title")}
                description={t("platforms.description")}
                action={
                    <Button onClick={openCreate}>
                        <Plus />
                        {t("platforms.addButton")}
                    </Button>
                }
            />

            {successKey ? <SuccessBanner messageKey={successKey} /> : null}
            <ErrorBanner
                error={loadError}
                fallbackKey="platforms.fallback.loadFailed"
            />

            <section className="w-full max-w-full overflow-hidden rounded-xl border bg-card shadow-sm">
                {loading ? (
                    <LoadingState />
                ) : !result?.data.length ? (
                    <EmptyState
                        title={t("platforms.empty.title")}
                        description={t("platforms.empty.description")}
                    />
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full min-w-[980px] text-left text-sm">
                            <thead className="border-b bg-muted/45 text-xs text-muted-foreground">
                                <tr>
                                    <th className="px-4 py-3 font-medium">
                                        {t("platforms.columns.name")}
                                    </th>
                                    <th className="px-4 py-3 font-medium">
                                        {t("platforms.columns.address")}
                                    </th>
                                    <th className="px-4 py-3 font-medium">
                                        {t("platforms.columns.credential")}
                                    </th>
                                    <th className="px-4 py-3 font-medium">
                                        {t("platforms.columns.status")}
                                    </th>
                                    <th className="px-4 py-3 font-medium">
                                        {t("platforms.columns.updatedAt")}
                                    </th>
                                    <th className="w-12 px-4 py-3" />
                                </tr>
                            </thead>
                            <tbody className="divide-y">
                                {result.data.map((platform) => (
                                    <PlatformRow
                                        key={platform.id}
                                        platform={platform}
                                        credential={
                                            platform.credentialId
                                                ? credentialById[
                                                      platform.credentialId
                                                  ]
                                                : undefined
                                        }
                                        onEdit={() => openEdit(platform)}
                                        onDelete={() => {
                                            setDeleteError(null);
                                            setDeleting(platform);
                                        }}
                                    />
                                ))}
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
                    <form onSubmit={savePlatform} className="space-y-5">
                        <DialogHeader>
                            <DialogTitle>
                                {editing
                                    ? t("platforms.form.editTitle")
                                    : t("platforms.form.createTitle")}
                            </DialogTitle>
                            <DialogDescription>
                                {editing
                                    ? t("platforms.form.editDescription")
                                    : t("platforms.form.createDescription")}
                            </DialogDescription>
                        </DialogHeader>

                        <div className="grid gap-4">
                            <Field
                                label={t("platforms.form.name")}
                                htmlFor="platform-name"
                            >
                                <Input
                                    id="platform-name"
                                    required
                                    placeholder={t(
                                        "platforms.form.namePlaceholder",
                                    )}
                                    value={form.name}
                                    onChange={(event) =>
                                        updateForm("name", event.target.value)
                                    }
                                />
                            </Field>
                            <Field
                                label={t("platforms.form.descriptionField")}
                                htmlFor="platform-description"
                            >
                                <Input
                                    id="platform-description"
                                    placeholder={t(
                                        "platforms.form.descriptionPlaceholder",
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
                                label={t("platforms.form.platformType")}
                                htmlFor="platform-type"
                            >
                                <select
                                    id="platform-type"
                                    className={controlClass}
                                    disabled={Boolean(editing)}
                                    value={form.platformType}
                                    onChange={(event) =>
                                        updateForm(
                                            "platformType",
                                            event.target.value as PlatformType,
                                        )
                                    }
                                >
                                    <option value="SYSTEMD">
                                        {t("platforms.type.SYSTEMD")}
                                    </option>
                                    <option value="DOCKER">
                                        {t("platforms.type.DOCKER")}
                                    </option>
                                </select>
                            </Field>

                            {form.platformType === "DOCKER" ? (
                                <Field
                                    label={t("platforms.form.dockerHost")}
                                    htmlFor="docker-host"
                                >
                                    <Input
                                        id="docker-host"
                                        required
                                        placeholder={t(
                                            "platforms.form.dockerHostPlaceholder",
                                        )}
                                        value={form.dockerHost}
                                        onChange={(event) =>
                                            updateForm(
                                                "dockerHost",
                                                event.target.value,
                                            )
                                        }
                                    />
                                </Field>
                            ) : (
                                <div className="grid gap-4 sm:grid-cols-2">
                                    <Field
                                        label={t("platforms.form.sshHost")}
                                        htmlFor="ssh-host"
                                    >
                                        <Input
                                            id="ssh-host"
                                            required
                                            placeholder={t(
                                                "platforms.form.sshHostPlaceholder",
                                            )}
                                            value={form.systemdSSHHost}
                                            onChange={(event) =>
                                                updateForm(
                                                    "systemdSSHHost",
                                                    event.target.value,
                                                )
                                            }
                                        />
                                    </Field>
                                    <Field
                                        label={t("platforms.form.sshPort")}
                                        htmlFor="ssh-port"
                                    >
                                        <Input
                                            id="ssh-port"
                                            type="number"
                                            min={1}
                                            max={65535}
                                            required
                                            value={form.systemdSSHPort}
                                            onChange={(event) =>
                                                updateForm(
                                                    "systemdSSHPort",
                                                    event.target.value,
                                                )
                                            }
                                        />
                                    </Field>
                                    <Field
                                        label={t("platforms.form.sshUsername")}
                                        htmlFor="ssh-username"
                                    >
                                        <Input
                                            id="ssh-username"
                                            required
                                            placeholder={t(
                                                "platforms.form.sshUsernamePlaceholder",
                                            )}
                                            value={form.systemdSSHUsername}
                                            onChange={(event) =>
                                                updateForm(
                                                    "systemdSSHUsername",
                                                    event.target.value,
                                                )
                                            }
                                        />
                                    </Field>
                                    <Field
                                        label={t("platforms.form.credential")}
                                        htmlFor="credential-id"
                                    >
                                        <select
                                            id="credential-id"
                                            className={controlClass}
                                            value={form.credentialId}
                                            onChange={(event) =>
                                                updateForm(
                                                    "credentialId",
                                                    event.target.value,
                                                )
                                            }
                                        >
                                            <option value="">
                                                {t(
                                                    "platforms.form.credentialNone",
                                                )}
                                            </option>
                                            {credentials.map((credential) => (
                                                <option
                                                    key={credential.id}
                                                    value={credential.id}
                                                >
                                                    {credential.name} ·{" "}
                                                    {t(
                                                        `credentials.type.${credential.credentialType}`,
                                                    )}
                                                </option>
                                            ))}
                                        </select>
                                    </Field>
                                    <div className="sm:col-span-2">
                                        <Field
                                            label={t(
                                                "platforms.form.hostKeys",
                                            )}
                                            htmlFor="host-keys"
                                        >
                                            <textarea
                                                id="host-keys"
                                                className={textAreaClass}
                                                spellCheck={false}
                                                placeholder={t(
                                                    "platforms.form.hostKeysPlaceholder",
                                                )}
                                                value={form.hostKeys}
                                                onChange={(event) =>
                                                    updateForm(
                                                        "hostKeys",
                                                        event.target.value,
                                                    )
                                                }
                                            />
                                        </Field>
                                    </div>
                                </div>
                            )}
                        </div>

                        <ErrorBanner
                            error={formError}
                            fallbackKey="platforms.fallback.saveFailed"
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
                                      ? t("platforms.form.submitEdit")
                                      : t("platforms.form.submitCreate")}
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
                            {t("platforms.deleteDialog.title")}
                        </DialogTitle>
                        <DialogDescription>
                            {t("platforms.deleteDialog.description", {
                                name: deleting?.name ?? "",
                            })}
                        </DialogDescription>
                    </DialogHeader>
                    <ErrorBanner
                        error={deleteError}
                        fallbackKey="platforms.fallback.deleteFailed"
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
                            onClick={() => void deletePlatform()}
                        >
                            {saving
                                ? t("common.deleting")
                                : t("platforms.deleteDialog.confirm")}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}

function PlatformRow({
    platform,
    credential,
    onEdit,
    onDelete,
}: {
    platform: AppPlatform;
    credential?: Credential;
    onEdit: () => void;
    onDelete: () => void;
}) {
    const { t } = useTranslation();
    const privateKeyInfo =
        credential?.credentialType === "SSH_PRIVATE_KEY"
            ? credential.sshKeyInfo
            : null;
    const endpoint =
        platform.platformType === "DOCKER"
            ? platform.dockerHost
            : `${platform.systemdSSHUsername}@${platform.systemdSSHHost}:${platform.systemdSSHPort}`;

    return (
        <tr className="transition-colors hover:bg-muted/25">
            <td className="px-4 py-3">
                <div className="flex items-center gap-3">
                    <span className="grid size-8 shrink-0 place-items-center rounded-lg border bg-background">
                        {platform.platformType === "DOCKER" ? (
                            <Container className="size-4 text-muted-foreground" />
                        ) : (
                            <Server className="size-4 text-muted-foreground" />
                        )}
                    </span>
                    <div className="min-w-0">
                        <p className="font-medium">{platform.name}</p>
                        <p className="max-w-52 truncate text-xs text-muted-foreground">
                            {platform.description ||
                                t(`platforms.type.${platform.platformType}`)}
                        </p>
                    </div>
                </div>
            </td>
            <td className="px-4 py-3">
                <p className="font-mono text-xs font-medium">
                    {t(`platforms.type.${platform.platformType}`)}
                </p>
                <p
                    className="mt-1 max-w-64 truncate font-mono text-xs text-muted-foreground"
                    title={endpoint ?? undefined}
                >
                    {endpoint || t("common.dash")}
                </p>
            </td>
            <td className="px-4 py-3">
                {credential ? (
                    <div className="max-w-72">
                        <p className="text-xs font-medium">{credential.name}</p>
                        {privateKeyInfo ? (
                            <div className="mt-1">
                                <FingerprintBadge
                                    fingerprint={privateKeyInfo.fingerprint}
                                />
                            </div>
                        ) : (
                            <p className="mt-1 text-xs text-muted-foreground">
                                {t(
                                    `credentials.type.${credential.credentialType}`,
                                )}
                            </p>
                        )}
                    </div>
                ) : (
                    <span className="text-xs text-muted-foreground">
                        {t("common.dash")}
                    </span>
                )}
            </td>
            <td className="px-4 py-3">
                <span className="inline-flex items-center gap-2 whitespace-nowrap text-xs font-medium">
                    <span
                        className={`size-2 rounded-full ${platform.online ? "bg-emerald-500 shadow-[0_0_0_3px_rgba(16,185,129,0.14)]" : "bg-slate-400"}`}
                    />
                    {platform.online
                        ? t("platforms.status.online")
                        : t("platforms.status.offline")}
                </span>
            </td>
            <td className="px-4 py-3 text-xs text-muted-foreground">
                {formatDate(platform.updatedAt)}
            </td>
            <td className="px-4 py-3">
                <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon-sm">
                            <MoreHorizontal />
                            <span className="sr-only">
                                {t("common.actions")}
                            </span>
                        </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-32">
                        <DropdownMenuItem onClick={onEdit}>
                            <Pencil />
                            {t("common.edit")}
                        </DropdownMenuItem>
                        <DropdownMenuItem
                            variant="destructive"
                            onClick={onDelete}
                        >
                            <Trash2 />
                            {t("common.delete")}
                        </DropdownMenuItem>
                    </DropdownMenuContent>
                </DropdownMenu>
            </td>
        </tr>
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
