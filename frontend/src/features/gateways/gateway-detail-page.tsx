import { useCallback, useEffect, useState } from "react";
import {
    ArrowLeft,
    Globe2,
    LayoutDashboard,
    LoaderCircle,
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
import { useApi } from "@/hooks/use-api";
import { useSession } from "@/hooks/use-session";
import { useTranslation } from "@/hooks/use-translation";
import type {
    AppPlatform,
    Credential,
    GatewayConfig,
    GatewayEntryPoint,
    GatewayRoute,
    GatewayStatus,
    StoredFile,
} from "@/types/api";
import type { GatewayDetailContext } from "./use-gateway-detail-context";

const credentialPageSize = 1000;
const filePageSize = 1000;

interface DetailNavItem {
    to: string;
    labelKey: string;
    icon: typeof LayoutDashboard;
    end?: boolean;
}

const navItems: DetailNavItem[] = [
    {
        to: "",
        labelKey: "gatewayDetail.nav.overview",
        icon: LayoutDashboard,
        end: true,
    },
    {
        to: "routes",
        labelKey: "gatewayDetail.nav.routes",
        icon: Globe2,
    },
];

export function GatewayDetailPage() {
    const { gatewayId = "" } = useParams();
    const api = useApi();
    const { t } = useTranslation();
    const { session, logout } = useSession();

    const [gateway, setGateway] = useState<GatewayConfig | null>(null);
    const [platform, setPlatform] = useState<AppPlatform | null>(null);
    const [entryPoints, setEntryPoints] = useState<GatewayEntryPoint[]>([]);
    const [routes, setRoutes] = useState<Record<string, GatewayRoute[]>>({});
    const [files, setFiles] = useState<StoredFile[]>([]);
    const [credentials, setCredentials] = useState<Credential[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<unknown>(null);

    const load = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const [gatewayData, entries, credentialPage, filePage] =
                await Promise.all([
                    api.gateways.get(gatewayId),
                    api.gateways.listEntryPoints(gatewayId),
                    api.credentials.list({
                        page: 1,
                        pageSize: credentialPageSize,
                    }),
                    api.files.list({ page: 1, pageSize: filePageSize }),
                ]);
            const routePairs = await Promise.all(
                entries.map(
                    async (entry) =>
                        [
                            entry.id,
                            await api.gateways.listRoutes(gatewayId, entry.id),
                        ] as const,
                ),
            );
            let platformData: AppPlatform | null = null;
            try {
                platformData = await api.platforms.get(gatewayData.platformId);
            } catch {
                platformData = null;
            }
            setGateway(gatewayData);
            setPlatform(platformData);
            setEntryPoints(entries);
            setRoutes(Object.fromEntries(routePairs));
            setCredentials(
                credentialPage.data.filter(
                    (credential) =>
                        credential.credentialType === "X509_CERTIFICATE",
                ),
            );
            setFiles(filePage.data);
        } catch (loadError) {
            setError(loadError);
        } finally {
            setLoading(false);
        }
    }, [api, gatewayId]);

    useEffect(() => {
        const timeout = window.setTimeout(() => void load(), 0);
        return () => window.clearTimeout(timeout);
    }, [load]);

    if (!session) return null;

    return (
        <SidebarProvider>
            <Sidebar collapsible="icon">
                <SidebarHeader>
                    <SidebarMenu>
                        <SidebarMenuItem>
                            <SidebarMenuButton size="lg" asChild>
                                <Link to="/gateways">
                                    <div className="flex aspect-square size-8 items-center justify-center rounded-lg bg-sidebar-primary text-sidebar-primary-foreground">
                                        <ArrowLeft className="size-4" />
                                    </div>
                                    <div className="grid flex-1 text-left text-sm leading-tight">
                                        <span className="truncate font-semibold">
                                            {t("gatewayDetail.back")}
                                        </span>
                                        <span className="truncate text-xs">
                                            {t("nav.gateways")}
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
                            {t("gatewayDetail.nav.group")}
                        </SidebarGroupLabel>
                        <SidebarGroupContent>
                            <SidebarMenu>
                                {navItems.map((item) => (
                                    <DetailNavButton
                                        key={item.to}
                                        item={item}
                                        basePath={`/gateways/${gatewayId}`}
                                    />
                                ))}
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
                    {loading && !gateway ? (
                        <span className="flex items-center gap-2 text-sm text-muted-foreground">
                            <LoaderCircle className="size-4 animate-spin" />
                            {t("gatewayDetail.loading")}
                        </span>
                    ) : (
                        <GatewayTitle gateway={gateway} platform={platform} />
                    )}
                </header>
                <main className="min-w-0 flex-1 overflow-y-auto overflow-x-hidden bg-background/72 p-4 sm:p-6 lg:p-8">
                    <div className="mx-auto w-full min-w-0 max-w-7xl">
                        {error ? (
                            <ErrorBanner
                                error={error}
                                fallbackKey="gatewayDetail.loadFailed"
                            />
                        ) : (
                            <Outlet
                                context={
                                    {
                                        gateway,
                                        gatewayId,
                                        loading,
                                        error,
                                        platform,
                                        entryPoints,
                                        routes,
                                        files,
                                        credentials,
                                        reload: () => load(),
                                    } satisfies GatewayDetailContext
                                }
                            />
                        )}
                    </div>
                </main>
            </SidebarInset>
        </SidebarProvider>
    );
}

function DetailNavButton({
    item,
    basePath,
}: {
    item: DetailNavItem;
    basePath: string;
}) {
    const { t } = useTranslation();
    const location = useLocation();
    const to = item.to ? `${basePath}/${item.to}` : basePath;
    const isActive = item.end
        ? location.pathname === to
        : location.pathname === to || location.pathname.startsWith(`${to}/`);
    return (
        <SidebarMenuItem>
            <SidebarMenuButton
                asChild
                isActive={isActive}
                tooltip={t(item.labelKey)}
            >
                <Link to={to}>
                    <item.icon className="size-4" />
                    <span>{t(item.labelKey)}</span>
                </Link>
            </SidebarMenuButton>
        </SidebarMenuItem>
    );
}

function statusDotClass(status: GatewayStatus): string {
    switch (status) {
        case "HEALTHY":
            return "bg-emerald-500 shadow-[0_0_0_3px_rgba(16,185,129,0.14)]";
        case "STARTING":
            return "bg-sky-500";
        case "STOPPING":
            return "bg-amber-500";
        case "UNHEALTHY":
            return "bg-rose-500 shadow-[0_0_0_3px_rgba(244,63,94,0.14)]";
        case "STOPPED":
        default:
            return "bg-slate-400";
    }
}

function GatewayTitle({
    gateway,
    platform,
}: {
    gateway: GatewayConfig | null;
    platform: AppPlatform | null;
}) {
    const { t } = useTranslation();
    if (!gateway) {
        return (
            <span className="text-sm font-medium">{t("nav.gateways")}</span>
        );
    }
    return (
        <div className="flex min-w-0 items-center gap-3">
            <span
                className={`size-2 shrink-0 rounded-full ${statusDotClass(gateway.status)}`}
            />
            <span className="truncate text-sm font-medium">{gateway.name}</span>
            {platform ? (
                <span className="hidden text-xs text-muted-foreground sm:inline">
                    {platform.name} · {t(`platforms.type.${platform.platformType}`)}
                </span>
            ) : null}
            {gateway.pendingChanges ? (
                <span className="hidden rounded border border-amber-300/70 bg-amber-50 px-1.5 py-0.5 text-[0.68rem] text-amber-700 sm:inline">
                    {t("gateways.status.pendingChanges")}
                </span>
            ) : null}
        </div>
    );
}
