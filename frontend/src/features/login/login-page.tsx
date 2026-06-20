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
import { useSession } from "@/hooks/use-session";
import { useVersion } from "@/hooks/use-version";
import { apiRequest } from "@/lib/api";
import type { LoginData } from "@/types/api";

const versionFailureText = "Failed to retrieve version info";

export function LoginPage() {
    const navigate = useNavigate();
    const { login } = useSession();
    const { versionInfo, loadFailed: versionLoadFailed } = useVersion();

    const [name, setName] = useState("admin");
    const [password, setPassword] = useState("");
    const [error, setError] = useState("");
    const [isSubmitting, setIsSubmitting] = useState(false);

    async function submitLogin(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();
        setError("");
        setIsSubmitting(true);

        try {
            const loginData = await apiRequest<LoginData>("/v1/user/login", {
                method: "POST",
                body: JSON.stringify({ name, password }),
            });
            if (!loginData?.token) {
                throw new Error("登录响应中缺少 token");
            }
            login(loginData);
            navigate("/home", { replace: true });
        } catch (loginError) {
            setError(
                loginError instanceof Error
                    ? loginError.message
                    : "登录失败，请稍后重试",
            );
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
                            Homelab control plane
                        </p>
                        <h1 className="mt-3 max-w-sm text-4xl font-semibold tracking-tight text-balance">
                            masteryyh's system
                        </h1>
                        <p className="mt-4 max-w-sm text-sm leading-6 text-sidebar-foreground/70">
                            Homelab 统一控制和管理平面
                        </p>
                    </div>
                    <div className="border-t border-sidebar-border p-8 font-mono text-xs text-sidebar-foreground/60">
                        {versionInfo
                            ? `${versionInfo.version} · ${versionInfo.commitHash} · ${versionInfo.buildTime}`
                            : versionLoadFailed
                              ? versionFailureText
                              : "Loading version info..."}
                    </div>
                </div>

                <Card className="rounded-none border-0 bg-card shadow-none">
                    <CardHeader className="space-y-3 px-7 pt-8">
                        <CardTitle className="text-2xl">登录</CardTitle>
                        <CardDescription>
                            使用系统管理员账号进入控制台。
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="px-7 pb-8">
                        <form className="space-y-5" onSubmit={submitLogin}>
                            <div className="space-y-2">
                                <Label htmlFor="name">用户名</Label>
                                <Input
                                    id="name"
                                    autoComplete="username"
                                    required
                                    value={name}
                                    onChange={(event) =>
                                        setName(event.target.value)
                                    }
                                    placeholder="admin"
                                />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="password">密码</Label>
                                <Input
                                    id="password"
                                    type="password"
                                    autoComplete="current-password"
                                    required
                                    value={password}
                                    onChange={(event) =>
                                        setPassword(event.target.value)
                                    }
                                    placeholder="请输入密码"
                                />
                            </div>

                            {error ? (
                                <div className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                                    {error}
                                </div>
                            ) : null}

                            <Button
                                className="w-full"
                                size="lg"
                                type="submit"
                                disabled={isSubmitting}
                            >
                                {isSubmitting ? "登录中..." : "登录"}
                            </Button>
                        </form>
                    </CardContent>
                </Card>
            </section>
        </main>
    );
}
