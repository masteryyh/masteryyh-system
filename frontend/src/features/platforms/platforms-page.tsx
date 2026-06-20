import { useCallback, useEffect, useState, type FormEvent, type ReactNode } from "react";
import {
    Container,
    MoreHorizontal,
    Pencil,
    Plus,
    Server,
    Trash2,
} from "lucide-react";
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
    const { session, logout } = useSession();
    const navigate = useNavigate();
    const token = session?.token ?? "";

    const onUnauthorized = useCallback(() => {
        logout();
        navigate("/login", { replace: true });
    }, [logout, navigate]);

    const [page, setPage] = useState(1);
    const [result, setResult] = useState<PagedResponse<AppPlatform> | null>(
        null,
    );
    const [credentials, setCredentials] = useState<Credential[]>([]);
    const [credentialById, setCredentialById] = useState<
        Record<string, Credential>
    >({});
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [success, setSuccess] = useState("");
    const [formOpen, setFormOpen] = useState(false);
    const [editing, setEditing] = useState<AppPlatform | null>(null);
    const [form, setForm] = useState<PlatformFormState>(emptyForm);
    const [formError, setFormError] = useState("");
    const [saving, setSaving] = useState(false);
    const [deleting, setDeleting] = useState<AppPlatform | null>(null);

    const context = { token, onUnauthorized };

    const loadPlatforms = useCallback(async () => {
        setLoading(true);
        setError("");
        try {
            const [platformPayload, credentialPayload] = await Promise.all([
                apiRequest<unknown>(
                    `/v1/platforms/list?${toQuery({ page, pageSize })}`,
                    {},
                    { token, onUnauthorized },
                ),
                apiRequest<unknown>(
                    `/v1/credentials/list?${toQuery({ page: 1, pageSize: credentialPageSize })}`,
                    {},
                    { token, onUnauthorized },
                ),
            ]);
            const platformData = requirePagedResponse<AppPlatform>(
                platformPayload,
                "App Platform",
            );
            const credentialData = requirePagedResponse<Credential>(
                credentialPayload,
                "凭据",
            );

            const credentialMap = Object.fromEntries(
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
                missingIds.map((id) =>
                    apiRequest<Credential>(
                        `/v1/credentials/info?${toQuery({ id })}`,
                        {},
                        { token, onUnauthorized },
                    ),
                ),
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
            if (platformData.totalPages > 0 && page > platformData.totalPages) {
                setPage(platformData.totalPages);
            }
        } catch (loadError) {
            setResult(null);
            setCredentials([]);
            setCredentialById({});
            setError(
                loadError instanceof Error
                    ? loadError.message
                    : "App Platform 列表加载失败",
            );
        } finally {
            setLoading(false);
        }
    }, [onUnauthorized, page, token]);

    useEffect(() => {
        const timeout = window.setTimeout(() => void loadPlatforms(), 0);
        return () => window.clearTimeout(timeout);
    }, [loadPlatforms]);

    function openCreate() {
        setEditing(null);
        setForm(emptyForm);
        setFormError("");
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
        setFormError("");
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
        setFormError("");
        try {
            const body = buildRequest();
            if (editing) {
                await apiRequest<void>(
                    `/v1/platforms/update/${editing.id}`,
                    { method: "PUT", body: JSON.stringify(body) },
                    context,
                );
                setSuccess("App Platform 已更新，连接状态将异步刷新");
            } else {
                await apiRequest<void>(
                    "/v1/platforms/add",
                    { method: "POST", body: JSON.stringify(body) },
                    context,
                );
                setSuccess("App Platform 已创建，连接正在后台建立");
                setPage(1);
            }
            setFormOpen(false);
            await loadPlatforms();
        } catch (saveError) {
            setFormError(
                saveError instanceof Error
                    ? saveError.message
                    : "App Platform 保存失败",
            );
        } finally {
            setSaving(false);
        }
    }

    async function deletePlatform() {
        if (!deleting) return;
        setSaving(true);
        setFormError("");
        try {
            await apiRequest<void>(
                `/v1/platforms/delete/${deleting.id}`,
                { method: "DELETE" },
                context,
            );
            setDeleting(null);
            setSuccess("App Platform 已删除");
            await loadPlatforms();
        } catch (deleteError) {
            setFormError(
                deleteError instanceof Error
                    ? deleteError.message
                    : "App Platform 删除失败",
            );
        } finally {
            setSaving(false);
        }
    }

    return (
        <div className="space-y-6">
            <PageHeader
                eyebrow="Managed runtimes"
                title="App Platform"
                description="登记运行应用的目标主机，并跟踪 Docker daemon 或 SYSTEMD SSH 连接的就绪状态。"
                action={
                    <Button onClick={openCreate}>
                        <Plus />
                        新增平台
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
                        title="还没有 App Platform"
                        description="添加一台 Docker 或 SYSTEMD 主机，开始纳管 homelab 应用。"
                    />
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full min-w-[980px] text-left text-sm">
                            <thead className="border-b bg-muted/45 text-xs text-muted-foreground">
                                <tr>
                                    <th className="px-4 py-3 font-medium">平台</th>
                                    <th className="px-4 py-3 font-medium">连接</th>
                                    <th className="px-4 py-3 font-medium">访问凭据</th>
                                    <th className="px-4 py-3 font-medium">状态</th>
                                    <th className="px-4 py-3 font-medium">更新时间</th>
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
                                            setFormError("");
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
                                {editing ? "编辑 App Platform" : "新增 App Platform"}
                            </DialogTitle>
                            <DialogDescription>
                                {editing
                                    ? "平台类型创建后不可修改，连接参数更新后会异步重连。"
                                    : "选择目标主机的应用运行方式并填写连接参数。"}
                            </DialogDescription>
                        </DialogHeader>

                        <div className="grid gap-4">
                            <Field label="名称" htmlFor="platform-name">
                                <Input
                                    id="platform-name"
                                    required
                                    value={form.name}
                                    onChange={(event) =>
                                        updateForm("name", event.target.value)
                                    }
                                />
                            </Field>
                            <Field label="描述" htmlFor="platform-description">
                                <Input
                                    id="platform-description"
                                    value={form.description}
                                    onChange={(event) =>
                                        updateForm(
                                            "description",
                                            event.target.value,
                                        )
                                    }
                                />
                            </Field>
                            <Field label="平台类型" htmlFor="platform-type">
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
                                    <option value="SYSTEMD">SYSTEMD</option>
                                    <option value="DOCKER">DOCKER</option>
                                </select>
                            </Field>

                            {form.platformType === "DOCKER" ? (
                                <Field label="Docker Host" htmlFor="docker-host">
                                    <Input
                                        id="docker-host"
                                        required
                                        placeholder="tcp://host:2375"
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
                                    <Field label="SSH Host" htmlFor="ssh-host">
                                        <Input
                                            id="ssh-host"
                                            required
                                            value={form.systemdSSHHost}
                                            onChange={(event) =>
                                                updateForm(
                                                    "systemdSSHHost",
                                                    event.target.value,
                                                )
                                            }
                                        />
                                    </Field>
                                    <Field label="SSH 端口" htmlFor="ssh-port">
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
                                        label="SSH 用户名"
                                        htmlFor="ssh-username"
                                    >
                                        <Input
                                            id="ssh-username"
                                            required
                                            value={form.systemdSSHUsername}
                                            onChange={(event) =>
                                                updateForm(
                                                    "systemdSSHUsername",
                                                    event.target.value,
                                                )
                                            }
                                        />
                                    </Field>
                                    <Field label="访问凭据" htmlFor="credential-id">
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
                                            <option value="">不使用凭据</option>
                                            {credentials.map((credential) => (
                                                <option
                                                    key={credential.id}
                                                    value={credential.id}
                                                >
                                                    {credential.name} · {credential.credentialType === "SSH_PRIVATE_KEY" ? "SSH 私钥" : "密码"}
                                                </option>
                                            ))}
                                        </select>
                                    </Field>
                                    <div className="sm:col-span-2">
                                        <Field
                                            label="Host Keys（可选，每行一个）"
                                            htmlFor="host-keys"
                                        >
                                            <textarea
                                                id="host-keys"
                                                className={textAreaClass}
                                                spellCheck={false}
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
                                {saving ? "保存中..." : "保存平台"}
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
                        <DialogTitle>删除 App Platform</DialogTitle>
                        <DialogDescription>
                            将断开并删除“{deleting?.name}”的平台连接记录。
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
                            onClick={() => void deletePlatform()}
                        >
                            {saving ? "删除中..." : "确认删除"}
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
                            {platform.description || "无描述"}
                        </p>
                    </div>
                </div>
            </td>
            <td className="px-4 py-3">
                <p className="font-mono text-xs font-medium">
                    {platform.platformType}
                </p>
                <p
                    className="mt-1 max-w-64 truncate font-mono text-xs text-muted-foreground"
                    title={endpoint ?? undefined}
                >
                    {endpoint || "—"}
                </p>
            </td>
            <td className="px-4 py-3">
                {credential ? (
                    <div className="max-w-72">
                        <p className="text-xs font-medium">{credential.name}</p>
                        {privateKeyInfo ? (
                            <code
                                className="mt-1 block truncate rounded-md bg-slate-950 px-2 py-1.5 font-mono text-[0.7rem] text-slate-100"
                                title={formatFingerprint(
                                    privateKeyInfo.fingerprint,
                                )}
                            >
                                {formatFingerprint(privateKeyInfo.fingerprint)}
                            </code>
                        ) : (
                            <p className="mt-1 text-xs text-muted-foreground">
                                文本密码
                            </p>
                        )}
                    </div>
                ) : (
                    <span className="text-xs text-muted-foreground">未配置</span>
                )}
            </td>
            <td className="px-4 py-3">
                <span className="inline-flex items-center gap-2 whitespace-nowrap text-xs font-medium">
                    <span
                        className={`size-2 rounded-full ${platform.online ? "bg-emerald-500 shadow-[0_0_0_3px_rgba(16,185,129,0.14)]" : "bg-slate-400"}`}
                    />
                    {platform.online ? "在线" : "离线"}
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
                            <span className="sr-only">平台操作</span>
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
