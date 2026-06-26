import { Files, KeyRound, Network, Server } from "lucide-react";

import { HomeCard } from "@/features/home/home-card";
import { useSession } from "@/hooks/use-session";
import { useTranslation } from "@/hooks/use-translation";

export function HomePage() {
    const { session } = useSession();
    const { t } = useTranslation();

    return (
        <div className="space-y-8">
            <header className="border-b pb-7">
                <p className="font-mono text-[0.68rem] font-semibold tracking-[0.18em] text-muted-foreground uppercase">
                    {t("home.eyebrow")}
                </p>
                <h1 className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">
                    {t("home.title", {
                        username: session?.username ?? "",
                    })}
                </h1>
                <p className="mt-3 max-w-2xl text-sm leading-6 text-muted-foreground">
                    {t("home.description")}
                </p>
            </header>

            <div className="grid gap-4 md:grid-cols-2">
                <HomeCard
                    icon={<KeyRound className="size-5" />}
                    index="01"
                    title={t("home.cards.credentials.title")}
                    description={t("home.cards.credentials.description")}
                    to="/credentials"
                />
                <HomeCard
                    icon={<Server className="size-5" />}
                    index="02"
                    title={t("home.cards.platforms.title")}
                    description={t("home.cards.platforms.description")}
                    to="/platforms"
                />
                <HomeCard
                    icon={<Network className="size-5" />}
                    index="03"
                    title={t("home.cards.gateways.title")}
                    description={t("home.cards.gateways.description")}
                    to="/gateways"
                />
                <HomeCard
                    icon={<Files className="size-5" />}
                    index="04"
                    title={t("home.cards.files.title")}
                    description={t("home.cards.files.description")}
                    to="/files"
                />
            </div>
        </div>
    );
}
