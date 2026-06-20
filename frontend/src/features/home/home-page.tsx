import { KeyRound, Server } from "lucide-react";

import { HomeCard } from "@/features/home/home-card";
import { useSession } from "@/hooks/use-session";

export function HomePage() {
    const { session } = useSession();

    return (
        <div className="space-y-8">
            <header className="border-b pb-7">
                <p className="font-mono text-[0.68rem] font-semibold tracking-[0.18em] text-muted-foreground uppercase">
                    Homelab inventory
                </p>
                <h1 className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">
                    欢迎回来，{session?.username}
                </h1>
                <p className="mt-3 max-w-2xl text-sm leading-6 text-muted-foreground">
                    从安全访问材料到目标运行环境，这里是 homelab 管理能力持续生长的起点。
                </p>
            </header>

            <div className="grid gap-4 md:grid-cols-2">
                <HomeCard
                    icon={<KeyRound className="size-5" />}
                    index="01"
                    title="凭证管理"
                    description="保管 SSH 密钥与文本密码，并核对公钥算法、长度和 SHA-256 指纹。"
                    to="/credentials"
                />
                <HomeCard
                    icon={<Server className="size-5" />}
                    index="02"
                    title="App Platform"
                    description="连接 Docker daemon 或 SYSTEMD 主机，查看平台的实时就绪状态。"
                    to="/platforms"
                />
            </div>
        </div>
    );
}
