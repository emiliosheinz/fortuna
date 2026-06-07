"use client";

import { ChevronLeftIcon, ChevronRightIcon } from "lucide-react";
import type * as React from "react";
import { DayPicker } from "react-day-picker";

import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

function Calendar({
  className,
  classNames,
  showOutsideDays = true,
  ...props
}: React.ComponentProps<typeof DayPicker>) {
  return (
    <DayPicker
      showOutsideDays={showOutsideDays}
      fixedWeeks
      navLayout="around"
      className={cn("p-3", className)}
      classNames={{
        months: "flex flex-col sm:flex-row gap-2",
        month: "relative flex flex-col gap-4",
        month_caption: "flex h-7 items-center justify-center",
        caption_label: "text-sm font-medium",
        nav: "contents",
        button_previous: cn(
          buttonVariants({ variant: "outline" }),
          "absolute left-1 top-0 size-7 bg-transparent p-0 opacity-50 hover:opacity-100",
        ),
        button_next: cn(
          buttonVariants({ variant: "outline" }),
          "absolute right-1 top-0 size-7 bg-transparent p-0 opacity-50 hover:opacity-100",
        ),
        month_grid: "w-full border-collapse",
        weekdays: "flex",
        weekday:
          "text-muted-foreground rounded-md size-10 font-normal text-[0.8rem] inline-flex items-center justify-center",
        week: "flex w-full mt-1",
        day: cn(
          "relative p-0 text-center text-sm focus-within:relative focus-within:z-20",
          "data-[today=true]:[&>button]:bg-accent data-[today=true]:[&>button]:text-accent-foreground",
          "data-[selected=true]:[&>button]:bg-primary data-[selected=true]:[&>button]:text-primary-foreground data-[selected=true]:[&>button]:hover:bg-primary data-[selected=true]:[&>button]:hover:text-primary-foreground data-[selected=true]:[&>button]:focus:bg-primary data-[selected=true]:[&>button]:focus:text-primary-foreground",
        ),
        day_button: cn(
          "size-10 p-0 font-normal hover:bg-accent hover:text-accent-foreground rounded-md inline-flex items-center justify-center",
        ),
        outside: "text-muted-foreground",
        disabled: "text-muted-foreground opacity-50",
        hidden: "invisible",
        ...classNames,
      }}
      components={{
        Chevron: ({ orientation }) =>
          orientation === "left" ? (
            <ChevronLeftIcon className="size-4" />
          ) : (
            <ChevronRightIcon className="size-4" />
          ),
      }}
      {...props}
    />
  );
}

export { Calendar };
