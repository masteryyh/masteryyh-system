import {
    useCallback,
    useEffect,
    useState,
    type FormEvent,
    type ReactNode,
} from "react";
import {
    Download,
    FileArchive,
    Pencil,
    Plus,
    RefreshCw,
    Trash2,
} from "lucide-react";

import {
    EmptyState,
    ErrorBanner,
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useApi } from "@/hooks/use-api";
import { useNotify } from "@/hooks/use-notify";
import { useTranslation } from "@/hooks/use-translation";
import { formatDate } from "@/lib/formatters";
import type { PagedResponse, StoredFile } from "@/types/api";

const pageSize = 10;

export function FilesPage() {
    const api = useApi();
    const notify = useNotify();
    const { t } = useTranslation();
    const [page, setPage] = useState(1);
    const [result, setResult] = useState<PagedResponse<StoredFile> | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<unknown>(null);
    const [formOpen, setFormOpen] = useState(false);
    const [editing, setEditing] = useState<StoredFile | null>(null);
    const [name, setName] = useState("");
    const [description, setDescription] = useState("");
    const [upload, setUpload] = useState<File | null>(null);
    const [saving, setSaving] = useState(false);
    const [formError, setFormError] = useState<unknown>(null);

    const load = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            setResult(await api.files.list({ page, pageSize }));
        } catch (loadError) {
            setError(loadError);
        } finally {
            setLoading(false);
        }
    }, [api.files, page]);

    useEffect(() => {
        const timeout = window.setTimeout(() => void load(), 0);
        return () => window.clearTimeout(timeout);
    }, [load]);

    function openCreate() {
        setEditing(null);
        setName("");
        setDescription("");
        setUpload(null);
        setFormError(null);
        setFormOpen(true);
    }

    function openEdit(file: StoredFile) {
        setEditing(file);
        setName(file.name);
        setDescription(file.description ?? "");
        setUpload(null);
        setFormError(null);
        setFormOpen(true);
    }

    async function save(event: FormEvent) {
        event.preventDefault();
        setSaving(true);
        setFormError(null);
        try {
            if (editing) {
                await api.files.update(editing.id, {
                    name: name.trim(),
                    description: description.trim(),
                });
                if (upload) {
                    await api.files.replace(editing.id, upload);
                }
            } else {
                if (!upload) return;
                await api.files.create(name.trim(), description.trim(), upload);
                setPage(1);
            }
            notify.success(
                editing ? "files.success.updated" : "files.success.created",
            );
            setFormOpen(false);
            await load();
        } catch (saveError) {
            setFormError(saveError);
        } finally {
            setSaving(false);
        }
    }

    async function remove(file: StoredFile) {
        if (!window.confirm(t("files.deleteConfirm", { name: file.name }))) {
            return;
        }
        try {
            await api.files.remove(file.id);
            notify.success("files.success.deleted");
            await load();
        } catch (removeError) {
            notify.error(removeError, { titleKey: "files.fallback.deleteFailed" });
        }
    }

    return (
        <div className="space-y-6">
            <PageHeader
                eyebrow={t("files.eyebrow")}
                title={t("files.title")}
                description={t("files.description")}
                action={
                    <Button onClick={openCreate}>
                        <Plus />
                        {t("files.addButton")}
                    </Button>
                }
            />
            <ErrorBanner error={error} fallbackKey="files.fallback.loadFailed" />
            <section className="overflow-hidden rounded-xl border bg-card shadow-sm">
                {loading ? (
                    <LoadingState />
                ) : !result?.data.length ? (
                    <EmptyState
                        title={t("files.empty.title")}
                        description={t("files.empty.description")}
                    />
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full min-w-[820px] text-left text-sm">
                            <thead className="border-b bg-muted/45 text-xs text-muted-foreground">
                                <tr>
                                    <th className="px-4 py-3 font-medium">{t("files.columns.name")}</th>
                                    <th className="px-4 py-3 font-medium">{t("files.columns.size")}</th>
                                    <th className="px-4 py-3 font-medium">{t("files.columns.sha256")}</th>
                                    <th className="px-4 py-3 font-medium">{t("files.columns.updatedAt")}</th>
                                    <th className="w-40 px-4 py-3" />
                                </tr>
                            </thead>
                            <tbody className="divide-y">
                                {result.data.map((file) => (
                                    <tr key={file.id} className="hover:bg-muted/25">
                                        <td className="px-4 py-3">
                                            <div className="flex items-center gap-3">
                                                <span className="grid size-9 place-items-center rounded-lg border bg-background">
                                                    <FileArchive className="size-4 text-blue-600" />
                                                </span>
                                                <div>
                                                    <p className="font-medium">{file.name}</p>
                                                    <p className="text-xs text-muted-foreground">
                                                        {file.originalFilename}
                                                    </p>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-4 py-3 font-mono text-xs">
                                            {formatBytes(file.size)}
                                        </td>
                                        <td className="px-4 py-3">
                                            <code className="block max-w-52 truncate text-[0.68rem] text-muted-foreground">
                                                {file.sha256}
                                            </code>
                                        </td>
                                        <td className="px-4 py-3 text-xs text-muted-foreground">
                                            {formatDate(file.updatedAt)}
                                        </td>
                                        <td className="px-4 py-3">
                                            <div className="flex justify-end gap-1">
                                                <Button variant="ghost" size="icon-sm" onClick={() => void api.files.download(file)}>
                                                    <Download />
                                                </Button>
                                                <Button variant="ghost" size="icon-sm" onClick={() => openEdit(file)}>
                                                    <Pencil />
                                                </Button>
                                                <Button variant="ghost" size="icon-sm" onClick={() => void remove(file)}>
                                                    <Trash2 />
                                                </Button>
                                            </div>
                                        </td>
                                    </tr>
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
                <DialogContent className="max-w-lg">
                    <form onSubmit={save} className="space-y-5">
                        <DialogHeader>
                            <DialogTitle>
                                {editing ? t("files.form.editTitle") : t("files.form.createTitle")}
                            </DialogTitle>
                            <DialogDescription>
                                {editing ? t("files.form.editDescription") : t("files.form.createDescription")}
                            </DialogDescription>
                        </DialogHeader>
                        <div className="grid gap-4">
                            <Field label={t("files.form.name")} htmlFor="file-name">
                                <Input id="file-name" required value={name} onChange={(event) => setName(event.target.value)} />
                            </Field>
                            <Field label={t("files.form.descriptionField")} htmlFor="file-description">
                                <Input id="file-description" value={description} onChange={(event) => setDescription(event.target.value)} />
                            </Field>
                            <Field
                                label={editing ? t("files.form.replace") : t("files.form.file")}
                                htmlFor="file-content"
                            >
                                <label className="flex min-h-28 cursor-pointer flex-col items-center justify-center rounded-xl border border-dashed bg-muted/20 px-5 text-center transition hover:bg-muted/35">
                                    {editing ? <RefreshCw className="mb-2 size-5 text-muted-foreground" /> : <FileArchive className="mb-2 size-5 text-blue-600" />}
                                    <span className="text-sm font-medium">
                                        {upload?.name ?? t("files.form.choose")}
                                    </span>
                                    <span className="mt-1 text-xs text-muted-foreground">
                                        {t("files.form.limit")}
                                    </span>
                                    <input
                                        id="file-content"
                                        type="file"
                                        className="sr-only"
                                        required={!editing}
                                        onChange={(event) => setUpload(event.target.files?.[0] ?? null)}
                                    />
                                </label>
                            </Field>
                        </div>
                        <ErrorBanner error={formError} fallbackKey="files.fallback.saveFailed" />
                        <DialogFooter>
                            <Button type="button" variant="outline" onClick={() => setFormOpen(false)}>
                                {t("common.cancel")}
                            </Button>
                            <Button type="submit" disabled={saving || (!editing && !upload)}>
                                {saving ? t("common.saving") : t("common.save")}
                            </Button>
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

function formatBytes(size: number) {
    if (size < 1024) return `${size} B`;
    if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KiB`;
    return `${(size / 1024 / 1024).toFixed(1)} MiB`;
}
