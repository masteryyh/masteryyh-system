import {
    useCallback,
    useEffect,
    useState,
    type FormEvent,
    type ReactNode,
} from "react";
import { KeyRound, MoreHorizontal, Pencil, Plus, Trash2 } from "lucide-react";
import { useNavigate } from "react-router";

import {
    EmptyState,
    InlineMessage,
    LoadingState,
    PageHeader,
    Pagination,
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
import { useSession } from "@/hooks/use-session";
import { apiRequest, requirePagedResponse, toQuery } from "@/lib/api";
import { formatDate, formatFingerprint } from "@/lib/formatters";
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
const textAreaClass =
    "min-h-24 w-full resize-y rounded-lg border border-input bg-transparent px-2.5 py-2 font-mono text-sm outline-none placeholder:font-sans focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50";

const credentialTypeLabels: Record<CredentialType, string> = {
    SSH_PRIVATE_KEY: "SSH 私钥",
    SSH_PUBLIC_KEY: "SSH 公钥",
    TEXT_PASSWORD: "文本密码",
};

interface CredentialFormState {
    name: string;
    description: string;
    credentialType: CredentialType;
    sshPublicKey: string;
    sshPrivateKey: string;
    sshPrivateKeyPassphrase: string;
    password: string;
}

const emptyForm: CredentialFormState = {
    name: "",
    description: "",
    credentialType: "SSH_PRIVATE_KEY",
    sshPublicKey: "",
    sshPrivateKey: "",
    sshPrivateKeyPassphrase: "",
    password: "",
};

export function CredentialsPage() {
    const { session, logout } = useSession();
    const navigate = useNavigate();
    const token = session?.token ?? "";

    const onUnauthorized = useCallback(() => {
        logout();
        navigate("/login", { replace: true });
    }, [logout, navigate]);

    const [page, setPage] = useState(1);
    const [result, setResult] = useState<PagedResponse<Credential> | null>(
        null,
    );
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [success, setSuccess] = useState("");
    const [formOpen, setFormOpen] = useState(false);
    const [editing, setEditing] = useState<Credential | null>(null);
    const [form, setForm] = useState<CredentialFormState>(emptyForm);
    const [formError, setFormError] = useState("");
    const [saving, setSaving] = useState(false);
    const [deleting, setDeleting] = useState<Credential | null>(null);

    const context = { token, onUnauthorized };

    const loadCredentials = useCallback(async () => {
        setLoading(true);
        setError("");
        try {
            const payload = await apiRequest<unknown>(
                `/v1/credentials/list?${toQuery({ page, pageSize })}`,
                {},
                { token, onUnauthorized },
            );
            const data = requirePagedResponse<Credential>(payload, "凭据");
            setResult(data);
            if (data.totalPages > 0 && page > data.totalPages) {
                setPage(data.totalPages);
            }
        } catch (loadError) {
            setResult(null);
            setError(
                loadError instanceof Error
                    ? loadError.message
                    : "凭据列表加载失败",
            );
        } finally {
            setLoading(false);
        }
    }, [onUnauthorized, page, token]);

    useEffect(() => {
        const timeout = window.setTimeout(() => void loadCredentials(), 0);
        return () => window.clearTimeout(timeout);
    }, [loadCredentials]);

    function openCreate() {
        setEditing(null);
        setForm(emptyForm);
        setFormError("");
        setFormOpen(true);
    }

    function openEdit(credential: Credential) {
        setEditing(credential);
        setForm({
            ...emptyForm,
            name: credential.name,
            description: credential.description ?? "",
            credentialType: credential.credentialType,
        });
        setFormError("");
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
        setFormError("");

        try {
            if (editing) {
                const body: UpdateCredentialRequest = {
                    name: form.name.trim(),
                    description: form.description.trim(),
                };
                await apiRequest<void>(
                    `/v1/credentials/update/${editing.id}`,
                    { method: "PUT", body: JSON.stringify(body) },
                    context,
                );
                setSuccess("凭据已更新");
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
                } else {
                    body.password = form.password;
                }
                await apiRequest<void>(
                    "/v1/credentials/add",
                    { method: "POST", body: JSON.stringify(body) },
                    context,
                );
                setSuccess("凭据已创建");
                setPage(1);
            }
            setFormOpen(false);
            await loadCredentials();
        } catch (saveError) {
            setFormError(
                saveError instanceof Error
                    ? saveError.message
                    : "凭据保存失败",
            );
        } finally {
            setSaving(false);
        }
    }

    async function deleteCredential() {
        if (!deleting) return;
        setSaving(true);
        setFormError("");
        try {
            await apiRequest<void>(
                `/v1/credentials/delete/${deleting.id}`,
                { method: "DELETE" },
                context,
            );
            setDeleting(null);
            setSuccess("凭据已删除");
            await loadCredentials();
        } catch (deleteError) {
            setFormError(
                deleteError instanceof Error
                    ? deleteError.message
                    : "凭据删除失败",
            );
        } finally {
            setSaving(false);
        }
    }

    return (
        <div className="space-y-6">
            <PageHeader
                eyebrow="Access material"
                title="凭证管理"
                description="集中管理主机登录所需的密钥与密码。敏感内容只在创建时提交，保存后不再回显。"
                action={
                    <Button onClick={openCreate}>
                        <Plus />
                        新增凭据
                    </Button>
                }
            />

            {success ? (
                <InlineMessage variant="success">{success}</InlineMessage>
            ) : null}
            {error ? <InlineMessage>{error}</InlineMessage> : null}

            <section className="w-full max-w-full overflow-hidden rounded-xl border bg-card shadow-sm">
                {loading ? (
                    <LoadingState />
                ) : !result?.data.length ? (
                    <EmptyState
                        title="还没有凭据"
                        description="先添加用于 SYSTEMD 主机认证的 SSH 私钥或文本密码。"
                    />
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full min-w-[880px] text-left text-sm">
                            <thead className="border-b bg-muted/45 text-xs text-muted-foreground">
                                <tr>
                                    <th className="px-4 py-3 font-medium">名称</th>
                                    <th className="px-4 py-3 font-medium">类型</th>
                                    <th className="px-4 py-3 font-medium">算法信息</th>
                                    <th className="px-4 py-3 font-medium">公钥指纹</th>
                                    <th className="px-4 py-3 font-medium">更新时间</th>
                                    <th className="w-12 px-4 py-3" />
                                </tr>
                            </thead>
                            <tbody className="divide-y">
                                {result.data.map((credential) => (
                                    <CredentialRow
                                        key={credential.id}
                                        credential={credential}
                                        onEdit={() => openEdit(credential)}
                                        onDelete={() => {
                                            setFormError("");
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
                                {editing ? "编辑凭据" : "新增凭据"}
                            </DialogTitle>
                            <DialogDescription>
                                {editing
                                    ? "凭据类型和敏感内容不可修改。"
                                    : "选择凭据类型后填写对应的认证内容。"}
                            </DialogDescription>
                        </DialogHeader>

                        <div className="grid gap-4">
                            <Field label="名称" htmlFor="credential-name">
                                <Input
                                    id="credential-name"
                                    required
                                    value={form.name}
                                    onChange={(event) =>
                                        updateForm("name", event.target.value)
                                    }
                                />
                            </Field>
                            <Field label="描述" htmlFor="credential-description">
                                <Input
                                    id="credential-description"
                                    value={form.description}
                                    onChange={(event) =>
                                        updateForm(
                                            "description",
                                            event.target.value,
                                        )
                                    }
                                />
                            </Field>
                            <Field label="类型" htmlFor="credential-type">
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
                                    {Object.entries(credentialTypeLabels).map(
                                        ([value, label]) => (
                                            <option key={value} value={value}>
                                                {label}
                                            </option>
                                        ),
                                    )}
                                </select>
                            </Field>

                            {!editing &&
                            form.credentialType === "SSH_PRIVATE_KEY" ? (
                                <>
                                    <Field
                                        label="SSH 私钥"
                                        htmlFor="ssh-private-key"
                                    >
                                        <textarea
                                            id="ssh-private-key"
                                            className={textAreaClass}
                                            required
                                            spellCheck={false}
                                            placeholder="-----BEGIN OPENSSH PRIVATE KEY-----"
                                            value={form.sshPrivateKey}
                                            onChange={(event) =>
                                                updateForm(
                                                    "sshPrivateKey",
                                                    event.target.value,
                                                )
                                            }
                                        />
                                    </Field>
                                    <Field
                                        label="私钥口令（可选）"
                                        htmlFor="ssh-passphrase"
                                    >
                                        <Input
                                            id="ssh-passphrase"
                                            type="password"
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
                                    label="SSH 公钥"
                                    htmlFor="ssh-public-key"
                                >
                                    <textarea
                                        id="ssh-public-key"
                                        className={textAreaClass}
                                        required
                                        spellCheck={false}
                                        placeholder="ssh-ed25519 AAAA..."
                                        value={form.sshPublicKey}
                                        onChange={(event) =>
                                            updateForm(
                                                "sshPublicKey",
                                                event.target.value,
                                            )
                                        }
                                    />
                                </Field>
                            ) : null}

                            {!editing &&
                            form.credentialType === "TEXT_PASSWORD" ? (
                                <Field label="密码" htmlFor="text-password">
                                    <Input
                                        id="text-password"
                                        type="password"
                                        required
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
                        </div>

                        {formError ? (
                            <InlineMessage>{formError}</InlineMessage>
                        ) : null}
                        <DialogFooter>
                            <Button
                                type="button"
                                variant="outline"
                                onClick={() => setFormOpen(false)}
                            >
                                取消
                            </Button>
                            <Button type="submit" disabled={saving}>
                                {saving ? "保存中..." : "保存凭据"}
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
                        <DialogTitle>删除凭据</DialogTitle>
                        <DialogDescription>
                            将删除“{deleting?.name}”。已被平台使用的凭据无法删除。
                        </DialogDescription>
                    </DialogHeader>
                    {formError ? (
                        <InlineMessage>{formError}</InlineMessage>
                    ) : null}
                    <DialogFooter>
                        <Button
                            type="button"
                            variant="outline"
                            onClick={() => setDeleting(null)}
                        >
                            取消
                        </Button>
                        <Button
                            type="button"
                            variant="destructive"
                            disabled={saving}
                            onClick={() => void deleteCredential()}
                        >
                            {saving ? "删除中..." : "确认删除"}
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
    onDelete,
}: {
    credential: Credential;
    onEdit: () => void;
    onDelete: () => void;
}) {
    const keyInfo = credential.sshKeyInfo;
    return (
        <tr className="transition-colors hover:bg-muted/25">
            <td className="px-4 py-3">
                <div className="flex items-center gap-3">
                    <span className="grid size-8 shrink-0 place-items-center rounded-lg border bg-background">
                        <KeyRound className="size-4 text-muted-foreground" />
                    </span>
                    <div className="min-w-0">
                        <p className="font-medium">{credential.name}</p>
                        <p className="max-w-52 truncate text-xs text-muted-foreground">
                            {credential.description || "无描述"}
                        </p>
                    </div>
                </div>
            </td>
            <td className="px-4 py-3">
                <span className="whitespace-nowrap rounded-md border bg-muted/35 px-2 py-1 text-xs">
                    {credentialTypeLabels[credential.credentialType]}
                </span>
            </td>
            <td className="px-4 py-3">
                {keyInfo ? (
                    <div className="text-xs">
                        <p className="font-mono font-medium">
                            {keyInfo.keyType}
                            {keyInfo.bitLength > 0
                                ? ` · ${keyInfo.bitLength} bit`
                                : ""}
                        </p>
                        <p className="mt-1 text-muted-foreground">
                            {keyInfo.curveName || "非椭圆曲线密钥"}
                        </p>
                    </div>
                ) : (
                    <span className="text-xs text-muted-foreground">不适用</span>
                )}
            </td>
            <td className="px-4 py-3">
                {keyInfo ? (
                    <code
                        className="block max-w-64 truncate rounded-md bg-slate-950 px-2 py-1.5 font-mono text-[0.7rem] text-slate-100"
                        title={formatFingerprint(keyInfo.fingerprint)}
                    >
                        {formatFingerprint(keyInfo.fingerprint)}
                    </code>
                ) : (
                    <span className="text-xs text-muted-foreground">—</span>
                )}
            </td>
            <td className="px-4 py-3 text-xs text-muted-foreground">
                {formatDate(credential.updatedAt)}
            </td>
            <td className="px-4 py-3">
                <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon-sm">
                            <MoreHorizontal />
                            <span className="sr-only">凭据操作</span>
                        </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-32">
                        <DropdownMenuItem onClick={onEdit}>
                            <Pencil />
                            编辑
                        </DropdownMenuItem>
                        <DropdownMenuItem variant="destructive" onClick={onDelete}>
                            <Trash2 />
                            删除
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
