import type { BaseApiClient } from "@/lib/api/client";
import type { LoginData } from "@/types/api";

export interface LoginRequest {
    name: string;
    password: string;
}

/**
 * 鉴权相关接口（POST /v1/user/login）。
 */
export class AuthApi {
    private readonly client: BaseApiClient;

    constructor(client: BaseApiClient) {
        this.client = client;
    }

    login(body: LoginRequest): Promise<LoginData> {
        return this.client.request<LoginData>("/v1/user/login", {
            method: "POST",
            body: JSON.stringify(body),
        });
    }
}
