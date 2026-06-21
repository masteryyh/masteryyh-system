import type { BaseApiClient } from "@/lib/api/client";
import type {
    AppPlatform,
    AppPlatformRequest,
    PagedResponse,
} from "@/types/api";

export interface PlatformListParams {
    page: number;
    pageSize: number;
}

/**
 * 应用平台管理接口（/v1/platforms/*）。
 */
export class PlatformsApi {
    private readonly client: BaseApiClient;

    constructor(client: BaseApiClient) {
        this.client = client;
    }

    list(params: PlatformListParams): Promise<PagedResponse<AppPlatform>> {
        return this.client.requestPaged<AppPlatform>(
            this.client.url("/v1/platforms/list", { ...params }),
        );
    }

    get(id: string): Promise<AppPlatform> {
        return this.client.request<AppPlatform>(
            this.client.url("/v1/platforms/info", { id }),
        );
    }

    create(body: AppPlatformRequest): Promise<void> {
        return this.client.request<void>("/v1/platforms/add", {
            method: "POST",
            body: JSON.stringify(body),
        });
    }

    update(id: string, body: AppPlatformRequest): Promise<void> {
        return this.client.request<void>(`/v1/platforms/update/${id}`, {
            method: "PUT",
            body: JSON.stringify(body),
        });
    }

    remove(id: string): Promise<void> {
        return this.client.request<void>(`/v1/platforms/delete/${id}`, {
            method: "DELETE",
        });
    }
}
