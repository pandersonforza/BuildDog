"use client";

import { useState } from "react";
import Link from "next/link";
import { type ColumnDef } from "@tanstack/react-table";
import { DataTable } from "@/components/shared/data-table";
import { StatusBadge } from "@/components/shared/status-badge";
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
  const { user, canEdit } = useAuth();

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
      accessorKey: "address",
      header: "Address",
      cell: ({ row }) => (
        <span className="text-sm text-muted-foreground">
          {row.original.address || "—"}
        </span>
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
      accessorKey: "projectManager",
      header: "Project Manager",
    },
    {
      id: "actions",
      header: "",
      enableSorting: false,
      cell: ({ row }) => canEdit ? (
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
      ) : null,
    },
  ];

  const activeProjects = projects.filter(
    (p) => p.status === "Active"
  );
  const completedProjects = projects.filter(
    (p) => p.status === "Completed"
  );
  const onHoldProjects = projects.filter(
    (p) => p.status === "On Hold"
  );
  const deadProjects = projects.filter(
    (p) => p.status === "Dead"
  );

  const [tab, setTab] = useState<"active" | "completed" | "onhold" | "dead">("active");

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-3xl font-bold">Projects</h1>
        {canEdit && (
          <Button
            onClick={() => {
              setEditProject(undefined);
              setFormOpen(true);
            }}
          >
            <Plus className="h-4 w-4 mr-2" />
            New Project
          </Button>
        )}
      </div>

      <div className="flex gap-1 mb-4 border-b border-border">
        <button
          onClick={() => setTab("active")}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
            tab === "active"
              ? "border-primary text-primary"
              : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
        >
          Active ({activeProjects.length})
        </button>
        <button
          onClick={() => setTab("completed")}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
            tab === "completed"
              ? "border-primary text-primary"
              : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
        >
          Completed ({completedProjects.length})
        </button>
        <button
          onClick={() => setTab("onhold")}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
            tab === "onhold"
              ? "border-primary text-primary"
              : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
        >
          On Hold ({onHoldProjects.length})
        </button>
        <button
          onClick={() => setTab("dead")}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
            tab === "dead"
              ? "border-primary text-primary"
              : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
        >
          Dead ({deadProjects.length})
        </button>
      </div>

      <DataTable
        columns={columns}
        data={tab === "active" ? activeProjects : tab === "completed" ? completedProjects : tab === "onhold" ? onHoldProjects : deadProjects}
        searchKeys={["name", "address"]}
        searchPlaceholder="Search by name or address..."
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
