import { useMemo } from "react";
import {
    Home,
    KeyRound,
    LayoutDashboard,
    LogOut,
    Server,
} from "lucide-react";
import { Link, Outlet, useLocation, useNavigate } from "react-router";

import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
import { useSession } from "@/hooks/use-session";

const navigation = [
    { to: "/home", label: "主页", icon: Home },
    { to: "/credentials", label: "凭证管理", icon: KeyRound },
    { to: "/platforms", label: "App Platform", icon: Server },
] satisfies Array<{
    to: string;
    label: string;
    icon: typeof Home;
}>;

export function ConsoleShell() {
    const { session, logout } = useSession();
    const location = useLocation();
    const navigate = useNavigate();

    const initials = useMemo(
        () => session?.username.slice(0, 2).toUpperCase() ?? "",
        [session?.username],
    );
    const title = navigation.find(
        (item) => item.to === location.pathname,
    )?.label;

    function handleLogout() {
        logout();
        navigate("/login", { replace: true });
    }

    if (!session) {
        return null;
    }

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
                                        Homelab Console
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
                                {navigation.map((item) => {
                                    const isActive =
                                        location.pathname === item.to;
                                    return (
                                        <SidebarMenuItem key={item.to}>
                                            <SidebarMenuButton
                                                asChild
                                                isActive={isActive}
                                                tooltip={item.label}
                                            >
                                                <Link to={item.to}>
                                                    <item.icon className="size-4" />
                                                    <span>{item.label}</span>
                                                </Link>
                                            </SidebarMenuButton>
                                        </SidebarMenuItem>
                                    );
                                })}
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
                                                管理员
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
                                    <DropdownMenuItem onClick={handleLogout}>
                                        <LogOut className="size-4" />
                                        退出登录
                                    </DropdownMenuItem>
                                </DropdownMenuContent>
                            </DropdownMenu>
                        </SidebarMenuItem>
                    </SidebarMenu>
                </SidebarFooter>
            </Sidebar>
            <SidebarInset className="min-w-0">
                <header className="sticky top-0 z-20 flex h-14 shrink-0 items-center gap-3 border-b bg-background/88 px-4 backdrop-blur-lg">
                    <SidebarTrigger />
                    <Separator orientation="vertical" className="h-5" />
                    <span className="text-sm font-medium">{title}</span>
                </header>
                <main className="min-w-0 overflow-x-hidden bg-background/72 p-4 sm:p-6 lg:p-8">
                    <div className="mx-auto w-full min-w-0 max-w-7xl">
                        <Outlet />
                    </div>
                </main>
            </SidebarInset>
        </SidebarProvider>
    );
}
