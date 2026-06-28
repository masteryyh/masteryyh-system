import { useCallback, useEffect, useState } from "react";
import {
    ArrowLeft,
    Box,
    Clock,
    Container,
    HardDrive,
    LayoutDashboard,
    LoaderCircle,
    Network,
    ServerCog,
} from "lucide-react";
import { Link, Outlet, useLocation, useParams } from "react-router";

import { ErrorBanner } from "@/components/resource-ui";
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
    SidebarGroupLabel,
    SidebarHeader,
    SidebarInset,
    SidebarMenu,
    SidebarMenuButton,
    SidebarMenuItem,
    SidebarProvider,
    SidebarTrigger,
} from "@/components/ui/sidebar";
import { WebShellBar } from "@/components/web-shell-bar";
import { WebShellProvider } from "@/context/web-shell-provider";
import { useApi } from "@/hooks/use-api";
import { useSession } from "@/hooks/use-session";
import { useTranslation } from "@/hooks/use-translation";
import type { AppPlatform } from "@/types/api";
import type { PlatformDetailContext } from "./use-platform-detail-context";

interface DetailNavItem {
    to: string;
    labelKey: string;
    icon: typeof LayoutDashboard;
}

const overviewNav: DetailNavItem = {
    to: "",
    labelKey: "platforms.detail.nav.overview",
    icon: LayoutDashboard,
};

const dockerNav: DetailNavItem[] = [
    { to: "images", labelKey: "platforms.detail.nav.images", icon: Box },
    {
        to: "containers",
        labelKey: "platforms.detail.nav.containers",
        icon: Container,
    },
    {
        to: "networks",
        labelKey: "platforms.detail.nav.networks",
        icon: Network,
    },
    {
        to: "volumes",
        labelKey: "platforms.detail.nav.volumes",
        icon: HardDrive,
    },
];

const hostNav: DetailNavItem[] = [
    {
        to: "services",
        labelKey: "platforms.detail.nav.services",
        icon: ServerCog,
    },
    { to: "cron", labelKey: "platforms.detail.nav.cron", icon: Clock },
];

export function PlatformDetailPage() {
    const { platformId = "" } = useParams();
    const api = useApi();
    const { t } = useTranslation();
    const { session, logout } = useSession();
    const [platform, setPlatform] = useState<AppPlatform | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<unknown>(null);

    const loadPlatform = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            setPlatform(await api.platforms.get(platformId));
        } catch (err) {
            setPlatform(null);
            setError(err);
        } finally {
            setLoading(false);
        }
    }, [api.platforms, platformId]);

    useEffect(() => {
        const timeout = window.setTimeout(() => void loadPlatform(), 0);
        return () => window.clearTimeout(timeout);
    }, [loadPlatform]);

    if (!session) return null;

    const platformType = platform?.platformType;
    const resourceNav =
        platformType === "DOCKER"
            ? dockerNav
            : platformType === "HOST"
              ? hostNav
              : [];

    return (
        <WebShellProvider>
            <SidebarProvider>
                <Sidebar collapsible="icon">
                    <SidebarHeader>
                        <SidebarMenu>
                            <SidebarMenuItem>
                                <SidebarMenuButton size="lg" asChild>
                                    <Link to="/home">
                                        <div className="flex aspect-square size-8 items-center justify-center rounded-lg bg-sidebar-primary text-sidebar-primary-foreground">
                                            <ArrowLeft className="size-4" />
                                        </div>
                                        <div className="grid flex-1 text-left text-sm leading-tight">
                                            <span className="truncate font-semibold">
                                                {t(
                                                    "platforms.detail.backToHome",
                                                )}
                                            </span>
                                            <span className="truncate text-xs">
                                                {t("nav.home")}
                                            </span>
                                        </div>
                                    </Link>
                                </SidebarMenuButton>
                            </SidebarMenuItem>
                        </SidebarMenu>
                    </SidebarHeader>
                    <SidebarContent>
                        <SidebarGroup>
                            <SidebarGroupLabel>
                                {t("platforms.detail.nav.group")}
                            </SidebarGroupLabel>
                            <SidebarGroupContent>
                                <SidebarMenu>
                                    <DetailNavButton
                                        item={overviewNav}
                                        basePath={`/platforms/${platformId}`}
                                        end
                                    />
                                </SidebarMenu>
                            </SidebarGroupContent>
                        </SidebarGroup>
                        {resourceNav.length > 0 ? (
                            <SidebarGroup>
                                <SidebarGroupLabel>
                                    {t(
                                        platformType === "DOCKER"
                                            ? "platforms.detail.nav.dockerGroup"
                                            : "platforms.detail.nav.hostGroup",
                                    )}
                                </SidebarGroupLabel>
                                <SidebarGroupContent>
                                    <SidebarMenu>
                                        {resourceNav.map((item) => (
                                            <DetailNavButton
                                                key={item.to}
                                                item={item}
                                                basePath={`/platforms/${platformId}`}
                                            />
                                        ))}
                                    </SidebarMenu>
                                </SidebarGroupContent>
                            </SidebarGroup>
                        ) : null}
                    </SidebarContent>
                    <SidebarFooter>
                        <SidebarMenu>
                            <SidebarMenuItem>
                                <DropdownMenu>
                                    <DropdownMenuTrigger asChild>
                                        <SidebarMenuButton size="lg">
                                            <Avatar className="size-8 rounded-lg">
                                                <AvatarFallback className="rounded-lg">
                                                    {session.username
                                                        .slice(0, 2)
                                                        .toUpperCase()}
                                                </AvatarFallback>
                                            </Avatar>
                                            <div className="grid flex-1 text-left text-sm leading-tight">
                                                <span className="truncate font-semibold">
                                                    {session.username}
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
                                        <DropdownMenuItem onClick={logout}>
                                            <ArrowLeft className="size-4" />
                                            {t("nav.logout")}
                                        </DropdownMenuItem>
                                    </DropdownMenuContent>
                                </DropdownMenu>
                            </SidebarMenuItem>
                        </SidebarMenu>
                    </SidebarFooter>
                </Sidebar>
                <SidebarInset className="flex h-screen min-w-0 flex-col">
                    <header className="sticky top-0 z-20 flex h-14 shrink-0 items-center gap-3 border-b bg-background/88 px-4 backdrop-blur-lg">
                        <SidebarTrigger />
                        <Separator orientation="vertical" className="h-5" />
                        {loading ? (
                            <span className="flex items-center gap-2 text-sm text-muted-foreground">
                                <LoaderCircle className="size-4 animate-spin" />
                                {t("platforms.detail.loading")}
                            </span>
                        ) : (
                            <PlatformTitle platform={platform} />
                        )}
                    </header>
                    <main className="min-w-0 flex-1 overflow-y-auto overflow-x-hidden bg-background/72 p-4 sm:p-6 lg:p-8">
                        <div className="mx-auto w-full min-w-0 max-w-7xl">
                            {error ? (
                                <ErrorBanner
                                    error={error}
                                    fallbackKey="platforms.fallback.loadFailed"
                                />
                            ) : (
                                <Outlet
                                    context={
                                        {
                                            platform,
                                            platformId,
                                            loading,
                                        } satisfies PlatformDetailContext
                                    }
                                />
                            )}
                        </div>
                    </main>
                    <WebShellBar />
                </SidebarInset>
            </SidebarProvider>
        </WebShellProvider>
    );
}

function DetailNavButton({
    item,
    basePath,
    end,
}: {
    item: DetailNavItem;
    basePath: string;
    end?: boolean;
}) {
    const { t } = useTranslation();
    const location = useLocation();
    const to = item.to ? `${basePath}/${item.to}` : basePath;
    const isActive = end
        ? location.pathname === to
        : location.pathname === to ||
          location.pathname.startsWith(`${to}/`);
    return (
        <SidebarMenuItem>
            <SidebarMenuButton asChild isActive={isActive} tooltip={t(item.labelKey)}>
                <Link to={to}>
                    <item.icon className="size-4" />
                    <span>{t(item.labelKey)}</span>
                </Link>
            </SidebarMenuButton>
        </SidebarMenuItem>
    );
}

function PlatformTitle({ platform }: { platform: AppPlatform | null }) {
    const { t } = useTranslation();
    if (!platform) {
        return <span className="text-sm font-medium">{t("nav.platforms")}</span>;
    }
    return (
        <div className="flex min-w-0 items-center gap-3">
            <span
                className={`size-2 shrink-0 rounded-full ${platform.online ? "bg-emerald-500 shadow-[0_0_0_3px_rgba(16,185,129,0.14)]" : "bg-slate-400"}`}
            />
            <span className="truncate text-sm font-medium">{platform.name}</span>
            <span className="hidden text-xs text-muted-foreground sm:inline">
                {t(`platforms.type.${platform.platformType}`)}
            </span>
        </div>
    );
}
