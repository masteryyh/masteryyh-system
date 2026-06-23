import { useCallback, useState } from "react";
import {
    Check,
    Copy,
    FileBadge,
    Fingerprint,
    KeyRound,
    Lock,
    ShieldCheck,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { CredentialStatusBadge } from "@/features/credentials/credential-status-badge";
import { ExpiryIndicator } from "@/features/credentials/expiry-indicator";
import { useNotify } from "@/hooks/use-notify";
import { useTranslation } from "@/hooks/use-translation";
import { formatDate, formatCurveName, formatFingerprint, formatPublicKeyAlgorithm, formatSshKeyType } from "@/lib/formatters";
import type { Credential } from "@/types/api";

/**
 * 只读凭据检查器。原始 SSH 私钥、证书私钥、证书 PEM 与文本密码均不由后端下发。
 */
export function CredentialDetailDialog({
    credential,
    open,
    onOpenChange,
}: {
    credential: Credential | null;
    open: boolean;
    onOpenChange: (open: boolean) => void;
}) {
    const { t } = useTranslation();

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-h-[90vh] max-w-4xl grid-rows-[auto_minmax(0,1fr)_auto] gap-0 overflow-hidden p-0">
                <DialogHeader className="border-b px-6 py-5 pr-14">
                    <div className="flex items-start gap-3">
                        <span className="grid size-10 shrink-0 place-items-center rounded-lg border bg-muted/25 shadow-sm">
                            {credential?.credentialType === "X509_CERTIFICATE" ? (
                                <FileBadge className="size-5 text-blue-600" />
                            ) : credential?.credentialType === "TEXT_PASSWORD" ? (
                                <Lock className="size-5 text-muted-foreground" />
                            ) : (
                                <KeyRound className="size-5 text-blue-600" />
                            )}
                        </span>
                        <div className="min-w-0 flex-1 space-y-1.5">
                            <DialogTitle className="truncate text-base leading-tight">
                                {credential?.name ?? ""}
                            </DialogTitle>
                            {credential ? (
                                <div className="flex flex-wrap items-center gap-1.5">
                                    <span className="rounded border bg-muted/35 px-1.5 py-0.5 font-mono text-[0.62rem] font-medium uppercase tracking-wide text-muted-foreground">
                                        {t(
                                            `credentials.type.${credential.credentialType}`,
                                        )}
                                    </span>
                                    <CredentialStatusBadge
                                        status={credential.status}
                                    />
                                </div>
                            ) : null}
                            {/* Description 已搬到左侧 overview；这里仅保留 sr-only 用以满足 Radix Dialog 的可访问性约束。 */}
                            <DialogDescription className="sr-only">
                                {credential?.description ?? t("credentials.detail.overview")}
                            </DialogDescription>
                        </div>
                    </div>
                </DialogHeader>

                {credential ? (
                    <div className="grid min-h-0 overflow-y-auto md:grid-cols-[15rem_minmax(0,1fr)] md:overflow-hidden">
                        <CredentialOverview credential={credential} />
                        <div className="min-w-0 p-4 md:overflow-y-auto md:p-5">
                            <CredentialFields credential={credential} />
                        </div>
                    </div>
                ) : null}

                <DialogFooter className="flex-col items-stretch border-t bg-muted/15 px-6 py-3 sm:flex-row sm:items-center sm:justify-between">
                    {credential ? (
                        <div className="flex flex-wrap gap-x-5 gap-y-1 text-[0.68rem] text-muted-foreground">
                            <span>
                                {t("credentials.detail.createdAt")} · {formatDate(credential.createdAt)}
                            </span>
                            <span>
                                {t("credentials.detail.updatedAt")} · {formatDate(credential.updatedAt)}
                            </span>
                        </div>
                    ) : (
                        <span />
                    )}
                    <Button
                        type="button"
                        variant="outline"
                        className="sm:shrink-0"
                        onClick={() => onOpenChange(false)}
                    >
                        {t("common.close")}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}

function CredentialOverview({ credential }: { credential: Credential }) {
    const { t } = useTranslation();
    const info = credential.certificateInfo;
    const keyInfo = credential.sshKeyInfo;

    return (
        <aside className="border-b bg-slate-50/70 p-5 md:border-r md:border-b-0 dark:bg-slate-950/25">
            {credential.description ? (
                <div className="mb-5">
                    <p className="mb-1.5 text-[0.65rem] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                        {t("credentials.detail.description")}
                    </p>
                    <p className="text-xs leading-relaxed text-foreground/85">
                        {credential.description}
                    </p>
                </div>
            ) : (
                <p className="mb-4 text-[0.65rem] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                    {t("credentials.detail.overview")}
                </p>
            )}

            {credential.credentialType === "X509_CERTIFICATE" && info ? (
                <div className="space-y-5">
                    <div className="relative space-y-4 pl-7">
                        <span className="absolute top-4 bottom-4 left-[0.55rem] w-px bg-border" />
                        <OverviewNode
                            icon={<ShieldCheck className="size-3.5" />}
                            label={t("credentials.detail.issuer")}
                            value={info.issuer || t("common.dash")}
                        />
                        <OverviewNode
                            icon={<FileBadge className="size-3.5" />}
                            label={t("credentials.detail.subject")}
                            value={info.subject || t("common.dash")}
                            active
                        />
                    </div>
                    <div className="border-t pt-4">
                        <ExpiryIndicator expiresAt={info.notAfter} />
                    </div>
                </div>
            ) : null}

            {(credential.credentialType === "SSH_PRIVATE_KEY" ||
                credential.credentialType === "SSH_PUBLIC_KEY") && keyInfo ? (
                <div className="space-y-4">
                    <div className="relative space-y-4 pl-7">
                        <span className="absolute top-4 bottom-4 left-[0.55rem] w-px bg-border" />
                        <OverviewNode
                            icon={<KeyRound className="size-3.5" />}
                            label={t(`credentials.type.${credential.credentialType}`)}
                            value={formatSshKeyType(keyInfo.keyType)}
                            active
                        />
                        <OverviewNode
                            icon={<Fingerprint className="size-3.5" />}
                            label={t("credentials.detail.fingerprint")}
                            value={`${keyInfo.bitLength} bit`}
                        />
                    </div>
                    {keyInfo.curveName ? (
                        <div className="border-t pt-4">
                            <p className="text-[0.65rem] text-muted-foreground">
                                {t("credentials.detail.curveName")}
                            </p>
                            <p className="mt-1 font-mono text-xs">{formatCurveName(keyInfo.curveName)}</p>
                        </div>
                    ) : null}
                </div>
            ) : null}

            {credential.credentialType === "TEXT_PASSWORD" ? (
                <div className="rounded-lg border bg-background p-4 text-center shadow-sm">
                    <span className="mx-auto grid size-10 place-items-center rounded-full bg-muted">
                        <Lock className="size-4 text-muted-foreground" />
                    </span>
                    <p className="mt-3 text-xs font-medium">
                        {t("credentials.detail.protectedSecret")}
                    </p>
                    <p className="mt-1 text-[0.68rem] leading-relaxed text-muted-foreground">
                        {t("credentials.detail.encryptedAtRest")}
                    </p>
                </div>
            ) : null}
        </aside>
    );
}

function OverviewNode({
    icon,
    label,
    value,
    active = false,
}: {
    icon: React.ReactNode;
    label: string;
    value: string;
    active?: boolean;
}) {
    return (
        <div className={`relative ${active ? "rounded-md bg-blue-50 px-2.5 py-2 dark:bg-blue-950/30" : "px-2.5 py-1"}`}>
            <span className={`absolute top-1 -left-7 grid size-[1.15rem] place-items-center rounded border bg-background ${active ? "border-blue-300 text-blue-600" : "text-muted-foreground"}`}>
                {icon}
            </span>
            <p className="text-[0.62rem] text-muted-foreground">{label}</p>
            <p className="mt-0.5 break-words text-xs font-medium leading-snug">{value}</p>
        </div>
    );
}

function CredentialFields({ credential }: { credential: Credential }) {
    if (credential.credentialType === "X509_CERTIFICATE") {
        return <CertificateFields credential={credential} />;
    }
    return (
        <div className="space-y-3">
            <LifecycleFields credential={credential} />
            {credential.credentialType === "TEXT_PASSWORD" ? (
                <PasswordFields />
            ) : (
                <SshKeyFields
                    credential={credential}
                    showPublicKey={
                        credential.credentialType === "SSH_PUBLIC_KEY"
                    }
                />
            )}
        </div>
    );
}

function LifecycleFields({ credential }: { credential: Credential }) {
    const { t } = useTranslation();
    return (
        <FieldGroup title={t("credentials.detail.lifecycle")}>
            <FieldRow label={t("credentials.detail.status")}>
                <CredentialStatusBadge status={credential.status} />
            </FieldRow>
            <FieldRow label={t("credentials.detail.expiresAt")}>
                {credential.expiresAt ? (
                    <div className="flex flex-wrap items-center gap-2">
                        <span>{formatDate(credential.expiresAt)}</span>
                        <ExpiryIndicator expiresAt={credential.expiresAt} />
                    </div>
                ) : (
                    <ExpiryIndicator expiresAt={null} />
                )}
            </FieldRow>
        </FieldGroup>
    );
}

function FieldGroup({
    title,
    children,
}: {
    title: string;
    children: React.ReactNode;
}) {
    return (
        <section className="overflow-hidden rounded-md border">
            <h3 className="border-b bg-muted/35 px-3.5 py-2 text-xs font-semibold">
                {title}
            </h3>
            <dl>{children}</dl>
        </section>
    );
}

function FieldRow({
    label,
    children,
}: {
    label: string;
    children: React.ReactNode;
}) {
    return (
        <div className="grid border-b px-3.5 py-2 text-xs last:border-b-0 sm:grid-cols-[9.5rem_minmax(0,1fr)] sm:gap-4">
            <dt className="text-muted-foreground">{label}</dt>
            <dd className="mt-1 min-w-0 break-words sm:mt-0">{children}</dd>
        </div>
    );
}

function MonoValue({
    value,
    children,
}: {
    value?: string | null;
    children?: React.ReactNode;
}) {
    const { t } = useTranslation();
    const content = children ?? value;
    if (content === undefined || content === null || content === "") {
        return <span className="text-muted-foreground">{t("common.dash")}</span>;
    }
    return (
        <span className="font-mono text-[0.7rem] leading-relaxed break-all">
            {content}
        </span>
    );
}

function CopyableValue({ value }: { value: string }) {
    const { t } = useTranslation();
    const notify = useNotify();
    const [copied, setCopied] = useState(false);

    const handleCopy = useCallback(async () => {
        try {
            if (navigator.clipboard?.writeText) {
                await navigator.clipboard.writeText(value);
            } else {
                const textarea = document.createElement("textarea");
                textarea.value = value;
                textarea.setAttribute("readonly", "");
                textarea.style.position = "fixed";
                textarea.style.opacity = "0";
                document.body.appendChild(textarea);
                textarea.select();
                const ok = document.execCommand("copy");
                document.body.removeChild(textarea);
                if (!ok) throw new Error("execCommand returned false");
            }
            setCopied(true);
            window.setTimeout(() => setCopied(false), 1500);
        } catch (error) {
            notify.error(error, { titleKey: "fingerprint.copyFailed" });
        }
    }, [value, notify]);

    return (
        <div className="group flex items-start gap-2">
            <code className="min-w-0 flex-1 break-all font-mono text-[0.7rem] leading-relaxed">
                {value}
            </code>
            <Button
                type="button"
                variant="ghost"
                size="icon-xs"
                className="-my-1 shrink-0 opacity-60 group-hover:opacity-100"
                onClick={() => void handleCopy()}
                aria-label={copied ? t("fingerprint.ariaCopied") : t("credentials.detail.copy")}
            >
                {copied ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
            </Button>
        </div>
    );
}

function SshKeyFields({
    credential,
    showPublicKey,
}: {
    credential: Credential;
    showPublicKey: boolean;
}) {
    const { t } = useTranslation();
    const info = credential.sshKeyInfo;
    return (
        <FieldGroup title={t("credentials.detail.sshKey")}>
            <FieldRow label={t("credentials.detail.keyType")}>
                {info?.keyType ? formatSshKeyType(info.keyType) : t("common.dash")}
            </FieldRow>
            <FieldRow label={t("credentials.detail.keyBitLength")}>
                {info && info.bitLength > 0 ? `${info.bitLength} bit` : t("common.dash")}
            </FieldRow>
            {info?.curveName ? (
                <FieldRow label={t("credentials.detail.curveName")}>{formatCurveName(info.curveName)}</FieldRow>
            ) : null}
            {info?.fingerprint ? (
                <FieldRow label={t("credentials.detail.fingerprint")}>
                    <CopyableValue value={formatFingerprint(info.fingerprint)} />
                </FieldRow>
            ) : null}
            {showPublicKey && credential.sshPublicKey ? (
                <FieldRow label={t("credentials.detail.publicKey")}>
                    <CopyableValue value={credential.sshPublicKey} />
                </FieldRow>
            ) : null}
        </FieldGroup>
    );
}

function PasswordFields() {
    const { t } = useTranslation();
    return (
        <FieldGroup title={t("credentials.detail.password")}>
            <FieldRow label={t("credentials.detail.securityState")}>
                <div className="flex items-start gap-2 text-muted-foreground">
                    <Lock className="mt-0.5 size-3.5 shrink-0" />
                    <span className="leading-relaxed">{t("credentials.detail.passwordLocked")}</span>
                </div>
            </FieldRow>
        </FieldGroup>
    );
}

function CertificateFields({ credential }: { credential: Credential }) {
    const { t } = useTranslation();
    const info = credential.certificateInfo;
    if (!info) return null;

    return (
        <div className="space-y-3">
            <FieldGroup title={t("credentials.detail.subject")}>
                <FieldRow label={t("credentials.cert.commonName")}>
                    <MonoValue value={info.subject} />
                </FieldRow>
                <FieldRow label={t("credentials.cert.distinguishedName")}>
                    <MonoValue value={info.subjectDn} />
                </FieldRow>
                <FieldRow label={t("credentials.cert.san")}>
                    {info.sans.length === 0 ? (
                        <span className="text-muted-foreground">{t("credentials.cert.sanEmpty")}</span>
                    ) : (
                        <div className="flex flex-wrap gap-1">
                            {info.sans.map((san) => (
                                <span key={san} className="rounded border bg-muted/25 px-1.5 py-0.5 font-mono text-[0.68rem]">
                                    {san}
                                </span>
                            ))}
                        </div>
                    )}
                </FieldRow>
            </FieldGroup>

            <FieldGroup title={t("credentials.detail.issuer")}>
                <FieldRow label={t("credentials.cert.commonName")}>
                    <MonoValue value={info.issuer} />
                </FieldRow>
                <FieldRow label={t("credentials.cert.distinguishedName")}>
                    <MonoValue value={info.issuerDn} />
                </FieldRow>
                <FieldRow label={t("credentials.cert.selfSigned")}>
                    <MonoValue>{info.selfSigned ? t("common.yes") : t("common.no")}</MonoValue>
                </FieldRow>
            </FieldGroup>

            <FieldGroup title={t("credentials.detail.validity")}>
                <FieldRow label={t("credentials.cert.validFrom")}>
                    <MonoValue>{formatDate(info.notBefore)}</MonoValue>
                </FieldRow>
                <FieldRow label={t("credentials.cert.validTo")}>
                    <div className="flex flex-wrap items-center gap-2">
                        <MonoValue>{formatDate(info.notAfter)}</MonoValue>
                        <ExpiryIndicator expiresAt={info.notAfter} />
                    </div>
                </FieldRow>
            </FieldGroup>

            <FieldGroup title={t("credentials.detail.cryptography")}>
                <FieldRow label={t("credentials.cert.publicKey")}>
                    <MonoValue>
                        {info.publicKeyBitLength > 0
                            ? `${formatPublicKeyAlgorithm(info.publicKeyAlgorithm)} · ${info.publicKeyBitLength} bit`
                            : formatPublicKeyAlgorithm(info.publicKeyAlgorithm)}
                    </MonoValue>
                </FieldRow>
                <FieldRow label={t("credentials.cert.signatureAlgorithm")}>
                    <MonoValue value={info.signatureAlgorithm} />
                </FieldRow>
                <FieldRow label={t("credentials.cert.serialNumber")}>
                    <MonoValue value={info.serialNumber} />
                </FieldRow>
                <FieldRow label={t("credentials.cert.fingerprint")}>
                    <CopyableValue value={formatFingerprint(info.fingerprintSha256)} />
                </FieldRow>
            </FieldGroup>
        </div>
    );
}
