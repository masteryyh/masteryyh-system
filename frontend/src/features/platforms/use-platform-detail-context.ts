import { useOutletContext } from "react-router";

import type { AppPlatform } from "@/types/api";

/**
 * PlatformDetailPage 通过 Outlet context 下发给各子面板的共享状态。
 */
export interface PlatformDetailContext {
    platform: AppPlatform | null;
    platformId: string;
    loading: boolean;
}

export function usePlatformDetailContext(): PlatformDetailContext {
    return useOutletContext() as PlatformDetailContext;
}
