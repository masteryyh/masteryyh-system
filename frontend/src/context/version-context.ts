import { createContext } from "react";

import type { VersionInfo } from "@/types/api";

export interface VersionContextValue {
    /** 拉取成功后保存的版本信息；尚未完成或失败时为 null。 */
    versionInfo: VersionInfo | null;
    /** 是否正在拉取（用于区分"加载中"与"已失败"）。 */
    isLoading: boolean;
    /** 拉取失败的标记；UI 据此显示降级文案。 */
    loadFailed: boolean;
}

export const VersionContext = createContext<VersionContextValue | null>(null);
