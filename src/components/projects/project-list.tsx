"use client";

import { useState } from "react";
import Link from "next/link";
import { type ColumnDef } from "@tanstack/react-table";
import { DataTable } from "@/components/shared/data-table";
import { StatusBadge } from "@/components/shared/status-badge";
import { CurrencyDisplay } from "@/components/shared/currency-display";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { ProjectForm } from "@/components/projects/project-form";
import { useToast } from "@/components/ui/toast";
import { Plus, Pencil, Trash2 } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import type { Project } from "@/types";

interface ProjectListProps {
  projects: Project[];
  onMutate: () => void;
}

export function ProjectList({ projects, onMutate }: ProjectListProps) {
  const [formOpen, setFormOpen] = useState(false);
  const [editProject, setEditProject] = useState<Project | undefined>();
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const { toast } = useToast();
  const { user } = useAuth();

  const handleDelete = async () => {
    if (!deleteId) return;
    try {
      const res = await fetch(`/api/projects/${deleteId}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to delete project");
      toast({ title: "Project deleted" });
      onMutate();
    } catch {
      toast({ title: "Error", description: "Failed to delete project", variant: "destructive" });
    }
  };

  const columns: ColumnDef<Project, unknown>[] = [
    {
      accessorKey: "name",
      header: "Name",
      cell: ({ row }) => (
        <Link
          href={`/projects/${row.original.id}`}
          className="font-medium text-primary hover:underline"
        >
          {row.original.name}
        </Link>
      ),
    },
    {
      accessorKey: "tenant",
      header: "Tenant",
    },
    {
      accessorKey: "status",
      header: "Status",
      cell: ({ row }) => <StatusBadge status={row.original.status} />,
    },
    {
      accessorKey: "stage",
      header: "Stage",
      cell: ({ row }) => <StatusBadge status={row.original.stage} type="stage" />,
    },
    {
      accessorKey: "totalBudget",
      header: "Budget",
      cell: ({ row }) => <CurrencyDisplay amount={row.original.totalBudget} />,
    },
    {
      accessorKey: "address",
      header: "Address",
      cell: ({ row }) => (
        <span className="text-sm text-muted-foreground">
          {row.original.address || "—"}
        </span>
      ),
    },
    {
      accessorKey: "projectManager",
      header: "Project Manager",
    },
    {
      id: "actions",
      header: "",
      enableSorting: false,
      cell: ({ row }) => (
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => {
              setEditProject(row.original);
              setFormOpen(true);
            }}
          >
            <Pencil className="h-4 w-4" />
          </Button>
          {user?.role === "admin" && (
            <Button
              variant="ghost"
              size="icon"
              onClick={() => {
                setDeleteId(row.original.id);
                setDeleteOpen(true);
              }}
            >
              <Trash2 className="h-4 w-4 text-destructive" />
            </Button>
          )}
        </div>
      ),
    },
  ];

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-3xl font-bold">Projects</h1>
        <Button
          onClick={() => {
            setEditProject(undefined);
            setFormOpen(true);
          }}
        >
          <Plus className="h-4 w-4 mr-2" />
          New Project
        </Button>
      </div>

      <DataTable
        columns={columns}
        data={projects}
        searchKey="name"
        searchPlaceholder="Search projects..."
      />

      <ProjectForm
        open={formOpen}
        onOpenChange={(open) => {
          setFormOpen(open);
          if (!open) setEditProject(undefined);
        }}
        project={editProject}
        onSuccess={onMutate}
      />

      <ConfirmDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        title="Delete Project"
        description="Are you sure you want to delete this project? This action cannot be undone and will remove all associated data."
        onConfirm={handleDelete}
        confirmLabel="Delete"
      />
    </div>
  );
}
