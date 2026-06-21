import type { BaseApiClient } from "@/lib/api/client";
import type { VersionInfo } from "@/types/api";

/**
 * 系统/基础设施接口（GET /v1/version 等）。
 */
export class SystemApi {
    private readonly client: BaseApiClient;

    constructor(client: BaseApiClient) {
        this.client = client;
    }

    getVersion(): Promise<VersionInfo> {
        return this.client.request<VersionInfo>("/v1/version");
    }
}
