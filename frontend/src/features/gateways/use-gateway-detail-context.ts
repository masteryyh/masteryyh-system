import { useOutletContext } from "react-router";

import type {
    AppPlatform,
    Credential,
    GatewayConfig,
    GatewayEntryPoint,
    GatewayRoute,
    StoredFile,
} from "@/types/api";

/**
 * GatewayDetailPage 通过 Outlet context 下发给概览/入口与路由两个子面板的共享状态。
 */
export interface GatewayDetailContext {
    gateway: GatewayConfig | null;
    gatewayId: string;
    loading: boolean;
    error: unknown;
    platform: AppPlatform | null;
    entryPoints: GatewayEntryPoint[];
    routes: Record<string, GatewayRoute[]>;
    files: StoredFile[];
    credentials: Credential[];
    reload: () => Promise<void>;
}

export function useGatewayDetailContext(): GatewayDetailContext {
    return useOutletContext() as GatewayDetailContext;
}
