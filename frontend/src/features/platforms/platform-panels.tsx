import { useMemo, type ReactNode } from "react";
import { Clock, ServerCog } from "lucide-react";

import { EmptyState } from "@/components/resource-ui";
import { useTranslation } from "@/hooks/use-translation";
import {
    formatBytes,
    formatDuration,
    formatEpoch,
} from "@/lib/formatters";
import type { AppPlatform } from "@/types/api";
import { usePlatformDetailContext } from "./use-platform-detail-context";
import {
    type Column,
    RefreshButton,
    ResourcePanelBody,
    SectionCard,
} from "./panel-primitives";
import { useDockerResource } from "./use-docker-resource";
import type {
    DockerContainer,
    DockerImage,
    DockerNetwork,
    DockerVolume,
} from "@/types/api";

/**
 * 容器状态 → 颜色点。与列表页在线点保持同一视觉语言。
 */
function stateDot(state: string | null): string {
    switch (state) {
        case "running":
            return "bg-emerald-500 shadow-[0_0_0_3px_rgba(16,185,129,0.14)]";
        case "paused":
            return "bg-amber-500";
        case "exited":
        case "dead":
            return "bg-slate-400";
        default:
            return "bg-slate-300";
    }
}

function shortId(id: string | null | undefined): string {
    if (!id) return "";
    return id.replace(/^sha256:/, "").slice(0, 12);
}

function Mono({ children }: { children: ReactNode }) {
    return (
        <span className="font-mono text-xs text-muted-foreground">
            {children}
        </span>
    );
}

/**
 * 概览页：Docker 下展示运行中的容器与拥有的镜像；HOST 下提示等待 agent。
 */
export function OverviewPanel() {
    const { platform } = usePlatformDetailContext();
    if (platform?.platformType === "HOST") {
        return <HostAgentPending />;
    }
    if (platform?.platformType === "DOCKER") {
        return <DockerOverview platform={platform} />;
    }
    return null;
}

function DockerOverview({ platform }: { platform: AppPlatform }) {
    const { t } = useTranslation();
    const containers = useDockerResource<DockerContainer[]>(
        platform.id,
        (client, id) => client.platforms.containers(id),
        true,
    );
    const images = useDockerResource<DockerImage[]>(
        platform.id,
        (client, id) => client.platforms.images(id),
        true,
    );

    const running = useMemo(
        () =>
            (containers.data ?? []).filter(
                (item) => item.state === "running",
            ),
        [containers.data],
    );

    const containerColumns: Column<DockerContainer>[] = [
        {
            key: "name",
            header: t("platforms.detail.columns.container.name"),
            render: (row) => (
                <span className="font-medium">{row.name || shortId(row.id)}</span>
            ),
        },
        {
            key: "id",
            header: t("platforms.detail.columns.id"),
            render: (row) => <Mono>{shortId(row.id)}</Mono>,
            className: "text-muted-foreground",
        },
        {
            key: "image",
            header: t("platforms.detail.columns.container.image"),
            render: (row) => (
                <span className="font-mono text-xs">{row.image || "—"}</span>
            ),
        },
        {
            key: "uptime",
            header: t("platforms.detail.columns.container.uptime"),
            render: (row) => {
                if (row.state !== "running" || !row.createdAt) return "—";
                return (
                    <span className="font-mono text-xs text-muted-foreground">
                        {formatDuration(Date.now() - row.createdAt)}
                    </span>
                );
            },
        },
        {
            key: "status",
            header: t("platforms.detail.columns.container.status"),
            render: (row) => (
                <span className="inline-flex items-center gap-2 text-xs font-medium">
                    <span
                        className={`size-2 rounded-full ${stateDot(row.state)}`}
                    />
                    {row.status || row.state || "—"}
                </span>
            ),
        },
    ];

    const imageColumns: Column<DockerImage>[] = [
        {
            key: "id",
            header: t("platforms.detail.columns.id"),
            render: (row) => <Mono>{shortId(row.id)}</Mono>,
        },
        {
            key: "name",
            header: t("platforms.detail.columns.image.name"),
            render: (row) =>
                row.repoTags.length > 0 ? (
                    <span className="font-mono text-xs">
                        {row.repoTags[0]}
                        {row.repoTags.length > 1 ? (
                            <span className="ml-1 text-muted-foreground">
                                +{row.repoTags.length - 1}
                            </span>
                        ) : null}
                    </span>
                ) : (
                    <span className="text-xs text-muted-foreground">
                        &lt;none&gt;:{shortId(row.id).slice(0, 8)}
                    </span>
                ),
        },
        {
            key: "arch",
            header: t("platforms.detail.columns.image.arch"),
            render: (row) => (
                <span className="font-mono text-xs text-muted-foreground">
                    {row.arch && row.os ? `${row.os}/${row.arch}` : (row.arch ?? "—")}
                </span>
            ),
        },
        {
            key: "size",
            header: t("platforms.detail.columns.image.size"),
            render: (row) => (
                <span className="font-mono text-xs text-muted-foreground">
                    {formatBytes(row.size)}
                </span>
            ),
        },
    ];

    return (
        <div className="space-y-6">
            <SectionCard
                title={t("platforms.detail.overview.runningContainers")}
                description={t(
                    "platforms.detail.overview.runningContainersDesc",
                    { count: running.length },
                )}
                action={
                    <RefreshButton
                        onClick={containers.reload}
                        loading={containers.loading}
                    />
                }
            >
                <ResourcePanelBody
                    loading={containers.loading}
                    error={containers.error}
                    rows={running}
                    rowKey={(row) => row.id}
                    columns={containerColumns}
                    emptyHint={t("platforms.detail.empty.containers")}
                />
            </SectionCard>
            <SectionCard
                title={t("platforms.detail.overview.images")}
                description={t("platforms.detail.overview.imagesDesc", {
                    count: images.data?.length ?? 0,
                })}
                action={
                    <RefreshButton
                        onClick={images.reload}
                        loading={images.loading}
                    />
                }
            >
                <ResourcePanelBody
                    loading={images.loading}
                    error={images.error}
                    rows={images.data ?? []}
                    rowKey={(row) => row.id}
                    columns={imageColumns}
                    emptyHint={t("platforms.detail.empty.images")}
                />
            </SectionCard>
        </div>
    );
}

function HostAgentPending() {
    const { t } = useTranslation();
    return (
        <EmptyState
            title={t("platforms.detail.overview.hostPendingTitle")}
            description={t("platforms.detail.overview.hostPendingDesc")}
        />
    );
}

export function ContainersPanel() {
    const { t } = useTranslation();
    const { platformId, platform } = usePlatformDetailContext();
    const { data, loading, error, reload } = useDockerResource<DockerContainer[]>(
        platformId,
        (api, id) => api.platforms.containers(id),
        platform?.platformType === "DOCKER",
    );

    const columns: Column<DockerContainer>[] = [
        {
            key: "name",
            header: t("platforms.detail.columns.container.name"),
            render: (row) => (
                <span className="font-medium">{row.name || shortId(row.id)}</span>
            ),
        },
        {
            key: "id",
            header: t("platforms.detail.columns.id"),
            render: (row) => <Mono>{shortId(row.id)}</Mono>,
        },
        {
            key: "image",
            header: t("platforms.detail.columns.container.image"),
            render: (row) => (
                <span className="font-mono text-xs">{row.image || "—"}</span>
            ),
        },
        {
            key: "ports",
            header: t("platforms.detail.columns.container.ports"),
            render: (row) =>
                row.ports.length > 0 ? (
                    <div className="flex flex-col gap-0.5">
                        {row.ports.slice(0, 3).map((port) => (
                            <Mono key={port}>{port}</Mono>
                        ))}
                        {row.ports.length > 3 ? (
                            <span className="text-xs text-muted-foreground">
                                +{row.ports.length - 3}
                            </span>
                        ) : null}
                    </div>
                ) : (
                    "—"
                ),
        },
        {
            key: "uptime",
            header: t("platforms.detail.columns.container.uptime"),
            render: (row) =>
                row.state === "running" && row.createdAt ? (
                    <span className="font-mono text-xs text-muted-foreground">
                        {formatDuration(Date.now() - row.createdAt)}
                    </span>
                ) : (
                    "—"
                ),
        },
        {
            key: "status",
            header: t("platforms.detail.columns.container.status"),
            render: (row) => (
                <span className="inline-flex items-center gap-2 text-xs font-medium">
                    <span
                        className={`size-2 rounded-full ${stateDot(row.state)}`}
                    />
                    {row.status || row.state || "—"}
                </span>
            ),
        },
        {
            key: "created",
            header: t("platforms.detail.columns.created"),
            render: (row) => (
                <span className="font-mono text-xs text-muted-foreground">
                    {formatEpoch(row.createdAt)}
                </span>
            ),
        },
    ];

    return (
        <SectionCard
            title={t("platforms.detail.containers.title")}
            description={t("platforms.detail.containersDesc", {
                count: data?.length ?? 0,
            })}
            action={<RefreshButton onClick={reload} loading={loading} />}
        >
            <ResourcePanelBody
                loading={loading}
                error={error}
                rows={data ?? []}
                rowKey={(row) => row.id}
                columns={columns}
                emptyHint={t("platforms.detail.empty.containers")}
            />
        </SectionCard>
    );
}

export function ImagesPanel() {
    const { t } = useTranslation();
    const { platformId, platform } = usePlatformDetailContext();
    const { data, loading, error, reload } = useDockerResource<DockerImage[]>(
        platformId,
        (api, id) => api.platforms.images(id),
        platform?.platformType === "DOCKER",
    );

    const columns: Column<DockerImage>[] = [
        {
            key: "id",
            header: t("platforms.detail.columns.id"),
            render: (row) => <Mono>{shortId(row.id)}</Mono>,
        },
        {
            key: "tags",
            header: t("platforms.detail.columns.image.tags"),
            render: (row) =>
                row.repoTags.length > 0 ? (
                    <div className="flex flex-col gap-0.5">
                        {row.repoTags.slice(0, 2).map((tag) => (
                            <span
                                key={tag}
                                className="font-mono text-xs"
                            >
                                {tag}
                            </span>
                        ))}
                        {row.repoTags.length > 2 ? (
                            <span className="text-xs text-muted-foreground">
                                +{row.repoTags.length - 2}
                            </span>
                        ) : null}
                    </div>
                ) : (
                    <span className="text-xs text-muted-foreground">
                        &lt;none&gt;
                    </span>
                ),
        },
        {
            key: "arch",
            header: t("platforms.detail.columns.image.arch"),
            render: (row) => (
                <span className="font-mono text-xs text-muted-foreground">
                    {row.arch && row.os ? `${row.os}/${row.arch}` : (row.arch ?? "—")}
                </span>
            ),
        },
        {
            key: "size",
            header: t("platforms.detail.columns.image.size"),
            render: (row) => (
                <span className="font-mono text-xs text-muted-foreground">
                    {formatBytes(row.size)}
                </span>
            ),
        },
        {
            key: "created",
            header: t("platforms.detail.columns.created"),
            render: (row) => (
                <span className="font-mono text-xs text-muted-foreground">
                    {formatEpoch(row.createdAt ? Date.parse(row.createdAt) : null)}
                </span>
            ),
        },
    ];

    return (
        <SectionCard
            title={t("platforms.detail.images.title")}
            description={t("platforms.detail.imagesDesc", {
                count: data?.length ?? 0,
            })}
            action={<RefreshButton onClick={reload} loading={loading} />}
        >
            <ResourcePanelBody
                loading={loading}
                error={error}
                rows={data ?? []}
                rowKey={(row) => row.id}
                columns={columns}
                emptyHint={t("platforms.detail.empty.images")}
            />
        </SectionCard>
    );
}

export function NetworksPanel() {
    const { t } = useTranslation();
    const { platformId, platform } = usePlatformDetailContext();
    const { data, loading, error, reload } = useDockerResource<DockerNetwork[]>(
        platformId,
        (api, id) => api.platforms.networks(id),
        platform?.platformType === "DOCKER",
    );

    const columns: Column<DockerNetwork>[] = [
        {
            key: "name",
            header: t("platforms.detail.columns.network.name"),
            render: (row) => (
                <span className="font-medium">{row.name || "—"}</span>
            ),
        },
        {
            key: "id",
            header: t("platforms.detail.columns.id"),
            render: (row) => <Mono>{shortId(row.id)}</Mono>,
        },
        {
            key: "driver",
            header: t("platforms.detail.columns.network.driver"),
            render: (row) => (
                <span className="font-mono text-xs text-muted-foreground">
                    {row.driver || "—"}
                </span>
            ),
        },
        {
            key: "scope",
            header: t("platforms.detail.columns.network.scope"),
            render: (row) => (
                <span className="font-mono text-xs text-muted-foreground">
                    {row.scope || "—"}
                </span>
            ),
        },
        {
            key: "internal",
            header: t("platforms.detail.columns.network.internal"),
            render: (row) =>
                row.internal ? (
                    <span className="inline-flex items-center gap-1.5 text-xs font-medium text-amber-600">
                        <span className="size-2 rounded-full bg-amber-500" />
                        {t("platforms.detail.yes")}
                    </span>
                ) : (
                    <span className="text-xs text-muted-foreground">
                        {t("platforms.detail.no")}
                    </span>
                ),
        },
    ];

    return (
        <SectionCard
            title={t("platforms.detail.networks.title")}
            description={t("platforms.detail.networksDesc", {
                count: data?.length ?? 0,
            })}
            action={<RefreshButton onClick={reload} loading={loading} />}
        >
            <ResourcePanelBody
                loading={loading}
                error={error}
                rows={data ?? []}
                rowKey={(row) => row.id}
                columns={columns}
                emptyHint={t("platforms.detail.empty.networks")}
            />
        </SectionCard>
    );
}

export function VolumesPanel() {
    const { t } = useTranslation();
    const { platformId, platform } = usePlatformDetailContext();
    const { data, loading, error, reload } = useDockerResource<DockerVolume[]>(
        platformId,
        (api, id) => api.platforms.volumes(id),
        platform?.platformType === "DOCKER",
    );

    const columns: Column<DockerVolume>[] = [
        {
            key: "name",
            header: t("platforms.detail.columns.volume.name"),
            render: (row) => (
                <span className="font-medium">{row.name}</span>
            ),
        },
        {
            key: "driver",
            header: t("platforms.detail.columns.volume.driver"),
            render: (row) => (
                <span className="font-mono text-xs text-muted-foreground">
                    {row.driver || "—"}
                </span>
            ),
        },
        {
            key: "mountpoint",
            header: t("platforms.detail.columns.volume.mountpoint"),
            render: (row) => (
                <span
                    className="block max-w-[420px] truncate font-mono text-xs text-muted-foreground"
                    title={row.mountpoint ?? undefined}
                >
                    {row.mountpoint || "—"}
                </span>
            ),
        },
    ];

    return (
        <SectionCard
            title={t("platforms.detail.volumes.title")}
            description={t("platforms.detail.volumesDesc", {
                count: data?.length ?? 0,
            })}
            action={<RefreshButton onClick={reload} loading={loading} />}
        >
            <ResourcePanelBody
                loading={loading}
                error={error}
                rows={data ?? []}
                rowKey={(row) => row.name}
                columns={columns}
                emptyHint={t("platforms.detail.empty.volumes")}
            />
        </SectionCard>
    );
}

/**
 * HOST 平台的服务 / cron 占位面板，等待后续主机 agent 上报数据。
 */
export function HostPlaceholderPanel({ kind }: { kind: "services" | "cron" }) {
    const { t } = useTranslation();
    const Icon = kind === "services" ? ServerCog : Clock;
    const title =
        kind === "services"
            ? t("platforms.detail.services.title")
            : t("platforms.detail.cron.title");
    const desc =
        kind === "services"
            ? t("platforms.detail.services.pendingDesc")
            : t("platforms.detail.cron.pendingDesc");
    return (
        <SectionCard title={title}>
            <div className="grid min-h-48 place-items-center px-6 py-10 text-center">
                <div>
                    <div className="mx-auto grid size-10 place-items-center rounded-lg border bg-background">
                        <Icon className="size-5 text-muted-foreground" />
                    </div>
                    <p className="mt-3 font-medium">{desc}</p>
                </div>
            </div>
        </SectionCard>
    );
}
