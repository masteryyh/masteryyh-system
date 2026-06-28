import type { BaseApiClient } from "@/lib/api/client";
import type {
    AddGatewayConfigRequest,
    GatewayConfig,
    PagedResponse,
    UpdateGatewayConfigRequest,
    GatewayEntryPoint,
    GatewayEntryPointRequest,
    GatewayRoute,
    GatewayRouteRequest,
} from "@/types/api";

export interface GatewayListParams {
    page: number;
    pageSize: number;
}

/**
 * 网关管理接口（/v1/gateways/*）。
 *
 * add/update/delete 均为异步：服务端立即返回，后续通过 /v1/ws 的
 * `gateway:<id>` channel 推送 progress/done/failed 事件。
 */
export class GatewaysApi {
    private readonly client: BaseApiClient;

    constructor(client: BaseApiClient) {
        this.client = client;
    }

    list(params: GatewayListParams): Promise<PagedResponse<GatewayConfig>> {
        return this.client.requestPaged<GatewayConfig>(
            this.client.url("/v1/gateways/list", { ...params }),
        );
    }

    get(id: string): Promise<GatewayConfig> {
        return this.client.request<GatewayConfig>(
            this.client.url("/v1/gateways/info", { id }),
        );
    }

    create(body: AddGatewayConfigRequest): Promise<void> {
        return this.client.request<void>("/v1/gateways/add", {
            method: "POST",
            body: JSON.stringify(body),
        });
    }

    update(id: string, body: UpdateGatewayConfigRequest): Promise<void> {
        return this.client.request<void>(`/v1/gateways/update/${id}`, {
            method: "PUT",
            body: JSON.stringify(body),
        });
    }

    remove(id: string): Promise<void> {
        return this.client.request<void>(`/v1/gateways/delete/${id}`, {
            method: "DELETE",
        });
    }

    deploy(id: string): Promise<void> {
        return this.client.request<void>(`/v1/gateways/deploy/${id}`, {
            method: "POST",
        });
    }

    listEntryPoints(gatewayId: string): Promise<GatewayEntryPoint[]> {
        return this.client.request<GatewayEntryPoint[]>(
            `/v1/gateways/${gatewayId}/entry-points/list`,
        );
    }

    createEntryPoint(
        gatewayId: string,
        body: GatewayEntryPointRequest,
    ): Promise<void> {
        return this.client.request<void>(
            `/v1/gateways/${gatewayId}/entry-points/add`,
            { method: "POST", body: JSON.stringify(body) },
        );
    }

    updateEntryPoint(
        gatewayId: string,
        id: string,
        body: GatewayEntryPointRequest,
    ): Promise<void> {
        return this.client.request<void>(
            `/v1/gateways/${gatewayId}/entry-points/update/${id}`,
            { method: "PUT", body: JSON.stringify(body) },
        );
    }

    removeEntryPoint(gatewayId: string, id: string): Promise<void> {
        return this.client.request<void>(
            `/v1/gateways/${gatewayId}/entry-points/delete/${id}`,
            { method: "DELETE" },
        );
    }

    listRoutes(
        gatewayId: string,
        entryPointId: string,
    ): Promise<GatewayRoute[]> {
        return this.client.request<GatewayRoute[]>(
            `/v1/gateways/${gatewayId}/entry-points/${entryPointId}/routes/list`,
        );
    }

    createRoute(
        gatewayId: string,
        entryPointId: string,
        body: GatewayRouteRequest,
    ): Promise<void> {
        return this.client.request<void>(
            `/v1/gateways/${gatewayId}/entry-points/${entryPointId}/routes/add`,
            { method: "POST", body: JSON.stringify(body) },
        );
    }

    updateRoute(
        gatewayId: string,
        entryPointId: string,
        id: string,
        body: GatewayRouteRequest,
    ): Promise<void> {
        return this.client.request<void>(
            `/v1/gateways/${gatewayId}/entry-points/${entryPointId}/routes/update/${id}`,
            { method: "PUT", body: JSON.stringify(body) },
        );
    }

    removeRoute(
        gatewayId: string,
        entryPointId: string,
        id: string,
    ): Promise<void> {
        return this.client.request<void>(
            `/v1/gateways/${gatewayId}/entry-points/${entryPointId}/routes/delete/${id}`,
            { method: "DELETE" },
        );
    }
}
