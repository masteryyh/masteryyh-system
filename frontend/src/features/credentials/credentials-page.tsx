import {
    useCallback,
    useEffect,
    useState,
    type FormEvent,
    type ReactNode,
} from "react";
import {
    Eye,
    FileBadge,
    KeyRound,
    Info,
    MoreHorizontal,
    Pencil,
    Plus,
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
import { CodeEditor } from "@/components/code-editor";
import { DateTimePicker } from "@/components/ui/datetime-picker";
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
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useApi } from "@/hooks/use-api";
import { useNotify } from "@/hooks/use-notify";
import { useTranslation } from "@/hooks/use-translation";
import { formatCurveName, formatDate, formatPublicKeyAlgorithm, formatSshKeyType } from "@/lib/formatters";
import { CredentialDetailDialog } from "@/features/credentials/credential-detail-dialog";
import { CredentialStatusBadge } from "@/features/credentials/credential-status-badge";
import { ExpiryIndicator } from "@/features/credentials/expiry-indicator";
import { FingerprintBadge } from "@/features/credentials/fingerprint-badge";
import type {
    AddCredentialRequest,
    Credential,
    CredentialType,
    PagedResponse,
    UpdateCredentialRequest,
} from "@/types/api";

const pageSize = 10;
const controlClass =
    "h-8 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50";

const credentialTypes: CredentialType[] = [
    "SSH_PRIVATE_KEY",
    "SSH_PUBLIC_KEY",
    "TEXT_PASSWORD",
    "X509_CERTIFICATE",
];

interface CredentialFormState {
    name: string;
    description: string;
    credentialType: CredentialType;
    sshPublicKey: string;
    sshPrivateKey: string;
    sshPrivateKeyPassphrase: string;
    password: string;
    certificate: string;
    certificatePrivateKey: string;
    certificatePrivateKeyPassphrase: string;
    expiresAt: Date | null;
}

const emptyForm: CredentialFormState = {
    name: "",
    description: "",
    credentialType: "SSH_PRIVATE_KEY",
    sshPublicKey: "",
    sshPrivateKey: "",
    sshPrivateKeyPassphrase: "",
    password: "",
    certificate: "",
    certificatePrivateKey: "",
    certificatePrivateKeyPassphrase: "",
    expiresAt: null,
};

/**
 * 与后端 LocalDateTime 对齐：写出 `yyyy-MM-ddTHH:mm:ss`（不带时区后缀，Jackson 默认按本地解析）。
 */
function formatLocalDateTime(date: Date): string {
    const pad = (n: number) => n.toString().padStart(2, "0");
    return (
        `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}` +
        `T${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`
    );
}

export function CredentialsPage() {
    const api = useApi();
    const notify = useNotify();
    const { t } = useTranslation();

    const [page, setPage] = useState(1);
    const [result, setResult] = useState<PagedResponse<Credential> | null>(
        null,
    );
    const [loading, setLoading] = useState(true);
    const [loadError, setLoadError] = useState<unknown>(null);
    const [successKey, setSuccessKey] = useState("");
    const [formOpen, setFormOpen] = useState(false);
    const [editing, setEditing] = useState<Credential | null>(null);
    const [form, setForm] = useState<CredentialFormState>(emptyForm);
    const [formError, setFormError] = useState<unknown>(null);
    const [saving, setSaving] = useState(false);
    const [deleting, setDeleting] = useState<Credential | null>(null);
    const [deleteError, setDeleteError] = useState<unknown>(null);
    const [detailing, setDetailing] = useState<Credential | null>(null);

    const loadCredentials = useCallback(async () => {
        setLoading(true);
        setLoadError(null);
        try {
            const data = await api.credentials.list({ page, pageSize });
            setResult(data);
            if (data.totalPages > 0 && page > data.totalPages) {
                setPage(data.totalPages);
            }
        } catch (error) {
            setResult(null);
            setLoadError(error);
        } finally {
            setLoading(false);
        }
    }, [api.credentials, page]);

    useEffect(() => {
        const timeout = window.setTimeout(() => void loadCredentials(), 0);
        return () => window.clearTimeout(timeout);
    }, [loadCredentials]);

    function openCreate() {
        setEditing(null);
        setForm(emptyForm);
        setFormError(null);
        setFormOpen(true);
    }

    function openEdit(credential: Credential) {
        setEditing(credential);
        setForm({
            ...emptyForm,
            name: credential.name,
            description: credential.description ?? "",
            credentialType: credential.credentialType,
            expiresAt: credential.expiresAt ? new Date(credential.expiresAt) : null,
        });
        setFormError(null);
        setFormOpen(true);
    }

    function updateForm<Key extends keyof CredentialFormState>(
        key: Key,
        value: CredentialFormState[Key],
    ) {
        setForm((current) => ({ ...current, [key]: value }));
    }

    async function saveCredential(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();
        setSaving(true);
        setFormError(null);

        try {
            if (editing) {
                const body: UpdateCredentialRequest = {
                    name: form.name.trim(),
                    description: form.description.trim(),
                };
                // X509 凭据的 expiresAt 由证书 notAfter 决定，不再下发。
                if (editing.credentialType !== "X509_CERTIFICATE") {
                    body.expiresAt = form.expiresAt
                        ? formatLocalDateTime(form.expiresAt)
                        : null;
                }
                await api.credentials.update(editing.id, body);
                setSuccessKey("credentials.success.updated");
                notify.success("credentials.success.updated");
            } else {
                const body: AddCredentialRequest = {
                    name: form.name.trim(),
                    description: form.description.trim(),
                    credentialType: form.credentialType,
                };
                if (form.credentialType === "SSH_PRIVATE_KEY") {
                    body.sshPrivateKey = form.sshPrivateKey.trim();
                    body.sshPrivateKeyPassphrase =
                        form.sshPrivateKeyPassphrase;
                } else if (form.credentialType === "SSH_PUBLIC_KEY") {
                    body.sshPublicKey = form.sshPublicKey.trim();
                } else if (form.credentialType === "X509_CERTIFICATE") {
                    body.certificate = form.certificate.trim();
                    body.certificatePrivateKey =
                        form.certificatePrivateKey.trim();
                    body.certificatePrivateKeyPassphrase =
                        form.certificatePrivateKeyPassphrase;
                } else {
                    body.password = form.password;
                }
                // 非 X509 凭据允许选填过期时间；X509 服务端忽略入参并写入证书 notAfter。
                if (form.credentialType !== "X509_CERTIFICATE") {
                    body.expiresAt = form.expiresAt
                        ? formatLocalDateTime(form.expiresAt)
                        : null;
                }
                await api.credentials.create(body);
                setSuccessKey("credentials.success.created");
                notify.success("credentials.success.created");
                setPage(1);
            }
            setFormOpen(false);
            await loadCredentials();
        } catch (saveError) {
            setFormError(saveError);
        } finally {
            setSaving(false);
        }
    }

    async function deleteCredential() {
        if (!deleting) return;
        setSaving(true);
        setDeleteError(null);
        try {
            await api.credentials.remove(deleting.id);
            setDeleting(null);
            setSuccessKey("credentials.success.deleted");
            notify.success("credentials.success.deleted");
            await loadCredentials();
        } catch (error) {
            setDeleteError(error);
        } finally {
            setSaving(false);
        }
    }

    const isCertificate = form.credentialType === "X509_CERTIFICATE";

    return (
        <div className="space-y-6">
            <PageHeader
                eyebrow={t("credentials.eyebrow")}
                title={t("credentials.title")}
                description={t("credentials.description")}
                action={
                    <Button onClick={openCreate}>
                        <Plus />
                        {t("credentials.addButton")}
                    </Button>
                }
            />

            {successKey ? <SuccessBanner messageKey={successKey} /> : null}
            <ErrorBanner
                error={loadError}
                fallbackKey="credentials.fallback.loadFailed"
            />

            <section className="w-full max-w-full overflow-hidden rounded-xl border bg-card shadow-sm">
                {loading ? (
                    <LoadingState />
                ) : !result?.data.length ? (
                    <EmptyState
                        title={t("credentials.empty.title")}
                        description={t("credentials.empty.description")}
                    />
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full min-w-[1040px] text-left text-sm">
                            <thead className="border-b bg-muted/45 text-xs text-muted-foreground">
                                <tr>
                                    <th className="px-4 py-3 font-medium">
                                        {t("credentials.columns.name")}
                                    </th>
                                    <th className="px-4 py-3 font-medium">
                                        {t("credentials.columns.type")}
                                    </th>
                                    <th className="px-4 py-3 font-medium">
                                        {t("credentials.columns.fingerprint")}
                                    </th>
                                    <th className="px-4 py-3 font-medium">
                                        {t("credentials.columns.status")}
                                    </th>
                                    <th className="px-4 py-3 font-medium">
                                        {t("credentials.columns.expiresAt")}
                                    </th>
                                    <th className="px-4 py-3 font-medium">
                                        {t("credentials.columns.updatedAt")}
                                    </th>
                                    <th className="w-12 px-4 py-3" />
                                </tr>
                            </thead>
                            <tbody className="divide-y">
                                {result.data.map((credential) => (
                                    <CredentialRow
                                        key={credential.id}
                                        credential={credential}
                                        onEdit={() => openEdit(credential)}
                                        onDetails={() => setDetailing(credential)}
                                        onDelete={() => {
                                            setDeleteError(null);
                                            setDeleting(credential);
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
                    <form onSubmit={saveCredential} className="space-y-5">
                        <DialogHeader>
                            <DialogTitle>
                                {editing
                                    ? t("credentials.form.editTitle")
                                    : t("credentials.form.createTitle")}
                            </DialogTitle>
                            <DialogDescription>
                                {editing
                                    ? t("credentials.form.editDescription")
                                    : t("credentials.form.createDescription")}
                            </DialogDescription>
                        </DialogHeader>

                        <div className="grid gap-4">
                            <Field
                                label={t("credentials.form.name")}
                                htmlFor="credential-name"
                            >
                                <Input
                                    id="credential-name"
                                    required
                                    placeholder={t(
                                        "credentials.form.namePlaceholder",
                                    )}
                                    value={form.name}
                                    onChange={(event) =>
                                        updateForm("name", event.target.value)
                                    }
                                />
                            </Field>
                            <Field
                                label={t("credentials.form.descriptionField")}
                                htmlFor="credential-description"
                            >
                                <Input
                                    id="credential-description"
                                    placeholder={t(
                                        "credentials.form.descriptionPlaceholder",
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
                                label={t("credentials.form.credentialType")}
                                htmlFor="credential-type"
                            >
                                <select
                                    id="credential-type"
                                    className={controlClass}
                                    disabled={Boolean(editing)}
                                    value={form.credentialType}
                                    onChange={(event) =>
                                        updateForm(
                                            "credentialType",
                                            event.target.value as CredentialType,
                                        )
                                    }
                                >
                                    {credentialTypes.map((value) => (
                                        <option key={value} value={value}>
                                            {t(`credentials.type.${value}`)}
                                        </option>
                                    ))}
                                </select>
                            </Field>

                            {/* 过期时间：非 X509 显示 DateTimePicker；X509 仅在编辑时显示只读提示 */}
                            {isCertificate ? (
                                editing ? (
                                    <div className="flex items-start gap-2 rounded-lg border border-dashed bg-muted/25 px-3 py-2.5 text-xs text-muted-foreground">
                                        <Info className="mt-0.5 size-3.5 shrink-0" />
                                        <span className="leading-relaxed">
                                            {t(
                                                "credentials.form.expiresAtCertHint",
                                                {
                                                    date: editing.expiresAt
                                                        ? formatDate(
                                                              editing.expiresAt,
                                                          )
                                                        : t("common.dash"),
                                                },
                                            )}
                                        </span>
                                    </div>
                                ) : null
                            ) : (
                                <Field
                                    label={t("credentials.form.expiresAt")}
                                    htmlFor="credential-expires-at"
                                    hint={t(
                                        "credentials.form.expiresAtHint",
                                    )}
                                >
                                    <DateTimePicker
                                        id="credential-expires-at"
                                        value={form.expiresAt}
                                        onChange={(next) =>
                                            updateForm("expiresAt", next)
                                        }
                                        placeholder={t(
                                            "credentials.form.expiresAtPlaceholder",
                                        )}
                                    />
                                </Field>
                            )}

                            {!editing &&
                            form.credentialType === "SSH_PRIVATE_KEY" ? (
                                <>
                                    <Field
                                        label={t(
                                            "credentials.form.sshPrivateKey",
                                        )}
                                        htmlFor="ssh-private-key"
                                    >
                                        <CodeEditor
                                            id="ssh-private-key"
                                            language="pem"
                                            value={form.sshPrivateKey}
                                            onChange={(next) =>
                                                updateForm(
                                                    "sshPrivateKey",
                                                    next,
                                                )
                                            }
                                            accept=".key,.pem,.pub,text/plain"
                                            onUploadError={notify.error}
                                        />
                                    </Field>
                                    <Field
                                        label={t(
                                            "credentials.form.sshPrivateKeyPassphrase",
                                        )}
                                        htmlFor="ssh-passphrase"
                                    >
                                        <Input
                                            id="ssh-passphrase"
                                            type="password"
                                            placeholder={t(
                                                "credentials.form.sshPrivateKeyPassphrasePlaceholder",
                                            )}
                                            value={form.sshPrivateKeyPassphrase}
                                            onChange={(event) =>
                                                updateForm(
                                                    "sshPrivateKeyPassphrase",
                                                    event.target.value,
                                                )
                                            }
                                        />
                                    </Field>
                                </>
                            ) : null}

                            {!editing &&
                            form.credentialType === "SSH_PUBLIC_KEY" ? (
                                <Field
                                    label={t("credentials.form.sshPublicKey")}
                                    htmlFor="ssh-public-key"
                                >
                                    <CodeEditor
                                        id="ssh-public-key"
                                        language="pem"
                                        height={160}
                                        value={form.sshPublicKey}
                                        onChange={(next) =>
                                            updateForm("sshPublicKey", next)
                                        }
                                        accept=".pub,.pem,text/plain"
                                        onUploadError={notify.error}
                                    />
                                </Field>
                            ) : null}

                            {!editing &&
                            form.credentialType === "TEXT_PASSWORD" ? (
                                <Field
                                    label={t("credentials.form.password")}
                                    htmlFor="text-password"
                                >
                                    <Input
                                        id="text-password"
                                        type="password"
                                        required
                                        placeholder={t(
                                            "credentials.form.passwordPlaceholder",
                                        )}
                                        value={form.password}
                                        onChange={(event) =>
                                            updateForm(
                                                "password",
                                                event.target.value,
                                            )
                                        }
                                    />
                                </Field>
                            ) : null}

                            {!editing &&
                            form.credentialType === "X509_CERTIFICATE" ? (
                                <>
                                    <Field
                                        label={t(
                                            "credentials.form.certificate",
                                        )}
                                        htmlFor="certificate"
                                    >
                                        <CodeEditor
                                            id="certificate"
                                            language="pem"
                                            height={220}
                                            value={form.certificate}
                                            onChange={(next) =>
                                                updateForm("certificate", next)
                                            }
                                            accept=".pem,.crt,.cer,text/plain"
                                            onUploadError={notify.error}
                                        />
                                    </Field>
                                    <Field
                                        label={t(
                                            "credentials.form.certificatePrivateKey",
                                        )}
                                        htmlFor="certificate-private-key"
                                    >
                                        <CodeEditor
                                            id="certificate-private-key"
                                            language="pem"
                                            height={220}
                                            value={form.certificatePrivateKey}
                                            onChange={(next) =>
                                                updateForm(
                                                    "certificatePrivateKey",
                                                    next,
                                                )
                                            }
                                            accept=".key,.pem,text/plain"
                                            onUploadError={notify.error}
                                        />
                                    </Field>
                                    <Field
                                        label={t(
                                            "credentials.form.certificatePassphrase",
                                        )}
                                        htmlFor="certificate-passphrase"
                                    >
                                        <Input
                                            id="certificate-passphrase"
                                            type="password"
                                            placeholder={t(
                                                "credentials.form.certificatePassphrasePlaceholder",
                                            )}
                                            value={
                                                form.certificatePrivateKeyPassphrase
                                            }
                                            onChange={(event) =>
                                                updateForm(
                                                    "certificatePrivateKeyPassphrase",
                                                    event.target.value,
                                                )
                                            }
                                        />
                                    </Field>
                                </>
                            ) : null}
                        </div>

                        <ErrorBanner
                            error={formError}
                            fallbackKey="credentials.fallback.saveFailed"
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
                                      ? t("credentials.form.submitEdit")
                                      : t("credentials.form.submitCreate")}
                            </Button>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>

            <CredentialDetailDialog
                credential={detailing}
                open={detailing !== null}
                onOpenChange={(open) => {
                    if (!open) setDetailing(null);
                }}
            />

            <Dialog
                open={Boolean(deleting)}
                onOpenChange={(open) => {
                    if (!open) setDeleting(null);
                }}
            >
                <DialogContent className="max-w-md">
                    <DialogHeader>
                        <DialogTitle>
                            {t("credentials.deleteDialog.title")}
                        </DialogTitle>
                        <DialogDescription>
                            {t("credentials.deleteDialog.description", {
                                name: deleting?.name ?? "",
                            })}
                        </DialogDescription>
                    </DialogHeader>
                    <ErrorBanner
                        error={deleteError}
                        fallbackKey="credentials.fallback.deleteFailed"
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
                            onClick={() => void deleteCredential()}
                        >
                            {saving
                                ? t("common.deleting")
                                : t("credentials.deleteDialog.confirm")}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}

function CredentialRow({
    credential,
    onEdit,
    onDetails,
    onDelete,
}: {
    credential: Credential;
    onEdit: () => void;
    onDetails: () => void;
    onDelete: () => void;
}) {
    const { t } = useTranslation();
    const keyInfo = credential.sshKeyInfo;
    const certInfo = credential.certificateInfo;
    const isCertificate = credential.credentialType === "X509_CERTIFICATE";
    const Icon = isCertificate ? FileBadge : KeyRound;

    const descriptionFallback = (() => {
        if (credential.description) return credential.description;
        if (isCertificate && certInfo) {
            const parts: string[] = [];
            if (certInfo.subject) parts.push(certInfo.subject);
            if (certInfo.publicKeyAlgorithm) {
                const algo = formatPublicKeyAlgorithm(
                    certInfo.publicKeyAlgorithm,
                );
                parts.push(
                    certInfo.publicKeyBitLength > 0
                        ? `${algo} · ${certInfo.publicKeyBitLength} bit`
                        : algo,
                );
            }
            return parts.length > 0 ? parts.join(" · ") : null;
        }
        if (keyInfo) {
            const algo = formatSshKeyType(keyInfo.keyType);
            const curve = formatCurveName(keyInfo.curveName);
            const segments = [algo];
            if (curve) segments.push(curve);
            if (keyInfo.bitLength > 0) segments.push(`${keyInfo.bitLength} bit`);
            return segments.join(" · ");
        }
        return null;
    })();

    const fingerprintCell = (() => {
        if (isCertificate && certInfo) {
            return <FingerprintBadge fingerprint={certInfo.fingerprintSha256} />;
        }
        if (keyInfo) {
            return <FingerprintBadge fingerprint={keyInfo.fingerprint} />;
        }
        return (
            <span className="text-xs text-muted-foreground">
                {t("common.dash")}
            </span>
        );
    })();

    return (
        <tr className="transition-colors hover:bg-muted/25">
            <td className="px-4 py-3">
                <div className="flex items-center gap-3">
                    <span className="grid size-8 shrink-0 place-items-center rounded-lg border bg-background">
                        <Icon className="size-4 text-muted-foreground" />
                    </span>
                    <div className="min-w-0">
                        <p className="font-medium">{credential.name}</p>
                        {descriptionFallback ? (
                            <p className="mt-0.5 max-w-72 truncate text-[11px] text-muted-foreground">
                                {descriptionFallback}
                            </p>
                        ) : null}
                    </div>
                </div>
            </td>
            <td className="px-4 py-3">
                <span className="whitespace-nowrap rounded-md border bg-muted/35 px-2 py-1 text-xs">
                    {t(`credentials.type.${credential.credentialType}`)}
                </span>
            </td>
            <td className="px-4 py-3">{fingerprintCell}</td>
            <td className="px-4 py-3">
                <CredentialStatusBadge status={credential.status} />
            </td>
            <td className="px-4 py-3">
                <div className="space-y-1">
                    <ExpiryIndicator expiresAt={credential.expiresAt} />
                    {credential.expiresAt ? (
                        <p className="font-mono text-[10px] text-muted-foreground/80">
                            {formatDate(credential.expiresAt)}
                        </p>
                    ) : null}
                </div>
            </td>
            <td className="px-4 py-3 text-xs text-muted-foreground">
                {formatDate(credential.updatedAt)}
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
                    <DropdownMenuContent align="end" className="w-36">
                        <DropdownMenuItem onClick={onDetails}>
                            <Eye />
                            {t("common.detail")}
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
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
    hint,
    children,
}: {
    label: string;
    htmlFor: string;
    hint?: string;
    children: ReactNode;
}) {
    return (
        <div className="space-y-2">
            <Label htmlFor={htmlFor}>{label}</Label>
            {children}
            {hint ? (
                <p className="text-[11px] text-muted-foreground">{hint}</p>
            ) : null}
        </div>
    );
}
