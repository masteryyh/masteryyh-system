import { useEffect, useState } from "react";

/**
 * 监听 <html> 的 class 变化，自动在 masteryyh-light / masteryyh-dark 主题间切换。
 * 当前项目没有显式 dark 切换 UI，但保留这一钩子，未来切换时无需改动调用方。
 */
export function useMonacoTheme(): "masteryyh-light" | "masteryyh-dark" {
    const [theme, setTheme] = useState<"masteryyh-light" | "masteryyh-dark">(() =>
        typeof document !== "undefined" &&
        document.documentElement.classList.contains("dark")
            ? "masteryyh-dark"
            : "masteryyh-light",
    );

    useEffect(() => {
        if (typeof document === "undefined") return;
        const observer = new MutationObserver(() => {
            setTheme(
                document.documentElement.classList.contains("dark")
                    ? "masteryyh-dark"
                    : "masteryyh-light",
            );
        });
        observer.observe(document.documentElement, {
            attributes: true,
            attributeFilter: ["class"],
        });
        return () => observer.disconnect();
    }, []);

    return theme;
}
