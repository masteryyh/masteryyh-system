import { useContext } from "react";

import { WebShellContext } from "@/context/web-shell-context";

export function useWebShell() {
    const ctx = useContext(WebShellContext);
    if (!ctx) {
        throw new Error("useWebShell must be used within WebShellProvider");
    }
    return ctx;
}
