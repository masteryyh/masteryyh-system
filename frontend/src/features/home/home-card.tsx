import type { ReactNode } from "react";
import { ArrowRight } from "lucide-react";
import { Link } from "react-router";

export function HomeCard({
    icon,
    index,
    title,
    description,
    to,
}: {
    icon: ReactNode;
    index: string;
    title: string;
    description: string;
    to: string;
}) {
    return (
        <Link
            to={to}
            className="group flex min-h-52 flex-col rounded-xl border bg-card p-5 text-left shadow-sm transition hover:-translate-y-0.5 hover:border-foreground/20 hover:shadow-md focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50 motion-reduce:transform-none"
        >
            <div className="flex w-full items-center justify-between">
                <span className="grid size-10 place-items-center rounded-lg border bg-background text-muted-foreground">
                    {icon}
                </span>
                <span className="font-mono text-xs text-muted-foreground">
                    {index}
                </span>
            </div>
            <h2 className="mt-8 text-xl font-semibold">{title}</h2>
            <p className="mt-2 max-w-md text-sm leading-6 text-muted-foreground">
                {description}
            </p>
            <span className="mt-auto flex items-center gap-2 pt-6 text-sm font-medium">
                打开管理页
                <ArrowRight className="size-4 transition-transform group-hover:translate-x-1 motion-reduce:transform-none" />
            </span>
        </Link>
    );
}
