import type { BaseApiClient } from "@/lib/api/client";
import type { PagedResponse, StoredFile } from "@/types/api";

export class FilesApi {
    private readonly client: BaseApiClient;

    constructor(client: BaseApiClient) {
        this.client = client;
    }

    list(params: {
        page: number;
        pageSize: number;
    }): Promise<PagedResponse<StoredFile>> {
        return this.client.requestPaged<StoredFile>(
            this.client.url("/v1/files/list", params),
        );
    }

    create(name: string, description: string, file: File): Promise<StoredFile> {
        const body = new FormData();
        body.append("name", name);
        body.append("description", description);
        body.append("file", file);
        return this.client.request<StoredFile>("/v1/files/add", {
            method: "POST",
            body,
        });
    }

    update(
        id: string,
        body: { name: string; description: string },
    ): Promise<void> {
        return this.client.request<void>(`/v1/files/update/${id}`, {
            method: "PUT",
            body: JSON.stringify(body),
        });
    }

    replace(id: string, file: File): Promise<void> {
        const body = new FormData();
        body.append("file", file);
        return this.client.request<void>(`/v1/files/content/${id}`, {
            method: "PUT",
            body,
        });
    }

    remove(id: string): Promise<void> {
        return this.client.request<void>(`/v1/files/delete/${id}`, {
            method: "DELETE",
        });
    }

    async download(file: StoredFile): Promise<void> {
        const blob = await this.client.download(
            `/v1/files/download/${file.id}`,
        );
        const url = URL.createObjectURL(blob);
        const anchor = document.createElement("a");
        anchor.href = url;
        anchor.download = file.originalFilename;
        anchor.click();
        URL.revokeObjectURL(url);
    }
}
