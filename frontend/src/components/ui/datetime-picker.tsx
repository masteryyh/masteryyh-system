"use client";

import * as React from "react";
import { CalendarIcon, ChevronDownIcon, ChevronUpIcon, XIcon } from "lucide-react";
import { format } from "date-fns";

import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "@/components/ui/popover";
import { useTranslation } from "@/hooks/use-translation";
import { cn } from "@/lib/utils";

export interface DateTimePickerProps {
    /** 当前值，null 表示未选择。 */
    value: Date | null;
    /** 受控变更回调。 */
    onChange: (next: Date | null) => void;
    /** 触发按钮 placeholder 文案；缺省时使用 i18n `datetimePicker.placeholder`。 */
    placeholder?: string;
    /** 是否允许清除当前值，缺省 true。 */
    clearable?: boolean;
    /** input id（便于 Label 关联）。 */
    id?: string;
    disabled?: boolean;
    /** 触发按钮宽度容器 className。 */
    className?: string;
}

/**
 * 日期 + 时间选择器，基于 react-day-picker。
 *
 * 交互：
 * - 选择日期立即提交（保留已设置的时分）。
 * - 时分变更立即提交。
 * - "现在" 写入当前时间，"清除" 重置为 null。
 * - 触发按钮自带 X 清除按钮（当 value !== null 且 clearable）。
 */
export function DateTimePicker({
    value,
    onChange,
    placeholder,
    clearable = true,
    id,
    disabled = false,
    className,
}: DateTimePickerProps) {
    const { t } = useTranslation();
    const [open, setOpen] = React.useState(false);

    const display = value ? format(value, "yyyy-MM-dd HH:mm") : "";
    const placeholderText = placeholder ?? t("datetimePicker.placeholder");

    function commit(date: Date | null) {
        onChange(date);
    }

    function pickDate(date: Date | undefined) {
        if (!date) return;
        // 用 react-day-picker 给的日期 + 既有时分。当 value 为空时默认 09:00。
        const merged = new Date(date);
        if (value) {
            merged.setHours(value.getHours());
            merged.setMinutes(value.getMinutes());
        } else {
            merged.setHours(9);
            merged.setMinutes(0);
        }
        merged.setSeconds(0);
        merged.setMilliseconds(0);
        commit(merged);
    }

    function changeHours(hh: number) {
        const base = value ?? new Date();
        const next = new Date(base);
        next.setHours(((hh % 24) + 24) % 24);
        next.setSeconds(0);
        next.setMilliseconds(0);
        commit(next);
    }

    function changeMinutes(mm: number) {
        const base = value ?? new Date();
        const next = new Date(base);
        next.setMinutes(((mm % 60) + 60) % 60);
        next.setSeconds(0);
        next.setMilliseconds(0);
        commit(next);
    }

    function applyNow() {
        const now = new Date();
        now.setSeconds(0);
        now.setMilliseconds(0);
        commit(now);
    }

    function clear() {
        commit(null);
    }

    return (
        <div className={cn("relative", className)}>
            <Popover open={open} onOpenChange={setOpen}>
                <PopoverTrigger asChild>
                    <button
                        type="button"
                        id={id}
                        disabled={disabled}
                        aria-label={placeholderText}
                        className={cn(
                            "flex h-8 w-full items-center gap-2 rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none transition-colors",
                            "hover:border-ring/60",
                            "focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50",
                            "disabled:cursor-not-allowed disabled:opacity-50",
                            value ? "pr-8" : "",
                        )}
                    >
                        <CalendarIcon className="size-3.5 shrink-0 text-muted-foreground" />
                        {value ? (
                            <span className="truncate font-mono text-xs">
                                {display}
                            </span>
                        ) : (
                            <span className="truncate text-muted-foreground">
                                {placeholderText}
                            </span>
                        )}
                    </button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                    <div className="p-2.5">
                        <Calendar
                            mode="single"
                            selected={value ?? undefined}
                            onSelect={pickDate}
                            defaultMonth={value ?? new Date()}
                        />
                    </div>
                    <div className="border-t px-3 py-2.5">
                        <p className="mb-2 text-[0.62rem] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                            {t("datetimePicker.time")}
                        </p>
                        <div className="flex items-center justify-center gap-1.5 font-mono">
                            <TimeStepper
                                ariaLabel={t("datetimePicker.hours")}
                                value={value ? value.getHours() : 9}
                                max={23}
                                onChange={changeHours}
                            />
                            <span className="text-base text-muted-foreground">
                                :
                            </span>
                            <TimeStepper
                                ariaLabel={t("datetimePicker.minutes")}
                                value={value ? value.getMinutes() : 0}
                                max={59}
                                onChange={changeMinutes}
                            />
                        </div>
                    </div>
                    <div className="flex items-center justify-between gap-2 border-t bg-muted/25 px-3 py-2">
                        <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={applyNow}
                        >
                            {t("datetimePicker.now")}
                        </Button>
                        <div className="flex items-center gap-1">
                            {clearable && value ? (
                                <Button
                                    type="button"
                                    variant="ghost"
                                    size="sm"
                                    onClick={clear}
                                >
                                    {t("datetimePicker.clear")}
                                </Button>
                            ) : null}
                            <Button
                                type="button"
                                size="sm"
                                onClick={() => setOpen(false)}
                            >
                                {t("datetimePicker.done")}
                            </Button>
                        </div>
                    </div>
                </PopoverContent>
            </Popover>
            {clearable && value && !disabled ? (
                <button
                    type="button"
                    aria-label={t("datetimePicker.clear")}
                    className="absolute top-1/2 right-2 -translate-y-1/2 rounded p-0.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                    onClick={(event) => {
                        event.preventDefault();
                        event.stopPropagation();
                        clear();
                    }}
                >
                    <XIcon className="size-3.5" />
                </button>
            ) : null}
        </div>
    );
}

function TimeStepper({
    value,
    max,
    onChange,
    ariaLabel,
}: {
    value: number;
    max: number;
    onChange: (next: number) => void;
    ariaLabel: string;
}) {
    function clamp(input: number): number {
        if (Number.isNaN(input)) return 0;
        if (input < 0) return max;
        if (input > max) return 0;
        return input;
    }

    return (
        <div className="flex items-center">
            <button
                type="button"
                aria-label={`${ariaLabel} -`}
                className="grid size-6 place-items-center rounded text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                onClick={() => onChange(clamp(value - 1))}
            >
                <ChevronDownIcon className="size-3.5" />
            </button>
            <input
                aria-label={ariaLabel}
                type="text"
                inputMode="numeric"
                pattern="\d*"
                value={value.toString().padStart(2, "0")}
                className="h-7 w-10 rounded border-0 bg-transparent text-center text-sm font-medium tabular-nums outline-none focus-visible:bg-muted"
                onChange={(event) => {
                    const next = parseInt(event.target.value, 10);
                    if (Number.isNaN(next)) return;
                    onChange(Math.max(0, Math.min(max, next)));
                }}
            />
            <button
                type="button"
                aria-label={`${ariaLabel} +`}
                className="grid size-6 place-items-center rounded text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                onClick={() => onChange(clamp(value + 1))}
            >
                <ChevronUpIcon className="size-3.5" />
            </button>
        </div>
    );
}
