# CLAUDE.md

本文件为 Claude Code（claude.ai/code）在本仓库工作时提供指引。

## 项目定位

**masteryyh-system** 是一个**个人 homelab 管理系统**，用于统一纳管家庭实验室中分散在多台主机上的应用与资源。整体是一个持续演进的平台：当前已落地的是最基础的两块能力，后续会在此骨架上不断叠加更多 homelab 运维功能（如监控、网关、备份、自动化部署等）。

当前已实现的基础模块：

- **凭据管理（Credential）** —— 集中保管访问远程主机所需的 SSH 私钥/公钥、口令等敏感凭据。
- **应用平台管理（App Platform）** —— 登记并连接被纳管的「应用平台」，即运行应用的目标主机。每个平台以两种方式之一运行应用：
  - `SYSTEMD` —— 通过 SSH 连接主机，管理 systemd 托管的应用；
  - `DOCKER` —— 通过 docker-java 连接 Docker daemon，管理容器化应用。

> 写文档或代码时请记住：这是一个**会长期扩展**的系统，新增模块应复用现有的分包结构、统一响应、软删除、分页等既有约定，保持风格一致。

## 仓库结构

这是一个 **pnpm + Gradle 的 monorepo**：

```
masteryyh-system/
├── backend/            # Spring Boot 后端（Gradle，独立构建）
├── frontend/           # React + Vite 前端（pnpm workspace 成员）
├── package.json        # 根 workspace 脚本（frontend:dev/build、backend:build）
├── pnpm-workspace.yaml # 仅纳入 frontend
└── HANDOFF.md          # 跨会话交接文档（见末尾「协作约定」）
```

### 后端分包（`backend/.../win/masteryyh/masteryyhsystem`）

| 包 | 职责 |
|----|------|
| `Application.java` | Spring Boot 启动类 |
| `base/config` | 基础设施配置（`RedisConfiguration`、`SystemConfiguration` 等） |
| `base/security` | Spring Security 无状态 JWT 链：`SecurityConfiguration`、`JwtAuthenticationFilter`、`SecurityAuthenticationEntryPoint` |
| `base/response` | 统一响应：`GenericResponse`、`GenericResponseAdvisor`（`ResponseBodyAdvice`）、`IgnoreResponseAdvice` |
| `base/page` | 分页入参/出参：`PageDataRequest`、`PagedResponse` |
| `base/exception` | `BusinessException`（业务异常，携带 code/message） |
| `base/utils` | 工具类：`JwtUtils`、`DatabaseHostKeyVerifier`，`crypto/` 下为 SSH 密钥加解密（`CryptoUtils`、`SSHKeyInfo`、`SSHKeyType`） |
| `base/consts` | 常量（`GenericConsts`） |
| `controller` | 薄控制器，仅做校验、调用 service、映射响应 |
| `service` | 业务逻辑（`AppPlatformService`、`CredentialService`、`LoginService`） |
| `platform` | 远程纳管连接层：`SSHManager`、`DockerManager`，维护到各平台的连接与就绪状态 |
| `model` | JPA 实体（`AppPlatform`、`Credential`、`GatewayConfig`） |
| `model/dto` | 入参/出参 DTO 与枚举（`PlatformType`、`CredentialType` 等） |
| `repository` | Spring Data JPA 仓库 |

### 前端结构（`frontend/src`）

- `App.tsx` / `main.tsx` —— 登录页 + 登录后侧边栏布局的入口。
- `components/ui/` —— shadcn/ui 组件（style：`radix-nova`，base color：neutral）。
- `hooks/`、`lib/utils.ts` —— shadcn 约定的工具与 hook。
- `@/*` alias 指向 `src/`。

## 技术栈

### 后端
- **Java 25**（Gradle toolchain）、**Spring Boot 4.1.0**、`io.spring.dependency-management`
- **Spring Web MVC**，开启**虚拟线程**（`spring.threads.virtual.enabled: true`）
- **Spring Data JPA + Hibernate 7**（ORM 插件 + `hypersistence-utils` 提供 jsonb 类型支持）
- **PostgreSQL**（运行时驱动）—— 使用 `uuidv7()` 主键、`jsonb` 列、`@SQLDelete`/`@SQLRestriction` 软删除
- **Redis / Redisson 4.5**（`redisson.yaml` 配置单机连接）
- **Spring Security + nimbus-jose-jwt** —— 无状态 JWT 鉴权
- **sshj 0.38** —— SSH 连接 systemd 主机；**docker-java 3.7.1** —— 连接 Docker daemon
- **BouncyCastle** —— SSH 密钥处理；**Lombok**
- 构建插件包含 GraalVM native（`org.graalvm.buildtools.native`）

### 前端
- **React 19**、**Vite 8**、**TypeScript**、**Tailwind CSS v4**（`@tailwindcss/vite`）
- **shadcn/ui** + radix-ui + lucide 图标、`@fontsource-variable/geist` 字体
- 代码风格：**4 空格缩进**（`.prettierrc.json` `tabWidth: 4`），ESLint flat config

## 核心业务域

### 实体

- **`AppPlatform`**（表 `app_platform`）—— 一个被纳管的目标主机/平台。`platformType` 决定纳管方式：
  - `DOCKER`：使用 `dockerHost` 连接 Docker daemon；
  - `SYSTEMD`：使用 `systemdSSHHost/Port/Username` + `credentialId` 通过 SSH 连接；`hostKeys`（jsonb）保存已知主机公钥用于校验。
- **`Credential`**（表 `credentials`）—— 凭据，`credentialType` ∈ `SSH_PRIVATE_KEY` / `SSH_PUBLIC_KEY` / `TEXT_PASSWORD`；SSH 私钥及 passphrase 等敏感字段为不可更新（`updatable = false`），`sshKeyInfo`（jsonb）保存解析出的密钥元信息。
- **`GatewayConfig`**（表 `gateway_config`）—— 网关配置实体（仓库已存在，属于规划中的网关能力，尚未暴露完整 CRUD）。

### 连接管理层（`platform`）

- `SSHManager` / `DockerManager` 在 `@PostConstruct` 时从数据库加载对应类型的平台，用**虚拟线程**并行建立连接，维护 `clients`、`platformStatuses`、`readyCount` 等并发结构，供 `AppPlatformService` 在增删平台时同步刷新连接。
- `DatabaseHostKeyVerifier` 实现 SSH 首次连接的 host key 校验，并将新 host key 持久化到 `app_platform.host_keys`。

## 关键约定（务必遵守）

1. **统一响应结构**：所有接口经 `GenericResponseAdvisor` 包装为 `GenericResponse{code, message, data}`。Controller 里返回业务数据即可（或显式 `GenericResponse.ok(...)`）；需要跳过包装时用 `@IgnoreResponseAdvice`。
2. **统一分页**：列表接口入参 `PageDataRequest{page, pageSize}`（page 从 1 开始），出参 `PagedResponse`。
3. **接口前缀**：REST 接口统一以 `/v1` 开头，按资源分组：
   - `POST /v1/user/login`（鉴权放行）
   - `/v1/credentials`：`/list`、`/info`、`/add`、`/update/{id}`、`/delete/{id}`
   - `/v1/platforms`：`/list`、`/info`、`/add`、`/update/{id}`、`/delete/{id}`
4. **鉴权**：除 `POST /v1/user/login` 外所有请求需 `Authorization: Bearer {jwt}`；`SessionCreationPolicy.STATELESS`。当前用户来自 `SystemConfiguration.admin`（单管理员，内存认证），登录从 response body 下发 token。未认证返回 `{"code":401,...}`。
5. **软删除 + uuidv7**：实体用 `uuidv7()` 默认主键、`@SQLDelete` 标记删除（写 `deleted_at`）、`@SQLRestriction("deleted_at IS NULL")` 过滤。新实体应沿用同样模式。
6. **异常**：业务错误抛 `BusinessException(code, message)`。
7. **不写测试**：本项目**默认不写测试，尤其不写接口测试**；以**编译通过**作为主要验证手段。
8. **风格一致**：新增代码/文档参考同目录既有文件的风格；前端保持 4 空格缩进。

## 构建与运行

> ⚠️ 沙箱/受限环境下 Gradle 默认 home 可能不可写。HANDOFF 历史中统一使用独立 `GRADLE_USER_HOME` 执行，建议沿用。

### 后端（在 `backend/` 目录下）

```bash
# 编译校验（最常用的验证手段）
env GRADLE_USER_HOME=/private/tmp/masteryyh-gradle ./gradlew compileJava --no-daemon --console=plain

# 完整构建
./gradlew build --no-daemon --console=plain
```

### 前端（仓库根目录，pnpm workspace）

```bash
pnpm --filter frontend dev      # 开发服务器（默认 5173）
pnpm --filter frontend build    # tsc -b && vite build
pnpm --filter frontend lint     # eslint

# 或用根 package.json 脚本
pnpm frontend:dev
pnpm frontend:build
```

前端开发通过 Vite dev proxy 把 `/v1` 转发到 `http://localhost:8080`，**联调时需先启动后端**。

## 本地依赖与配置

- **PostgreSQL**：`application.yaml` 默认连接内网 `truenas.internal.masteryyh.win:5432`，`spring.jpa.hibernate.ddl-auto: create`（**每次启动会重建表，注意数据丢失**）。
- **Redis**：`redisson.yaml` 连接内网 `truenas.internal.masteryyh.win:6379`。
- **环境变量/敏感配置**（部署前务必通过环境变量覆盖默认占位值）：
  - `system.jwt-secret`（至少 32 字符）
  - `system.admin.username` / `password` / `email`
  - 数据源用户名/密码
- **Actuator**：管理端点挂在 `/metrics`（`management.endpoints.web.base-path`）。

## 协作约定

- 仓库根的 **`HANDOFF.md`** 记录每轮任务的目标、完成手段、验证结果与遗留项。**任务结束后**按既有格式把最新条目**插入文件顶部**，便于下一次快速恢复上下文。
- 完成改动后，至少执行后端 `compileJava` 或前端 `build`/`lint` 做最小验证，并如实报告结果。
