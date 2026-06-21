import { Component, type ErrorInfo, type ReactNode } from "react";

import { useTranslation } from "@/hooks/use-translation";
import { Button } from "@/components/ui/button";

interface ErrorBoundaryProps {
    children: ReactNode;
}

interface ErrorBoundaryState {
    error: Error | null;
}

/**
 * 全局兜底：组件树渲染中抛出未捕获错误时显示通用错误页，避免白屏。
 * 真正的「业务错误」请走 {@code useNotify} + inline banner；这里只接住开发期 bug。
 */
export class ErrorBoundary extends Component<
    ErrorBoundaryProps,
    ErrorBoundaryState
> {
    state: ErrorBoundaryState = { error: null };

    static getDerivedStateFromError(error: Error): ErrorBoundaryState {
        return { error };
    }

    componentDidCatch(error: Error, info: ErrorInfo) {
        // 留作以后接入上报；当前阶段仅 console，避免 toast 在错误页里再次 render
        console.error("ErrorBoundary caught", error, info);
    }

    private reset = () => {
        this.setState({ error: null });
    };

    render() {
        if (this.state.error) {
            return <ErrorBoundaryFallback onReset={this.reset} />;
        }
        return this.props.children;
    }
}

function ErrorBoundaryFallback({ onReset }: { onReset: () => void }) {
    const { t } = useTranslation();
    return (
        <main className="grid min-h-screen place-items-center bg-background px-6">
            <div className="max-w-md text-center">
                <p className="font-mono text-[0.68rem] font-semibold tracking-[0.18em] text-muted-foreground uppercase">
                    {t("app.headlineEyebrow")}
                </p>
                <h1 className="mt-3 text-2xl font-semibold tracking-tight">
                    {t("error.boundary.title")}
                </h1>
                <p className="mt-3 text-sm leading-6 text-muted-foreground">
                    {t("error.boundary.description")}
                </p>
                <Button
                    type="button"
                    className="mt-6"
                    onClick={() => {
                        onReset();
                        if (typeof window !== "undefined") {
                            window.location.reload();
                        }
                    }}
                >
                    {t("error.boundary.retry")}
                </Button>
            </div>
        </main>
    );
}
