import type { BaseApiClient } from "@/lib/api/client";
import type {
    AddCredentialRequest,
    Credential,
    PagedResponse,
    UpdateCredentialRequest,
} from "@/types/api";

export interface CredentialListParams {
    page: number;
    pageSize: number;
}

/**
 * 凭据管理接口（/v1/credentials/*）。
 */
export class CredentialsApi {
    private readonly client: BaseApiClient;

    constructor(client: BaseApiClient) {
        this.client = client;
    }

    list(params: CredentialListParams): Promise<PagedResponse<Credential>> {
        return this.client.requestPaged<Credential>(
            this.client.url("/v1/credentials/list", { ...params }),
        );
    }

    get(id: string): Promise<Credential> {
        return this.client.request<Credential>(
            this.client.url("/v1/credentials/info", { id }),
        );
    }

    create(body: AddCredentialRequest): Promise<void> {
        return this.client.request<void>("/v1/credentials/add", {
            method: "POST",
            body: JSON.stringify(body),
        });
    }

    update(id: string, body: UpdateCredentialRequest): Promise<void> {
        return this.client.request<void>(`/v1/credentials/update/${id}`, {
            method: "PUT",
            body: JSON.stringify(body),
        });
    }

    remove(id: string): Promise<void> {
        return this.client.request<void>(`/v1/credentials/delete/${id}`, {
            method: "DELETE",
        });
    }
}
