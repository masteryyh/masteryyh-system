# CLAUDE.md

本文件为 Claude Code / Codex 等 agent 在本仓库工作时提供指引。`AGENTS.md` 是指向本文件的 symlink，修改本文件即可同步两者。

## 项目定位

**masteryyh-system** 是一个个人 homelab 管理系统，用于统一纳管家庭实验室中分散在多台主机上的应用、入口网关、文件资源与运行状态。项目会长期扩展，新增模块必须复用既有的分包结构、统一响应、分页、软删除、鉴权、i18n 和最小验证约定。

当前主要能力：

- **凭据管理（Credential）**：集中保管 SSH 私钥/公钥、文本口令、X.509 证书与私钥，并解析密钥/证书元信息。
- **应用平台管理（App Platform）**：登记被纳管的目标平台。`HOST` 通过 SSH 管理主机 init system（`SYSTEMD` / `OPENRC`）；`DOCKER` 通过 docker-java 连接 Docker daemon。
- **网关管理（Gateway）**：登记 nginx 网关实例，维护 entry point 与 route，支持 `PROXY` / `STATIC` 路由、nginx 配置解析、Docker/主机部署、异步部署进度推送。
- **文件管理（Stored File）**：上传文件到 S3 兼容对象存储，记录 sha256、content type、object key，可作为静态网关路由资源。
- **WebShell 与事件流**：`/v1/webshell/{platformId}` 提供 SSH WebShell，`/v1/ws` 提供通用 pub/sub 事件流，用于网关部署进度等前端实时反馈。

## 仓库结构

这是一个 **pnpm + Gradle 的 monorepo**：

```text
masteryyh-system/
├── backend/             # Spring Boot 后端（Gradle，独立构建）
├── frontend/            # React + Vite 前端（pnpm workspace 成员）
├── package.json         # 根 workspace 脚本（frontend:*、backend:*）
├── pnpm-workspace.yaml  # 仅纳入 frontend
├── CLAUDE.md            # agent 工作指引
├── AGENTS.md            # symlink -> CLAUDE.md
└── HANDOFF.md           # 跨会话交接文档
```

### 后端分包

根包：`backend/src/main/java/win/masteryyh/masteryyhsystem`

| 包 | 职责 |
|----|------|
| `Application.java` | Spring Boot 启动类 |
| `base/config` | 基础设施配置：Redis、S3、系统配置、WebSocket 注册 |
| `base/security` | Spring Security 无状态 JWT、WebSocket 握手鉴权、统一 401 |
| `base/response` | 统一响应：`GenericResponse`、`GenericResponseAdvisor`、`IgnoreResponseAdvice` |
| `base/page` | 分页入参/出参：`PageDataRequest`、`PagedResponse` |
| `base/exception` | `BusinessException`（业务异常，携带 code/message/messageKey） |
| `base/utils` | JWT、host key 校验、异步事务后执行、S3 文件管理、nginx 配置编解码、静态包校验、SSH/证书解析等工具 |
| `base/websocket` | 通用 WebSocket 事件协议、订阅者管理、事件广播 |
| `controller` | 薄控制器，做校验、调用 service、映射 REST/Web 下载响应 |
| `service` | 业务逻辑：平台、凭据、网关、entry point、route、文件、登录、凭据状态调度 |
| `platform` | 远程连接层：`AbstractPlatformManager`、`SSHManager`、`DockerManager`、WebShell |
| `model` | JPA 实体：`AppPlatform`、`Credential`、`GatewayConfig`、`GatewayEntryPoint`、`GatewayRoute`、`StoredFile` |
| `model/dto` | 入参/出参 DTO、枚举、版本信息 |
| `repository` | Spring Data JPA 仓库 |

### 前端结构

根目录：`frontend/src`

- `App.tsx` / `main.tsx`：路由与 provider 入口。
- `features/credentials`、`features/platforms`、`features/gateways`、`features/files`、`features/home`、`features/login`：业务页面。
- `components/ui`：shadcn/ui 组件（style：`radix-nova`，base color：neutral）。
- `components/web-shell*`、`components/console-shell.tsx`：登录后壳层与 WebShell UI。
- `context`、`hooks`：session、version、web-shell、事件流等状态入口。
- `lib/api`：按资源分组的 API client；`lib/backend-url.ts` 统一处理 `VITE_BACKEND_URL`、HTTP 与 WebSocket URL。
- `i18n/messages`：中英文文案。补 i18n 时先扫描后端 message key，再做集合差异，不要手工猜漏项。
- `@/*` alias 指向 `src/`。

## 技术栈

### 后端

- Java 25（Gradle toolchain）、Spring Boot 4.1.0、Gradle 9.x wrapper。
- Spring Web MVC、Spring WebSocket、Spring Security、虚拟线程（`spring.threads.virtual.enabled: true`）。
- Spring Data JPA + Hibernate 7.4，PostgreSQL，`hypersistence-utils` 支持 jsonb。
- 主键使用 Hibernate/JVM 侧 UUID v7：`@GeneratedValue` + `@UuidGenerator(style = VERSION_7)`，数据库列保留 `uuid default uuidv7()` 兜底。
- Redis / Redisson 4.5，用于锁与后台任务协作；配置文件 `redisson.yaml` 支持 `REDIS_HOST` / `REDIS_PASSWORD`。
- sshj 0.38 管理 HOST 平台；docker-java 3.7.1 管理 DOCKER 平台。
- AWS SDK S3 client 连接 S3 兼容对象存储。
- BouncyCastle 处理 SSH 密钥、X.509 证书与私钥；Lombok。
- 构建中会生成 `BuildInfo`：本地版本号为 `dirty-yyyyMMddHHmm`，CI 为 `yyyyMMddHHmm`，并保留短 commit hash 与 build time。

### 前端

- React 19、React Router 7、Vite 8、TypeScript 6、Tailwind CSS v4。
- shadcn/ui + radix-ui + lucide-react、`@fontsource-variable/geist`。
- Monaco Editor、xterm.js、sonner。
- 代码风格：4 空格缩进（`.prettierrc.json` `tabWidth: 4`），ESLint flat config。

## 核心业务域

### 实体与资源

- `AppPlatform`（`app_platform`）：目标平台。`DOCKER` 使用 `dockerHost`；`HOST` 使用 `sshHost` / `sshPort` / `sshUsername` / `credentialId`，并通过 `initSystem` 决定健康检查命令。`hostKeys`（jsonb）保存已知主机公钥。
- `Credential`（`credentials`）：凭据。`CredentialType` 包含 `SSH_PRIVATE_KEY`、`SSH_PUBLIC_KEY`、`TEXT_PASSWORD`、`X509_CERTIFICATE`。密钥、证书与 passphrase 等敏感字段大多不可更新；`sshKeyInfo`、`certificateInfo` 为 jsonb 元信息。
- `GatewayConfig`（`gateway_config`）：网关实例，绑定 `platformId`，保存 nginx 主配置、容器/服务名、镜像、配置路径与状态。
- `GatewayEntryPoint`（`gateway_entry_point`）：网关监听入口，包含端口、域名列表（jsonb）与可选证书凭据。
- `GatewayRoute`（`gateway_route`）：入口下的路由，支持 `PROXY` 和 `STATIC`，按 priority/path 匹配；静态路由引用 `StoredFile`。
- `StoredFile`（`files`）：S3 对象元数据。删除前会检查是否被静态路由占用。

除 `StoredFile` 当前实体外，核心实体沿用 `@SQLDelete` + `@SQLRestriction("deleted_at IS NULL")` 软删除模式。新增可删除实体应优先沿用软删除。

### 连接与部署

- `SSHManager` / `DockerManager` 继承 `AbstractPlatformManager`，在启动时加载平台并维护连接、健康状态和 ready count。
- `SSHManager` 使用数据库 host key verifier，首次连接持久化 host key；健康检查按 `SYSTEMD` / `OPENRC` 执行不同命令。
- `GatewayService` 创建/更新/删除网关时先更新数据库状态，再通过 `AsyncTaskExecutor.afterCommit(...)` 异步部署或清理。
- 网关部署使用 Redisson lock 防止同一 gateway 并发操作，通过 `EventBroadcaster` 往 `gateway:{id}` channel 推送 `progress` / `done` / `failed`。
- nginx 配置相关逻辑集中在 `NginxConfigCodec`、`NginxDeploymentBundleService`、`StaticArchiveValidator`，不要在 controller 或前端重复拼复杂配置。

## 接口约定

1. **统一响应**：REST 返回值经 `GenericResponseAdvisor` 包装为 `GenericResponse{code,message,data}`。Controller 返回业务数据即可；文件下载等特殊响应可用 `@IgnoreResponseAdvice`。
2. **统一分页**：列表接口入参 `PageDataRequest{page,pageSize}`，page 从 1 开始；出参 `PagedResponse`。
3. **REST 前缀**：统一以 `/v1` 开头。
4. **鉴权**：除放行接口外，请求需 `Authorization: Bearer {jwt}`。当前单管理员来自 `SystemConfiguration.admin`，登录从 response body 返回 token。
5. **当前放行**：`POST /v1/user/login`、`GET /v1/version`、`/metrics/**` 放行；WebSocket endpoint 在 HTTP security 中放行，但握手 interceptor 仍通过 `?token=<jwt>` 校验。
6. **CORS**：当前临时全放行 origin/method/header，适合联调；生产部署前应收紧。
7. **业务错误**：抛 `BusinessException(code, messageKey, fallbackMessage)`，前端通过 i18n message key 翻译。

主要接口分组：

- `/v1/user/login`
- `/v1/version`
- `/v1/credentials`：`/list`、`/info`、`/add`、`/update/{id}`、`/delete/{id}`
- `/v1/platforms`：`/list`、`/info`、`/add`、`/update/{id}`、`/delete/{id}`
- `/v1/files`：`/list`、`/info`、multipart `/add`、`/download/{id}`、`/delete/{id}`
- `/v1/gateways`：`/list`、`/info`、`/add`、`/update/{id}`、`/delete/{id}`、`/nginx/parse`
- `/v1/gateways/{gatewayId}/entry-points`：`/list`、`/info/{id}`、`/add`、`/update/{id}`、`/delete/{id}`
- `/v1/gateways/{gatewayId}/entry-points/{entryPointId}/routes`：`/list`、`/info/{id}`、`/add`、`/update/{id}`、`/delete/{id}`
- WebSocket：`/v1/ws?token=...`、`/v1/webshell/{platformId}?token=...`

## 前端约定

- 前端页面已覆盖登录、首页、凭据、平台、网关、网关详情、文件管理。
- API client 不要手写 base URL；统一使用 `BaseApiClient`、`backendHttpUrl`、`backendWebSocketUrl`。
- `VITE_BACKEND_URL` 是 **Vite 构建时变量**。为空时前端使用相对 `/v1`，开发模式由 Vite proxy 转发到默认 `http://localhost:8080`；生产静态包中的后端地址在 build 时固定。
- 生产前端镜像只基于当前 `dist/` 和 `nginx.conf`：SPA 路由 fallback 到 `index.html`，但 `/v1` 明确返回 404，除非构建时使用绝对 `VITE_BACKEND_URL` 或上游代理提前处理。
- 后端 `LocalDateTime` 返回无时区字符串；前端时间格式化集中在 `frontend/src/lib/formatters.ts`，按 `Asia/Shanghai` 显示。新增时间展示不要直接 `new Date(raw).toLocaleString()`。
- UI 新增功能优先复用现有 shadcn/ui、resource helpers、通知与 i18n 入口；保持 4 空格缩进。

## 构建与运行

> 沙箱/受限环境下 Gradle 默认 home 或 wrapper 下载可能失败。历史验证通常使用 `GRADLE_USER_HOME=/private/tmp/masteryyh-gradle`。

### 后端

在 `backend/` 目录下：

```bash
# 最常用验证
env GRADLE_USER_HOME=/private/tmp/masteryyh-gradle ./gradlew compileJava --no-daemon --console=plain

# 打 jar
env GRADLE_USER_HOME=/private/tmp/masteryyh-gradle ./gradlew bootJar --no-daemon --console=plain

# 完整构建
env GRADLE_USER_HOME=/private/tmp/masteryyh-gradle ./gradlew build --no-daemon --console=plain
```

根目录脚本：

```bash
pnpm backend:dev
pnpm backend:build
pnpm backend:native
```

`backend:Dockerfile` 当前期望先产出 `build/libs/masteryyh-system.jar`，运行时 `WORKDIR=/app`，并额外加载 `optional:file:/app/config/`。

### 前端

仓库根目录：

```bash
pnpm --filter frontend dev
pnpm --filter frontend build
pnpm --filter frontend lint

# 根脚本
pnpm frontend:dev
pnpm frontend:build
```

构建生产镜像前需要先生成 `frontend/dist/`；`frontend/Dockerfile` 只复制 `nginx.conf` 和 `dist/`。

## 本地依赖与配置

- 后端通过 `spring.config.import: optional:file:.env[.properties]` 加载当前工作目录下的 `.env`。
- 使用 `pnpm backend:dev` 时会先 `cd backend`，因此本地默认读取 `backend/.env`。
- 如果从仓库根直接运行 jar，默认查找仓库根 `.env`；容器里默认查找 `/app/.env` 或 `/app/config/` 中的配置。
- `backend/.env.example` 列出 PostgreSQL、Redis、JWT、管理员、S3 相关 key。
- `application.yaml` 默认 PostgreSQL 为 `jdbc:postgresql://localhost:5432/test`，`ddl-auto: update`。
- `redisson.yaml` 默认 Redis 为 `redis://localhost:6379/0`，但可用 env 覆盖。
- S3 兼容存储用于文件上传与静态资源包；部署前必须覆盖默认占位 access key/secret。
- Actuator 管理端点挂在 `/metrics`，当前暴露所有 endpoint。

## 协作约定

- 任务开始前先读 `HANDOFF.md` 最新条目，必要时再用 `rg` 搜历史条目。不要只依赖本文件或记忆。
- 仓库可能有用户未提交改动；先看 `git status --short`，不要回退与当前任务无关的改动。
- 本项目默认**不写测试，尤其不写接口测试**；以编译、前端 build/lint、`git diff --check`、必要的脚本/浏览器验证作为主要验证手段。
- 后端小改通常至少跑 `compileJava`；前端改动至少跑 `pnpm --filter frontend build` 或 `lint`；文档-only 改动至少跑 `git diff --check`，如指引要求也可补一次对应模块最小构建。
- 修改接口错误 key、validation key 或后端 message key 时，同步检查 `frontend/src/i18n/messages/*.json`。
- 修改前端部署、后端地址或 WebSocket 时，先讲清 Vite build-time env 与运行时 env 的边界，再改代码。
- 任务结束后按既有格式把最新条目插入 `HANDOFF.md` 顶部，记录目标、完成手段、验证结果和遗留项。
