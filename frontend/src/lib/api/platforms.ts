import type { BaseApiClient } from "@/lib/api/client";
import type {
    AppPlatform,
    AppPlatformRequest,
    DockerContainer,
    DockerImage,
    DockerNetwork,
    DockerVolume,
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

    containers(id: string): Promise<DockerContainer[]> {
        return this.client.request<DockerContainer[]>(
            `/v1/platforms/${id}/containers`,
        );
    }

    images(id: string): Promise<DockerImage[]> {
        return this.client.request<DockerImage[]>(
            `/v1/platforms/${id}/images`,
        );
    }

    networks(id: string): Promise<DockerNetwork[]> {
        return this.client.request<DockerNetwork[]>(
            `/v1/platforms/${id}/networks`,
        );
    }

    volumes(id: string): Promise<DockerVolume[]> {
        return this.client.request<DockerVolume[]>(
            `/v1/platforms/${id}/volumes`,
        );
    }
}
