"use client";

import { useEffect, useState, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { SelectNative } from "@/components/ui/select";
import { useToast } from "@/components/ui/toast";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { useAuth } from "@/hooks/use-auth";
import { Plus, Trash2, Check, Circle, User } from "lucide-react";

interface TaskUser {
  id: string;
  name: string;
}

interface Task {
  id: string;
  title: string;
  description: string | null;
  status: string;
  priority: string;
  dueDate: string | null;
  userId: string;
  project: { id: string; name: string } | null;
  user: TaskUser;
  createdBy: TaskUser | null;
}

const PRIORITY_COLORS: Record<string, string> = {
  high: "bg-red-100 text-red-800",
  medium: "bg-amber-100 text-amber-800",
  low: "bg-blue-100 text-blue-800",
};

const STATUS_ICONS: Record<string, React.ReactNode> = {
  pending: <Circle className="h-4 w-4 text-muted-foreground" />,
  completed: <Check className="h-4 w-4 text-emerald-500" />,
};

export function TaskList() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newPriority, setNewPriority] = useState("medium");
  const [newAssigneeId, setNewAssigneeId] = useState("");
  const [adding, setAdding] = useState(false);
  const [users, setUsers] = useState<TaskUser[]>([]);
  const { toast } = useToast();
  const { user: currentUser, canEdit } = useAuth();

  const fetchTasks = useCallback(async () => {
    try {
      const res = await fetch("/api/tasks");
      if (!res.ok) throw new Error("Failed to fetch");
      const data = await res.json();
      setTasks(data);
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchTasks();
    fetch("/api/auth/users")
      .then((res) => res.json())
      .then((data: TaskUser[]) => setUsers(data))
      .catch(() => {});
  }, [fetchTasks]);

  const openCreateDialog = () => {
    setNewTitle("");
    setNewPriority("medium");
    setNewAssigneeId(currentUser?.id ?? "");
    setDialogOpen(true);
  };

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim()) return;

    setAdding(true);
    try {
      const body: Record<string, string> = { title: newTitle.trim(), priority: newPriority };
      if (newAssigneeId && newAssigneeId !== currentUser?.id) {
        body.assigneeId = newAssigneeId;
      }
      const res = await fetch("/api/tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error("Failed to add task");
      const assignee = users.find((u) => u.id === newAssigneeId);
      const isSelf = !newAssigneeId || newAssigneeId === currentUser?.id;
      toast({
        title: "Task created",
        description: isSelf
          ? `"${newTitle.trim()}" added to your tasks`
          : `"${newTitle.trim()}" assigned to ${assignee?.name}`,
      });
      setDialogOpen(false);
      setNewTitle("");
      fetchTasks();
    } catch {
      toast({ title: "Error", description: "Failed to add task", variant: "destructive" });
    } finally {
      setAdding(false);
    }
  };

  const cycleStatus = async (task: Task) => {
    const newStatus = task.status === "completed" ? "pending" : "completed";

    try {
      const res = await fetch(`/api/tasks/${task.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });
      if (!res.ok) throw new Error("Failed to update");
      fetchTasks();
    } catch {
      toast({ title: "Error", description: "Failed to update task", variant: "destructive" });
    }
  };

  const handleDelete = async (taskId: string) => {
    try {
      const res = await fetch(`/api/tasks/${taskId}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to delete");
      fetchTasks();
    } catch {
      toast({ title: "Error", description: "Failed to delete task", variant: "destructive" });
    }
  };

  if (loading) return null;

  const activeTasks = tasks.filter((t) => t.status !== "completed");
  const completedTasks = tasks.filter((t) => t.status === "completed");

  const assigneeOptions = users.map((u) => ({
    value: u.id,
    label: u.id === currentUser?.id ? `${u.name} (me)` : u.name,
  }));

  const priorityOptions = [
    { value: "low", label: "Low" },
    { value: "medium", label: "Medium" },
    { value: "high", label: "High" },
  ];

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>My Tasks</CardTitle>
            <div className="flex items-center gap-2">
              {tasks.length > 0 && (
                <Badge variant="secondary">
                  {activeTasks.length} active
                </Badge>
              )}
              {canEdit && (
                <Button size="sm" onClick={openCreateDialog}>
                  <Plus className="h-4 w-4 mr-1" />
                  New Task
                </Button>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {tasks.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">
              No tasks yet. Create one to get started.
            </p>
          ) : (
            <div className="space-y-1">
              {activeTasks.map((task) => {
                const assignedByOther =
                  task.createdBy && task.createdBy.id !== currentUser?.id;
                const assignedToOther =
                  task.userId !== currentUser?.id && task.user;
                return (
                  <div
                    key={task.id}
                    className={`flex items-center gap-2 rounded-md px-2 py-1.5 hover:bg-muted/50 group ${
                      task.status === "completed" ? "opacity-50" : ""
                    }`}
                  >
                    <button
                      onClick={() => cycleStatus(task)}
                      className="shrink-0"
                      title={assignedToOther ? `Assigned to ${task.user.name} — only they can complete` : `Status: ${task.status.replace("_", " ")}`}
                      disabled={!!assignedToOther}
                    >
                      {STATUS_ICONS[task.status]}
                    </button>
                    <div className="flex-1 min-w-0">
                      <span
                        className={`text-sm ${
                          task.status === "completed"
                            ? "line-through text-muted-foreground"
                            : ""
                        }`}
                      >
                        {task.title}
                      </span>
                      {assignedByOther && (
                        <span className="text-xs text-muted-foreground ml-1.5">
                          from {task.createdBy!.name}
                        </span>
                      )}
                      {assignedToOther && (
                        <span className="text-xs text-primary/70 ml-1.5">
                          → {task.user.name}
                        </span>
                      )}
                    </div>
                    {task.project && (
                      <Badge variant="outline" className="text-xs shrink-0">
                        {task.project.name}
                      </Badge>
                    )}
                    <Badge
                      variant="secondary"
                      className={`text-xs shrink-0 ${PRIORITY_COLORS[task.priority] || ""}`}
                    >
                      {task.priority}
                    </Badge>
                    {canEdit && (
                      <button
                        onClick={() => handleDelete(task.id)}
                        className="opacity-0 group-hover:opacity-100 transition-opacity shrink-0"
                        title="Delete task"
                      >
                        <Trash2 className="h-3.5 w-3.5 text-destructive" />
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>New Task</DialogTitle>
            <DialogDescription>
              Create a task for yourself or assign it to a team member.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleAdd} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="taskTitle">Title</Label>
              <Input
                id="taskTitle"
                placeholder="What needs to be done?"
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                autoFocus
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="taskAssignee">Assign To</Label>
                <SelectNative
                  id="taskAssignee"
                  value={newAssigneeId}
                  onChange={(e) => setNewAssigneeId(e.target.value)}
                  options={assigneeOptions}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="taskPriority">Priority</Label>
                <SelectNative
                  id="taskPriority"
                  value={newPriority}
                  onChange={(e) => setNewPriority(e.target.value)}
                  options={priorityOptions}
                />
              </div>
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setDialogOpen(false)}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={adding || !newTitle.trim()}>
                {newAssigneeId && newAssigneeId !== currentUser?.id ? (
                  <>
                    <User className="h-4 w-4 mr-1" />
                    Assign Task
                  </>
                ) : (
                  "Create Task"
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
