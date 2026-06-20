import { useCallback, useMemo, useState, type ReactNode } from "react";

import { SessionContext } from "@/context/session-context";
import type { LoginData } from "@/types/api";

const sessionStorageKey = "masteryyh-system.session";

function readSession(): LoginData | null {
    const rawSession = window.localStorage.getItem(sessionStorageKey);
    if (!rawSession) return null;

    try {
        const session = JSON.parse(rawSession) as Partial<LoginData>;
        if (session.username && session.token) {
            return session as LoginData;
        }
    } catch {
        // Invalid local data is removed below.
    }

    window.localStorage.removeItem(sessionStorageKey);
    return null;
}

export function SessionProvider({ children }: { children: ReactNode }) {
    const [session, setSession] = useState<LoginData | null>(() =>
        readSession(),
    );

    const login = useCallback((data: LoginData) => {
        window.localStorage.setItem(sessionStorageKey, JSON.stringify(data));
        setSession(data);
    }, []);

    const logout = useCallback(() => {
        window.localStorage.removeItem(sessionStorageKey);
        setSession(null);
    }, []);

    const value = useMemo(
        () => ({ session, login, logout }),
        [session, login, logout],
    );

    return (
        <SessionContext.Provider value={value}>
            {children}
        </SessionContext.Provider>
    );
}
