import { useContext } from "react";

import { VersionContext } from "@/context/version-context";

export function useVersion() {
    const value = useContext(VersionContext);
    if (!value) {
        throw new Error("useVersion 必须在 VersionProvider 内部使用");
    }
    return value;
}
