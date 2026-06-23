"use client";

import * as React from "react";
import { ChevronLeftIcon, ChevronRightIcon } from "lucide-react";
import { DayPicker } from "react-day-picker";

import { cn } from "@/lib/utils";

/**
 * 项目风格的 react-day-picker 包装。所有视觉决策都通过 classNames 注入，
 * 不依赖 react-day-picker 自带 CSS。
 *
 * 视觉：紧凑日历，方形格子，单选高亮使用 primary，hover/今日使用 muted。
 * 与 DropdownMenu / Dialog 等组件保持同一视觉语言。
 */
export type CalendarProps = React.ComponentProps<typeof DayPicker>;

function Calendar({
    className,
    classNames,
    showOutsideDays = true,
    ...props
}: CalendarProps) {
    return (
        <DayPicker
            showOutsideDays={showOutsideDays}
            className={cn("text-sm", className)}
            classNames={{
                root: "select-none",
                months: "flex flex-col gap-2",
                month: "space-y-2",
                month_caption: "flex items-center justify-center h-8",
                caption_label:
                    "text-[0.78rem] font-semibold tracking-wide uppercase text-foreground",
                nav: "flex items-center justify-between px-1 absolute inset-x-1 top-0 h-8",
                button_previous: cn(
                    "size-7 inline-flex items-center justify-center rounded-md border bg-background text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                ),
                button_next: cn(
                    "size-7 inline-flex items-center justify-center rounded-md border bg-background text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                ),
                month_grid: "w-full border-collapse",
                weekdays: "flex",
                weekday:
                    "flex-1 text-[0.62rem] font-medium uppercase tracking-wide text-muted-foreground h-7 grid place-items-center",
                weeks: "flex flex-col gap-0.5",
                week: "flex w-full",
                day: "flex-1 p-0 text-center",
                day_button: cn(
                    "size-8 mx-auto inline-flex items-center justify-center rounded-md text-xs font-medium tabular-nums",
                    "transition-colors hover:bg-muted hover:text-foreground",
                    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                    "aria-selected:bg-primary aria-selected:text-primary-foreground aria-selected:hover:bg-primary aria-selected:hover:text-primary-foreground",
                ),
                today: "[&_button]:bg-muted [&_button]:text-foreground [&_button[aria-selected=true]]:bg-primary [&_button[aria-selected=true]]:text-primary-foreground",
                outside:
                    "text-muted-foreground/40 [&_button]:text-muted-foreground/40 aria-selected:[&_button]:text-primary-foreground",
                disabled: "[&_button]:text-muted-foreground/30 [&_button]:cursor-not-allowed [&_button]:hover:bg-transparent",
                hidden: "invisible",
                ...classNames,
            }}
            components={{
                Chevron: ({ orientation, ...rest }) =>
                    orientation === "left" ? (
                        <ChevronLeftIcon className="size-4" {...rest} />
                    ) : (
                        <ChevronRightIcon className="size-4" {...rest} />
                    ),
            }}
            {...props}
        />
    );
}

export { Calendar };
