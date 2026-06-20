import { useEffect, useMemo, useState, type ReactNode } from "react";
import { toast } from "sonner";

import { VersionContext } from "@/context/version-context";
import { apiRequest } from "@/lib/api";
import type { VersionInfo } from "@/types/api";

const versionFailureText = "Failed to retrieve version info";

export function VersionProvider({ children }: { children: ReactNode }) {
    const [versionInfo, setVersionInfo] = useState<VersionInfo | null>(null);
    const [loadFailed, setLoadFailed] = useState(false);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        let active = true;
        apiRequest<VersionInfo>("/v1/version")
            .then((data) => {
                if (!active) return;
                setVersionInfo(data);
                setLoadFailed(false);
            })
            .catch((requestError) => {
                if (!active) return;
                setVersionInfo(null);
                setLoadFailed(true);
                toast.error(versionFailureText, {
                    description:
                        requestError instanceof Error
                            ? requestError.message
                            : undefined,
                });
            })
            .finally(() => {
                if (!active) return;
                setIsLoading(false);
            });
        return () => {
            active = false;
        };
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
