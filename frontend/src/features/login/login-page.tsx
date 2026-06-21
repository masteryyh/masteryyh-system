import { useState, type FormEvent } from "react";
import { ShieldCheck } from "lucide-react";
import { useNavigate } from "react-router";

import { Button } from "@/components/ui/button";
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ErrorBanner } from "@/components/resource-ui";
import { useApi } from "@/hooks/use-api";
import { useNotify } from "@/hooks/use-notify";
import { useSession } from "@/hooks/use-session";
import { useTranslation } from "@/hooks/use-translation";
import { useVersion } from "@/hooks/use-version";
import { AppError } from "@/lib/errors";

export function LoginPage() {
    const navigate = useNavigate();
    const api = useApi();
    const notify = useNotify();
    const { t } = useTranslation();
    const { login } = useSession();
    const { versionInfo, loadFailed: versionLoadFailed } = useVersion();

    const [name, setName] = useState("admin");
    const [password, setPassword] = useState("");
    const [error, setError] = useState<unknown>(null);
    const [isSubmitting, setIsSubmitting] = useState(false);

    async function submitLogin(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();
        setError(null);
        setIsSubmitting(true);

        try {
            const loginData = await api.auth.login({ name, password });
            if (!loginData?.token) {
                throw new AppError(
                    0,
                    "login.missingToken",
                    "Token missing from login response",
                );
            }
            login(loginData);
            navigate("/home", { replace: true });
        } catch (loginError) {
            setError(loginError);
            // 给一份 toast 兜底，登录页是无其它反馈通道的关键操作
            notify.error(loginError);
        } finally {
            setIsSubmitting(false);
        }
    }

    return (
        <main className="grid min-h-screen place-items-center px-4 py-10">
            <section className="grid w-full max-w-5xl overflow-hidden rounded-xl border border-border bg-card shadow-2xl shadow-slate-950/10 md:grid-cols-[1fr_27rem]">
                <div className="hidden min-h-[34rem] bg-sidebar text-sidebar-foreground md:flex md:flex-col md:justify-between">
                    <div className="p-8">
                        <div className="inline-flex h-11 w-11 items-center justify-center rounded-lg bg-sidebar-primary text-sidebar-primary-foreground">
                            <ShieldCheck className="size-5" />
                        </div>
                        <p className="mt-10 font-mono text-xs font-semibold tracking-[0.18em] text-sidebar-foreground/55 uppercase">
                            {t("app.headlineEyebrow")}
                        </p>
                        <h1 className="mt-3 max-w-sm text-4xl font-semibold tracking-tight text-balance">
                            {t("app.name")}
                        </h1>
                        <p className="mt-4 max-w-sm text-sm leading-6 text-sidebar-foreground/70">
                            {t("app.tagline")}
                        </p>
                    </div>
                    <div className="border-t border-sidebar-border p-8 font-mono text-xs text-sidebar-foreground/60">
                        {versionInfo
                            ? `${versionInfo.version} · ${versionInfo.commitHash} · ${versionInfo.buildTime}`
                            : versionLoadFailed
                              ? t("app.footerLoadFailed")
                              : t("app.footerLoading")}
                    </div>
                </div>

                <Card className="rounded-none border-0 bg-card shadow-none">
                    <CardHeader className="space-y-3 px-7 pt-8">
                        <CardTitle className="text-2xl">
                            {t("login.title")}
                        </CardTitle>
                        <CardDescription>
                            {t("login.description")}
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="px-7 pb-8">
                        <form className="space-y-5" onSubmit={submitLogin}>
                            <div className="space-y-2">
                                <Label htmlFor="name">
                                    {t("login.username")}
                                </Label>
                                <Input
                                    id="name"
                                    autoComplete="username"
                                    required
                                    value={name}
                                    onChange={(event) =>
                                        setName(event.target.value)
                                    }
                                    placeholder={t("login.usernamePlaceholder")}
                                />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="password">
                                    {t("login.password")}
                                </Label>
                                <Input
                                    id="password"
                                    type="password"
                                    autoComplete="current-password"
                                    required
                                    value={password}
                                    onChange={(event) =>
                                        setPassword(event.target.value)
                                    }
                                    placeholder={t("login.passwordPlaceholder")}
                                />
                            </div>

                            <ErrorBanner error={error} />

                            <Button
                                className="w-full"
                                size="lg"
                                type="submit"
                                disabled={isSubmitting}
                            >
                                {isSubmitting
                                    ? t("login.submitting")
                                    : t("login.submit")}
                            </Button>
                        </form>
                    </CardContent>
                </Card>
            </section>
        </main>
    );
}
