import { useCallback, useEffect, useRef, useState } from "react";
import { Editor, type OnMount } from "@monaco-editor/react";
import { Eraser, Upload } from "lucide-react";

import { Button } from "@/components/ui/button";
import { useTranslation } from "@/hooks/use-translation";
import { cn } from "@/lib/utils";

import "@/lib/monaco-setup";

type CodeEditorLanguage = "pem" | "plaintext";

export interface CodeEditorProps {
    id?: string;
    value: string;
    onChange: (value: string) => void;
    language?: CodeEditorLanguage;
    placeholder?: string;
    height?: number | string;
    readOnly?: boolean;
    accept?: string;
    onUploadError?: (message: string) => void;
    className?: string;
}

/**
 * 监听 <html> 的 class 变化，自动在 masteryyh-light / masteryyh-dark 主题间切换。
 * 当前项目没有显式 dark 切换 UI，但保留这一钩子，未来切换时无需改动调用方。
 */
function useThemeMode(): "masteryyh-light" | "masteryyh-dark" {
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

/**
 * Monaco 编辑器的轻量封装：在外层套上与现有 textarea 一致的边框 / focus ring，
 * 顶端提供「上传文件」与「清空」工具按钮，底端显示字符数。
 * 文件读取在浏览器侧完成，仅文本写入编辑器，不会上传到服务器。
 */
export function CodeEditor({
    id,
    value,
    onChange,
    language = "plaintext",
    placeholder,
    height = 220,
    readOnly = false,
    accept,
    onUploadError,
    className,
}: CodeEditorProps) {
    const { t } = useTranslation();
    const theme = useThemeMode();
    const fileInputRef = useRef<HTMLInputElement>(null);
    const wrapperRef = useRef<HTMLDivElement>(null);
    const [focused, setFocused] = useState(false);

    const handleMount = useCallback<OnMount>((editor) => {
        editor.onDidFocusEditorWidget(() => setFocused(true));
        editor.onDidBlurEditorWidget(() => setFocused(false));
    }, []);

    function pickFile() {
        fileInputRef.current?.click();
    }

    async function handleFile(event: React.ChangeEvent<HTMLInputElement>) {
        const file = event.target.files?.[0];
        event.target.value = "";
        if (!file) return;

        const maxBytes = 1024 * 1024; // 1 MiB 足以容纳证书 / 私钥 / 完整 known_hosts
        if (file.size > maxBytes) {
            onUploadError?.(t("editor.uploadTooLarge"));
            return;
        }

        try {
            const text = await file.text();
            onChange(text);
        } catch {
            onUploadError?.(t("editor.uploadFailed"));
        }
    }

    return (
        <div
            ref={wrapperRef}
            className={cn(
                "rounded-lg border border-input bg-transparent transition-colors",
                focused &&
                    "border-ring ring-3 ring-ring/50",
                className,
            )}
        >
            <div className="flex items-center justify-between gap-2 border-b border-border/60 px-2 py-1.5">
                <div className="flex items-center gap-1">
                    <Button
                        type="button"
                        variant="ghost"
                        size="xs"
                        onClick={pickFile}
                        disabled={readOnly}
                    >
                        <Upload className="size-3.5" />
                        {t("editor.uploadFile")}
                    </Button>
                    <Button
                        type="button"
                        variant="ghost"
                        size="xs"
                        onClick={() => onChange("")}
                        disabled={readOnly || !value}
                    >
                        <Eraser className="size-3.5" />
                        {t("editor.clear")}
                    </Button>
                </div>
                <span className="font-mono text-[10px] text-muted-foreground">
                    {t("editor.charCount", { count: value.length })}
                </span>
            </div>
            <div style={{ height }} className="overflow-hidden rounded-b-lg">
                <Editor
                    height="100%"
                    language={language}
                    theme={theme}
                    value={value}
                    onChange={(next) => onChange(next ?? "")}
                    onMount={handleMount}
                    options={Object.assign(
                        {
                            readOnly,
                            minimap: { enabled: false },
                            scrollBeyondLastLine: false,
                            fontSize: 12,
                            fontFamily:
                                'ui-monospace, SFMono-Regular, "SF Mono", Menlo, Monaco, Consolas, monospace',
                            lineNumbers: "on" as const,
                            lineNumbersMinChars: 3,
                            glyphMargin: false,
                            folding: false,
                            renderLineHighlight: "line" as const,
                            scrollbar: {
                                verticalScrollbarSize: 8,
                                horizontalScrollbarSize: 8,
                            },
                            wordWrap: "on" as const,
                            wrappingStrategy: "advanced" as const,
                            automaticLayout: true,
                            contextmenu: false,
                            padding: { top: 8, bottom: 8 },
                        },
                        placeholder ? { placeholder } : {},
                    )}
                />
            </div>
            <input
                ref={fileInputRef}
                id={id ? `${id}-upload` : undefined}
                type="file"
                accept={accept}
                className="hidden"
                onChange={handleFile}
            />
        </div>
    );
}
