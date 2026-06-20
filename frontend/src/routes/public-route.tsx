import { Navigate, Outlet } from "react-router";

import { useSession } from "@/hooks/use-session";

export function PublicRoute() {
    const { session } = useSession();

    if (session) {
        return <Navigate to="/home" replace />;
    }

    return <Outlet />;
}
