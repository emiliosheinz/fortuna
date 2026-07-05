"use client";

import { PencilIcon, TrashIcon } from "lucide-react";
import { useId, useRef, useState } from "react";
import { flushSync } from "react-dom";
import {
  ResponsiveDialog,
  ResponsiveDialogContent,
  ResponsiveDialogHeader,
  ResponsiveDialogTitle,
  useResponsiveDialogScrollIntoView,
} from "@/components/responsive-dialog";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Skeleton } from "@/components/ui/skeleton";
import { ApiError } from "@/lib/api-client";
import { useCreateTag, useDeleteTag, useTags, useUpdateTag } from "../hooks";
import { PALETTE_KEYS } from "../tag-colors";
import type { PaletteKey, Tag } from "../types";
import { TagColorDot } from "./tag-color-dot";

export function TagsManager() {
  const list = useTags();
  const createMutation = useCreateTag();
  const [name, setName] = useState("");
  const [createError, setCreateError] = useState<string | null>(null);
  const [editing, setEditing] = useState<Tag | null>(null);
  const [deleting, setDeleting] = useState<Tag | null>(null);
  const createErrorRef = useRef<HTMLParagraphElement | null>(null);
  const scrollIntoView = useResponsiveDialogScrollIntoView();

  async function handleCreate(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setCreateError(null);
    const trimmed = name.trim();
    if (!trimmed) return;
    try {
      await createMutation.mutateAsync(trimmed);
      setName("");
    } catch (err) {
      const message =
        err instanceof ApiError && err.status === 409
          ? "A tag with that name already exists."
          : "Could not create tag. Try again.";
      flushSync(() => setCreateError(message));
      scrollIntoView(createErrorRef.current);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <form
        onSubmit={handleCreate}
        data-testid="tag-create-form"
        className="flex flex-col gap-2 sm:flex-row"
      >
        <Input
          aria-label="New tag name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="New tag"
        />
        <Button type="submit" disabled={createMutation.isPending}>
          {createMutation.isPending ? "Adding…" : "Add tag"}
        </Button>
      </form>
      {createError ? (
        <p
          ref={createErrorRef}
          role="alert"
          className="text-sm text-destructive"
        >
          {createError}
        </p>
      ) : null}

      {list.isPending ? (
        <ListSkeleton />
      ) : list.isError ? (
        <p role="alert" className="text-sm text-destructive">
          Could not load tags.
        </p>
      ) : list.data.items.length === 0 ? (
        <p
          data-testid="tags-empty"
          className="rounded-md border border-dashed border-border p-6 text-center text-sm text-muted-foreground"
        >
          No tags yet.
        </p>
      ) : (
        <ul
          data-testid="tags-list"
          className="flex flex-col divide-y divide-border rounded-md border border-border"
        >
          {list.data.items.map((tag) => (
            <li
              key={tag.id}
              className="flex items-center justify-between gap-3 p-3"
            >
              <span className="flex items-center gap-2 text-sm">
                <TagColorDot color={tag.color} />
                {tag.name}
              </span>
              <div className="flex items-center gap-1">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  aria-label={`Edit ${tag.name}`}
                  onClick={() => setEditing(tag)}
                >
                  <PencilIcon className="size-4" />
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  aria-label={`Delete ${tag.name}`}
                  onClick={() => setDeleting(tag)}
                >
                  <TrashIcon className="size-4" />
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}

      {editing ? (
        <EditTagDialog tag={editing} onClose={() => setEditing(null)} />
      ) : null}
      {deleting ? (
        <DeleteTagDialog tag={deleting} onClose={() => setDeleting(null)} />
      ) : null}
    </div>
  );
}

function EditTagDialog({ tag, onClose }: { tag: Tag; onClose: () => void }) {
  const inputId = useId();
  const [name, setName] = useState(tag.name);
  const [color, setColor] = useState<PaletteKey>(tag.color);
  const [error, setError] = useState<string | null>(null);
  const errorRef = useRef<HTMLParagraphElement | null>(null);
  const scrollIntoView = useResponsiveDialogScrollIntoView();
  const mutation = useUpdateTag();

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    const trimmed = name.trim();
    if (!trimmed) return;
    const patch: { name?: string; color?: PaletteKey } = {};
    if (trimmed !== tag.name) patch.name = trimmed;
    if (color !== tag.color) patch.color = color;
    if (patch.name === undefined && patch.color === undefined) {
      onClose();
      return;
    }
    try {
      await mutation.mutateAsync({ id: tag.id, input: patch });
      onClose();
    } catch (err) {
      const message =
        err instanceof ApiError && err.status === 409
          ? "A tag with that name already exists."
          : "Could not save the tag. Try again.";
      flushSync(() => setError(message));
      scrollIntoView(errorRef.current);
    }
  }

  return (
    <ResponsiveDialog
      open
      onOpenChange={(open) => (!open ? onClose() : undefined)}
    >
      <ResponsiveDialogContent>
        <ResponsiveDialogHeader>
          <ResponsiveDialogTitle>Edit tag</ResponsiveDialogTitle>
        </ResponsiveDialogHeader>
        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          <div className="flex items-end gap-2">
            <Popover>
              <PopoverTrigger asChild>
                <button
                  type="button"
                  aria-label={`Color: ${color}`}
                  data-testid="tag-color-picker-trigger"
                  data-color={color}
                  className="inline-flex size-9 shrink-0 items-center justify-center rounded-md border border-border bg-background hover:bg-accent/40"
                >
                  <TagColorDot color={color} />
                </button>
              </PopoverTrigger>
              <PopoverContent
                align="start"
                className="w-auto p-2"
                data-testid="tag-color-picker"
              >
                <div
                  role="radiogroup"
                  aria-label="Tag color"
                  className="grid grid-cols-5 gap-1"
                >
                  {PALETTE_KEYS.map((key) => (
                    // biome-ignore lint/a11y/useSemanticElements: radiogroup of styled swatches; <input type="radio"> would leak the native circle and lose the color affordance
                    <button
                      key={key}
                      type="button"
                      role="radio"
                      aria-checked={color === key}
                      aria-label={`Color ${key}`}
                      data-testid={`tag-color-swatch-${key}`}
                      data-selected={color === key ? "true" : undefined}
                      onClick={() => setColor(key)}
                      className={
                        color === key
                          ? "flex size-7 items-center justify-center rounded-full border-2 border-foreground"
                          : "flex size-7 items-center justify-center rounded-full border-2 border-transparent hover:border-border"
                      }
                    >
                      <TagColorDot color={key} />
                    </button>
                  ))}
                </div>
              </PopoverContent>
            </Popover>
            <div className="flex flex-1 flex-col gap-1">
              <Label htmlFor={inputId}>Name</Label>
              <Input
                id={inputId}
                autoFocus
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </div>
          </div>
          {error ? (
            <p ref={errorRef} role="alert" className="text-sm text-destructive">
              {error}
            </p>
          ) : null}
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={mutation.isPending}>
              {mutation.isPending ? "Saving…" : "Save"}
            </Button>
          </DialogFooter>
        </form>
      </ResponsiveDialogContent>
    </ResponsiveDialog>
  );
}

function DeleteTagDialog({ tag, onClose }: { tag: Tag; onClose: () => void }) {
  const [error, setError] = useState<string | null>(null);
  const mutation = useDeleteTag();

  async function handleConfirm() {
    setError(null);
    try {
      await mutation.mutateAsync(tag.id);
      onClose();
    } catch {
      setError("Could not delete tag. Try again.");
    }
  }

  return (
    <Dialog open onOpenChange={(open) => (!open ? onClose() : undefined)}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Delete tag?</DialogTitle>
          <DialogDescription>
            Removing "{tag.name}" detaches it from every transaction.
            Transactions themselves are not deleted.
          </DialogDescription>
        </DialogHeader>
        {error ? (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        ) : null}
        <DialogFooter>
          <Button type="button" variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button
            type="button"
            variant="destructive"
            disabled={mutation.isPending}
            onClick={handleConfirm}
          >
            {mutation.isPending ? "Deleting…" : "Delete"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ListSkeleton() {
  return (
    <div
      data-testid="tags-loading"
      className="flex flex-col divide-y divide-border rounded-md border border-border"
    >
      {[0, 1, 2].map((i) => (
        <div key={i} className="flex items-center justify-between p-3">
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-6 w-16" />
        </div>
      ))}
    </div>
  );
}
