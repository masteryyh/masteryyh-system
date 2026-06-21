import { useEffect, useMemo, useState, type ReactNode } from "react";

import { VersionContext } from "@/context/version-context";
import { useApi } from "@/hooks/use-api";
import { useNotify } from "@/hooks/use-notify";
import type { VersionInfo } from "@/types/api";

export function VersionProvider({ children }: { children: ReactNode }) {
    const api = useApi();
    const notify = useNotify();

    const [versionInfo, setVersionInfo] = useState<VersionInfo | null>(null);
    const [loadFailed, setLoadFailed] = useState(false);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        let active = true;
        api.system
            .getVersion()
            .then((data) => {
                if (!active) return;
                setVersionInfo(data);
                setLoadFailed(false);
            })
            .catch((requestError) => {
                if (!active) return;
                setVersionInfo(null);
                setLoadFailed(true);
                notify.error(requestError, {
                    titleKey: "app.footerLoadFailed",
                });
            })
            .finally(() => {
                if (!active) return;
                setIsLoading(false);
            });
        return () => {
            active = false;
        };
        // 只在 mount 时拉一次版本信息；token 切换不需要触发重新拉取
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const value = useMemo(
        () => ({ versionInfo, isLoading, loadFailed }),
        [versionInfo, isLoading, loadFailed],
    );

    return (
        <VersionContext.Provider value={value}>
            {children}
        </VersionContext.Provider>
    );
}
