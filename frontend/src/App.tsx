import { useMemo, useState } from "react";
import type { FormEvent } from "react";
import { Home, LayoutDashboard, LogOut, ShieldCheck } from "lucide-react";

import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from "@/components/ui/card";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import {
    Sidebar,
    SidebarContent,
    SidebarFooter,
    SidebarGroup,
    SidebarGroupContent,
    SidebarHeader,
    SidebarInset,
    SidebarMenu,
    SidebarMenuButton,
    SidebarMenuItem,
    SidebarProvider,
    SidebarTrigger,
} from "@/components/ui/sidebar";
import { TooltipProvider } from "@/components/ui/tooltip";

type LoginData = {
    username: string;
    token: string;
};

type ApiResponse<T> = {
    code?: number;
    message?: string;
    data?: T;
};

const sessionStorageKey = "masteryyh-system.session";

function isApiResponse<T>(
    payload: ApiResponse<T> | T,
): payload is ApiResponse<T> {
    return typeof payload === "object" && payload !== null && "data" in payload;
}

function readSession() {
    const rawSession = window.localStorage.getItem(sessionStorageKey);

    if (!rawSession) {
        return null;
    }

    try {
        return JSON.parse(rawSession) as LoginData;
    } catch {
        window.localStorage.removeItem(sessionStorageKey);
        return null;
    }
}

function App() {
    const [session, setSession] = useState<LoginData | null>(() =>
        readSession(),
    );

    function handleLogin(nextSession: LoginData) {
        window.localStorage.setItem(
            sessionStorageKey,
            JSON.stringify(nextSession),
        );
        setSession(nextSession);
    }

    function handleLogout() {
        window.localStorage.removeItem(sessionStorageKey);
        setSession(null);
    }

    return (
        <TooltipProvider>
            {session ? (
                <HomePage session={session} onLogout={handleLogout} />
            ) : (
                <LoginPage onLogin={handleLogin} />
            )}
        </TooltipProvider>
    );
}

function LoginPage({ onLogin }: { onLogin: (session: LoginData) => void }) {
    const [name, setName] = useState("admin");
    const [password, setPassword] = useState("");
    const [error, setError] = useState("");
    const [isSubmitting, setIsSubmitting] = useState(false);

    async function submitLogin(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();
        setError("");
        setIsSubmitting(true);

        try {
            const response = await fetch("/v1/user/login", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({ name, password }),
            });
            const payload = (await response.json()) as
                | ApiResponse<LoginData>
                | LoginData;
            const isWrapped = isApiResponse(payload);
            const loginData = isWrapped ? payload.data : payload;
            const message = isWrapped ? payload.message : undefined;
            const code = isWrapped ? payload.code : undefined;

            if (!response.ok || code === 401 || !loginData?.token) {
                throw new Error(message || "用户名或密码不正确");
            }

            onLogin(loginData);
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
            <section className="grid w-full max-w-5xl overflow-hidden rounded-lg border border-border bg-card shadow-2xl shadow-slate-950/10 md:grid-cols-[1fr_27rem]">
                <div className="hidden min-h-[34rem] bg-sidebar text-sidebar-foreground md:flex md:flex-col md:justify-between">
                    <div className="p-8">
                        <div className="inline-flex h-11 w-11 items-center justify-center rounded-lg bg-sidebar-primary text-sidebar-primary-foreground">
                            <ShieldCheck className="size-5" />
                        </div>
                        <h1 className="mt-10 max-w-sm text-4xl font-semibold tracking-normal text-balance">
                            MasterYYH System
                        </h1>
                        <p className="mt-4 max-w-sm text-sm leading-6 text-sidebar-foreground/70">
                            登录后进入系统主页，先从最小可用的控制台开始。
                        </p>
                    </div>
                    <div className="border-t border-sidebar-border p-8 text-sm text-sidebar-foreground/70">
                        API proxy: /v1 → localhost:8080
                    </div>
                </div>

                <Card className="rounded-none border-0 bg-card shadow-none">
                    <CardHeader className="space-y-3 px-7 pt-8">
                        <CardTitle className="text-2xl">登录</CardTitle>
                        <CardDescription>
                            使用后端配置的管理员账号进入系统。
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="px-7 pb-8">
                        <form className="space-y-5" onSubmit={submitLogin}>
                            <div className="space-y-2">
                                <Label htmlFor="name">用户名</Label>
                                <Input
                                    id="name"
                                    autoComplete="username"
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

function HomePage({
    session,
    onLogout,
}: {
    session: LoginData;
    onLogout: () => void;
}) {
    const initials = useMemo(
        () => session.username.slice(0, 2).toUpperCase(),
        [session.username],
    );

    return (
        <SidebarProvider>
            <Sidebar collapsible="icon">
                <SidebarHeader>
                    <SidebarMenu>
                        <SidebarMenuItem>
                            <SidebarMenuButton size="lg">
                                <div className="flex aspect-square size-8 items-center justify-center rounded-lg bg-sidebar-primary text-sidebar-primary-foreground">
                                    <LayoutDashboard className="size-4" />
                                </div>
                                <div className="grid flex-1 text-left text-sm leading-tight">
                                    <span className="truncate font-semibold">
                                        MasterYYH
                                    </span>
                                    <span className="truncate text-xs">
                                        System Console
                                    </span>
                                </div>
                            </SidebarMenuButton>
                        </SidebarMenuItem>
                    </SidebarMenu>
                </SidebarHeader>
                <SidebarContent>
                    <SidebarGroup>
                        <SidebarGroupContent>
                            <SidebarMenu>
                                <SidebarMenuItem>
                                    <SidebarMenuButton isActive>
                                        <Home className="size-4" />
                                        <span>主页</span>
                                    </SidebarMenuButton>
                                </SidebarMenuItem>
                            </SidebarMenu>
                        </SidebarGroupContent>
                    </SidebarGroup>
                </SidebarContent>
                <SidebarFooter>
                    <SidebarMenu>
                        <SidebarMenuItem>
                            <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                    <SidebarMenuButton size="lg">
                                        <Avatar className="size-8 rounded-lg">
                                            <AvatarFallback className="rounded-lg">
                                                {initials}
                                            </AvatarFallback>
                                        </Avatar>
                                        <div className="grid flex-1 text-left text-sm leading-tight">
                                            <span className="truncate font-semibold">
                                                {session.username}
                                            </span>
                                            <span className="truncate text-xs">
                                                已登录
                                            </span>
                                        </div>
                                    </SidebarMenuButton>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent
                                    align="end"
                                    className="w-56"
                                    side="right"
                                    sideOffset={8}
                                >
                                    <DropdownMenuLabel>
                                        {session.username}
                                    </DropdownMenuLabel>
                                    <DropdownMenuSeparator />
                                    <DropdownMenuItem onClick={onLogout}>
                                        <LogOut className="size-4" />
                                        退出登录
                                    </DropdownMenuItem>
                                </DropdownMenuContent>
                            </DropdownMenu>
                        </SidebarMenuItem>
                    </SidebarMenu>
                </SidebarFooter>
            </Sidebar>
            <SidebarInset>
                <header className="flex h-14 shrink-0 items-center gap-3 border-b bg-background/80 px-4 backdrop-blur">
                    <SidebarTrigger />
                    <Separator orientation="vertical" className="h-5" />
                    <span className="text-sm font-medium">主页</span>
                </header>
                <main className="flex min-h-[calc(100vh-3.5rem)] items-center justify-center p-6">
                    <div className="text-center">
                        <p className="text-sm text-muted-foreground">
                            欢迎回来，{session.username}
                        </p>
                        <h1 className="mt-3 text-5xl font-semibold tracking-normal">
                            Hello World
                        </h1>
                    </div>
                </main>
            </SidebarInset>
        </SidebarProvider>
    );
}

export default App;
