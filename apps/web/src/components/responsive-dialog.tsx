"use client";

import type * as DialogPrimitive from "@radix-ui/react-dialog";
import * as React from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { useIsMobile } from "@/hooks/use-mobile";
import { useScrollFocusedIntoView } from "@/hooks/use-scroll-focused-into-view";
import { useVisualViewportInset } from "@/hooks/use-visual-viewport-inset";
import { cn } from "@/lib/utils";

type RootProps = React.ComponentProps<typeof DialogPrimitive.Root>;

const ResponsiveDialogContext = React.createContext<{ isMobile: boolean }>({
  isMobile: false,
});

function ResponsiveDialog({ children, ...props }: RootProps) {
  const isMobile = useIsMobile();
  const Root = isMobile ? Sheet : Dialog;
  return (
    <ResponsiveDialogContext.Provider value={{ isMobile }}>
      <Root {...props}>{children}</Root>
    </ResponsiveDialogContext.Provider>
  );
}

type ContentProps = React.ComponentProps<typeof DialogPrimitive.Content> & {
  className?: string;
};

function ResponsiveDialogContent({
  className,
  children,
  ...props
}: ContentProps) {
  const { isMobile } = React.useContext(ResponsiveDialogContext);
  if (isMobile) {
    return (
      <MobileSheetContent className={className} {...props}>
        {children}
      </MobileSheetContent>
    );
  }
  return (
    <DialogContent className={className} {...props}>
      {children}
    </DialogContent>
  );
}

function MobileSheetContent({ className, children, ...props }: ContentProps) {
  const inset = useVisualViewportInset();
  const setScrollContainer = useScrollFocusedIntoView();

  return (
    <SheetContent
      side="bottom"
      className={cn(
        "flex max-h-[calc(100dvh-2rem)] flex-col gap-0 rounded-t-lg p-0",
        className,
      )}
      {...props}
    >
      <div
        ref={setScrollContainer}
        data-slot="responsive-dialog-mobile-scroll"
        className="flex flex-col gap-4 overflow-y-auto overscroll-contain p-6"
        style={{
          paddingBottom: `calc(env(safe-area-inset-bottom) + ${inset}px + 1.5rem)`,
        }}
      >
        {children}
      </div>
    </SheetContent>
  );
}

function ResponsiveDialogHeader({
  className,
  ...props
}: React.ComponentProps<"div">) {
  const { isMobile } = React.useContext(ResponsiveDialogContext);
  if (isMobile) {
    return (
      <SheetHeader className={cn("p-0 text-left", className)} {...props} />
    );
  }
  return <DialogHeader className={className} {...props} />;
}

function ResponsiveDialogTitle({
  className,
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Title>) {
  const { isMobile } = React.useContext(ResponsiveDialogContext);
  if (isMobile) {
    return <SheetTitle className={className} {...props} />;
  }
  return <DialogTitle className={className} {...props} />;
}

function ResponsiveDialogDescription({
  className,
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Description>) {
  const { isMobile } = React.useContext(ResponsiveDialogContext);
  if (isMobile) {
    return <SheetDescription className={className} {...props} />;
  }
  return <DialogDescription className={className} {...props} />;
}

export {
  ResponsiveDialog,
  ResponsiveDialogContent,
  ResponsiveDialogDescription,
  ResponsiveDialogHeader,
  ResponsiveDialogTitle,
};
