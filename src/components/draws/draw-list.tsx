"use client";

import { useState } from "react";
import { type ColumnDef } from "@tanstack/react-table";
import { DataTable } from "@/components/shared/data-table";
import { StatusBadge } from "@/components/shared/status-badge";
import { CurrencyDisplay } from "@/components/shared/currency-display";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { DrawForm } from "@/components/draws/draw-form";
import { DrawDetail } from "@/components/draws/draw-detail";
import { useToast } from "@/components/ui/toast";
import { Plus, ChevronDown, ChevronRight, Trash2 } from "lucide-react";
import { formatDate } from "@/lib/utils";
import { useAuth } from "@/hooks/use-auth";
import type { DrawRequestWithLineItems } from "@/types";

interface DrawListProps {
  projectId: string;
  draws: DrawRequestWithLineItems[];
  onMutate: () => void;
}

export function DrawList({ projectId, draws, onMutate }: DrawListProps) {
  const { canEdit } = useAuth();
  const { toast } = useToast();
  const [formOpen, setFormOpen] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deleteOpen, setDeleteOpen] = useState(false);

  const handleDelete = async () => {
    if (!deleteId) return;
    try {
      const res = await fetch(`/api/draws/${deleteId}`, { method: "DELETE" });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error((err as { error?: string }).error || "Failed to delete draw");
      }
      toast({ title: "Draw deleted" });
      if (expandedId === deleteId) setExpandedId(null);
      onMutate();
    } catch (err) {
      toast({
        title: "Error",
        description: err instanceof Error ? err.message : "Failed to delete draw",
        variant: "destructive",
      });
    }
  };

  const columns: ColumnDef<DrawRequestWithLineItems, unknown>[] = [
    {
      id: "expand",
      header: "",
      enableSorting: false,
      cell: ({ row }) => (
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7"
          onClick={() =>
            setExpandedId(expandedId === row.original.id ? null : row.original.id)
          }
        >
          {expandedId === row.original.id ? (
            <ChevronDown className="h-4 w-4" />
          ) : (
            <ChevronRight className="h-4 w-4" />
          )}
        </Button>
      ),
    },
    {
      accessorKey: "drawNumber",
      header: "Draw #",
      cell: ({ row }) => (
        <span className="font-medium">#{row.original.drawNumber}</span>
      ),
    },
    {
      accessorKey: "status",
      header: "Status",
      cell: ({ row }) => <StatusBadge status={row.original.status} />,
    },
    {
      accessorKey: "totalAmount",
      header: "Total",
      cell: ({ row }) => <CurrencyDisplay amount={row.original.totalAmount} />,
    },
    {
      accessorKey: "submittedDate",
      header: "Submitted",
      cell: ({ row }) =>
        row.original.submittedDate ? formatDate(row.original.submittedDate) : "-",
    },
    {
      accessorKey: "approvedDate",
      header: "Approved",
      cell: ({ row }) =>
        row.original.approvedDate ? formatDate(row.original.approvedDate) : "-",
    },
    {
      accessorKey: "fundedDate",
      header: "Funded",
      cell: ({ row }) =>
        row.original.fundedDate ? formatDate(row.original.fundedDate) : "-",
    },
    ...(canEdit
      ? [
          {
            id: "actions",
            header: "",
            enableSorting: false,
            cell: ({ row }: { row: { original: DrawRequestWithLineItems } }) =>
              row.original.status === "Draft" ? (
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 text-destructive hover:text-destructive"
                  onClick={(e) => {
                    e.stopPropagation();
                    setDeleteId(row.original.id);
                    setDeleteOpen(true);
                  }}
                  title="Delete draft"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              ) : null,
          } as ColumnDef<DrawRequestWithLineItems, unknown>,
        ]
      : []),
  ];

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-2xl font-bold">Draw Requests</h2>
        {canEdit && (
          <Button onClick={() => setFormOpen(true)}>
            <Plus className="h-4 w-4 mr-2" />
            New Draw
          </Button>
        )}
      </div>

      <DataTable columns={columns} data={draws} />

      {expandedId && (
        <div className="mt-4">
          {draws
            .filter((d) => d.id === expandedId)
            .map((draw) => (
              <DrawDetail
                key={draw.id}
                draw={draw}
                projectId={projectId}
                onMutate={onMutate}
              />
            ))}
        </div>
      )}

      <DrawForm
        open={formOpen}
        onOpenChange={setFormOpen}
        projectId={projectId}
        onSuccess={onMutate}
      />

      <ConfirmDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        title="Delete Draft Draw"
        description="Are you sure you want to delete this draft draw request? This cannot be undone."
        onConfirm={handleDelete}
        confirmLabel="Delete"
      />
    </div>
  );
}
