"use client";

import { PencilIcon, TrashIcon } from "lucide-react";
import { useId, useState } from "react";
import {
  ResponsiveDialog,
  ResponsiveDialogContent,
  ResponsiveDialogHeader,
  ResponsiveDialogTitle,
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
import { Skeleton } from "@/components/ui/skeleton";
import { ApiError } from "@/lib/api-client";
import {
  useCategories,
  useCreateCategory,
  useDeleteCategory,
  useRenameCategory,
} from "../hooks";
import type { Category } from "../types";

export function CategoriesManager() {
  const list = useCategories();
  const createMutation = useCreateCategory();
  const [name, setName] = useState("");
  const [createError, setCreateError] = useState<string | null>(null);
  const [editing, setEditing] = useState<Category | null>(null);
  const [deleting, setDeleting] = useState<Category | null>(null);

  async function handleCreate(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setCreateError(null);
    const trimmed = name.trim();
    if (!trimmed) return;
    try {
      await createMutation.mutateAsync(trimmed);
      setName("");
    } catch (err) {
      setCreateError(
        err instanceof ApiError && err.status === 409
          ? "A category with that name already exists."
          : "Could not create category. Try again.",
      );
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <form
        onSubmit={handleCreate}
        data-testid="category-create-form"
        className="flex flex-col gap-2 sm:flex-row"
      >
        <Input
          aria-label="New category name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="New category"
        />
        <Button type="submit" disabled={createMutation.isPending}>
          {createMutation.isPending ? "Adding…" : "Add category"}
        </Button>
      </form>
      {createError ? (
        <p role="alert" className="text-sm text-destructive">
          {createError}
        </p>
      ) : null}

      {list.isPending ? (
        <ListSkeleton />
      ) : list.isError ? (
        <p role="alert" className="text-sm text-destructive">
          Could not load categories.
        </p>
      ) : list.data.items.length === 0 ? (
        <p
          data-testid="categories-empty"
          className="rounded-md border border-dashed border-border p-6 text-center text-sm text-muted-foreground"
        >
          No categories yet.
        </p>
      ) : (
        <ul
          data-testid="categories-list"
          className="flex flex-col divide-y divide-border rounded-md border border-border"
        >
          {list.data.items.map((cat) => (
            <li
              key={cat.id}
              className="flex items-center justify-between gap-3 p-3"
            >
              <span className="text-sm">{cat.name}</span>
              <div className="flex items-center gap-1">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  aria-label={`Rename ${cat.name}`}
                  onClick={() => setEditing(cat)}
                >
                  <PencilIcon className="size-4" />
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  aria-label={`Delete ${cat.name}`}
                  onClick={() => setDeleting(cat)}
                >
                  <TrashIcon className="size-4" />
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}

      {editing ? (
        <RenameCategoryDialog
          category={editing}
          onClose={() => setEditing(null)}
        />
      ) : null}
      {deleting ? (
        <DeleteCategoryDialog
          category={deleting}
          onClose={() => setDeleting(null)}
        />
      ) : null}
    </div>
  );
}

function RenameCategoryDialog({
  category,
  onClose,
}: {
  category: Category;
  onClose: () => void;
}) {
  const inputId = useId();
  const [name, setName] = useState(category.name);
  const [error, setError] = useState<string | null>(null);
  const mutation = useRenameCategory();

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    const trimmed = name.trim();
    if (!trimmed) return;
    try {
      await mutation.mutateAsync({ id: category.id, name: trimmed });
      onClose();
    } catch (err) {
      setError(
        err instanceof ApiError && err.status === 409
          ? "A category with that name already exists."
          : "Could not rename category. Try again.",
      );
    }
  }

  return (
    <ResponsiveDialog
      open
      onOpenChange={(open) => (!open ? onClose() : undefined)}
    >
      <ResponsiveDialogContent>
        <ResponsiveDialogHeader>
          <ResponsiveDialogTitle>Rename category</ResponsiveDialogTitle>
        </ResponsiveDialogHeader>
        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          <Label htmlFor={inputId}>Name</Label>
          <Input
            id={inputId}
            autoFocus
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
          {error ? (
            <p role="alert" className="text-sm text-destructive">
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

function DeleteCategoryDialog({
  category,
  onClose,
}: {
  category: Category;
  onClose: () => void;
}) {
  const [error, setError] = useState<string | null>(null);
  const mutation = useDeleteCategory();

  async function handleConfirm() {
    setError(null);
    try {
      await mutation.mutateAsync(category.id);
      onClose();
    } catch {
      setError("Could not delete category. Try again.");
    }
  }

  return (
    <Dialog open onOpenChange={(open) => (!open ? onClose() : undefined)}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Delete category?</DialogTitle>
          <DialogDescription>
            Removing "{category.name}" unlinks it from every transaction.
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
      data-testid="categories-loading"
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
