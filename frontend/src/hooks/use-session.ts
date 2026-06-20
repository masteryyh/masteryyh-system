import { useContext } from "react";

import { SessionContext } from "@/context/session-context";

export function useSession() {
    const value = useContext(SessionContext);
    if (!value) {
        throw new Error("useSession 必须在 SessionProvider 内部使用");
    }
    return value;
}
