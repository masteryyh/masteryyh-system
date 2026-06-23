/**
 * Monaco Editor 全局初始化：
 * - 注册 Vite 提供的全部 workers，避免运行时回退到 CDN。
 * - 把本地 monaco-editor 注入 @monaco-editor/react 的 loader，让所有 <Editor /> 共用同一实例。
 * - 注册一个轻量 PEM 语言（高亮 BEGIN / END 块与 base64 主体），供证书与 SSH 密钥使用。
 * - 定义 masteryyh-light / masteryyh-dark 两套主题，与项目 oklch 调色板对齐。
 */
import { loader } from "@monaco-editor/react";
import * as monaco from "monaco-editor";
import editorWorker from "monaco-editor/esm/vs/editor/editor.worker?worker";
import jsonWorker from "monaco-editor/esm/vs/language/json/json.worker?worker";
import cssWorker from "monaco-editor/esm/vs/language/css/css.worker?worker";
import htmlWorker from "monaco-editor/esm/vs/language/html/html.worker?worker";
import tsWorker from "monaco-editor/esm/vs/language/typescript/ts.worker?worker";

declare global {
    interface Window {
        MonacoEnvironment?: monaco.Environment;
    }
}

self.MonacoEnvironment = {
    getWorker(_workerId, label) {
        switch (label) {
            case "json":
                return new jsonWorker();
            case "css":
            case "scss":
            case "less":
                return new cssWorker();
            case "html":
            case "handlebars":
            case "razor":
                return new htmlWorker();
            case "typescript":
            case "javascript":
                return new tsWorker();
            default:
                return new editorWorker();
        }
    },
};

const PEM_LANGUAGE_ID = "pem";
if (!monaco.languages.getLanguages().some((lang) => lang.id === PEM_LANGUAGE_ID)) {
    monaco.languages.register({
        id: PEM_LANGUAGE_ID,
        extensions: [".pem", ".crt", ".cer", ".key", ".pub"],
        aliases: ["PEM", "pem"],
    });
    monaco.languages.setMonarchTokensProvider(PEM_LANGUAGE_ID, {
        defaultToken: "",
        tokenizer: {
            root: [
                [
                    /-----BEGIN [A-Z0-9 ]+-----/,
                    { token: "keyword.pem-block", next: "@body" },
                ],
                [/ssh-(?:rsa|ed25519|dss)/, "keyword.ssh-type"],
                [/ecdsa-sha2-nistp(?:256|384|521)/, "keyword.ssh-type"],
                [/[\w+/=]{20,}/, "string.base64"],
                [/[^-]+/, ""],
            ],
            body: [
                [
                    /-----END [A-Z0-9 ]+-----/,
                    { token: "keyword.pem-block", next: "@pop" },
                ],
                [/[A-Za-z0-9+/=]+/, "string.base64"],
                [/[^-]+/, ""],
            ],
        },
    });
}

monaco.editor.defineTheme("masteryyh-light", {
    base: "vs",
    inherit: true,
    rules: [
        { token: "keyword.pem-block", foreground: "7C3AED", fontStyle: "bold" },
        { token: "keyword.ssh-type", foreground: "7C3AED", fontStyle: "bold" },
        { token: "string.base64", foreground: "1F2937" },
    ],
    colors: {
        "editor.background": "#FAFAFA",
        "editor.foreground": "#171717",
        "editorLineNumber.foreground": "#9CA3AF",
        "editorLineNumber.activeForeground": "#4B5563",
        "editor.lineHighlightBackground": "#F1F1F1",
        "editor.selectionBackground": "#D1D5DB80",
        "editorCursor.foreground": "#171717",
        "editorIndentGuide.background1": "#E5E5E5",
        "editorIndentGuide.activeBackground1": "#D4D4D4",
        "editorWidget.background": "#FFFFFF",
        "editorWidget.border": "#E5E5E5",
        "editor.findMatchBackground": "#FCD34D80",
        "editor.findMatchHighlightBackground": "#FCD34D40",
    },
});

monaco.editor.defineTheme("masteryyh-dark", {
    base: "vs-dark",
    inherit: true,
    rules: [
        { token: "keyword.pem-block", foreground: "C4B5FD", fontStyle: "bold" },
        { token: "keyword.ssh-type", foreground: "C4B5FD", fontStyle: "bold" },
        { token: "string.base64", foreground: "E5E5E5" },
    ],
    colors: {
        "editor.background": "#1F1F1F",
        "editor.foreground": "#FAFAFA",
        "editorLineNumber.foreground": "#6B7280",
        "editorLineNumber.activeForeground": "#D1D5DB",
        "editor.lineHighlightBackground": "#2A2A2A",
        "editor.selectionBackground": "#4B556380",
        "editorCursor.foreground": "#FAFAFA",
        "editorIndentGuide.background1": "#404040",
        "editorIndentGuide.activeBackground1": "#525252",
    },
});

loader.config({ monaco });
void loader.init();

export { monaco };
export const PEM_LANGUAGE = PEM_LANGUAGE_ID;
