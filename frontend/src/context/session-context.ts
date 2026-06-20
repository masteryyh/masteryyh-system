import { createContext } from "react";

import type { LoginData } from "@/types/api";

export interface SessionContextValue {
    session: LoginData | null;
    login: (data: LoginData) => void;
    logout: () => void;
}

export const SessionContext = createContext<SessionContextValue | null>(null);
