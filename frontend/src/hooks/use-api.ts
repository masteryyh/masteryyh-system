import { useCallback, useMemo } from "react";
import { useNavigate } from "react-router";

import {
    AuthApi,
    BaseApiClient,
    CredentialsApi,
    GatewaysApi,
    FilesApi,
    PlatformsApi,
    SystemApi,
} from "@/lib/api";
import { useSession } from "@/hooks/use-session";

export interface ApiBundle {
    auth: AuthApi;
    credentials: CredentialsApi;
    platforms: PlatformsApi;
    gateways: GatewaysApi;
    files: FilesApi;
    system: SystemApi;
}

/**
 * 取出按业务域分组的接口客户端。
 *
 * - {@code token} 自动从 {@link useSession} 注入；
 * - 401 时自动 logout 并跳转 {@code /login}；
 * - 在 token 不变时返回稳定引用，便于直接放进 {@code useEffect} 依赖。
 */
export function useApi(): ApiBundle {
    const { session, logout } = useSession();
    const navigate = useNavigate();
    const token = session?.token;

    const onUnauthorized = useCallback(() => {
        logout();
        navigate("/login", { replace: true });
    }, [logout, navigate]);

    return useMemo(() => {
        const client = new BaseApiClient({ token, onUnauthorized });
        return {
            auth: new AuthApi(client),
            credentials: new CredentialsApi(client),
            platforms: new PlatformsApi(client),
            gateways: new GatewaysApi(client),
            files: new FilesApi(client),
            system: new SystemApi(client),
        };
    }, [token, onUnauthorized]);
}
