import { createContext } from "react";

import type { ShellStatus } from "@/components/web-shell";
import type { AppPlatform } from "@/types/api";

export interface ShellSession {
    id: string;
    platformId: string;
    platformName: string;
    status: ShellStatus;
}

export interface WebShellContextValue {
    sessions: ShellSession[];
    activeId: string | null;
    openShell: (platform: AppPlatform) => void;
    closeShell: (id: string) => void;
    setActive: (id: string) => void;
    setStatus: (id: string, status: ShellStatus) => void;
}

export const WebShellContext = createContext<WebShellContextValue | null>(null);
