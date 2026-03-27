"use client";

import { useState, useEffect } from "react";
import { usePathname } from "next/navigation";
import Link from "next/link";
import { ChevronRight, LogOut } from "lucide-react";
import { SidebarTrigger } from "./sidebar";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";

const KNOWN_SEGMENTS: Record<string, string> = {
  dashboard: "Dashboard",
  projects: "Projects",
  reports: "Reports",
  budget: "Budget",
  draws: "Draws",
  contracts: "Contracts",
  documents: "Documents",
  milestones: "Milestones",
};

function isId(segment: string) {
  return segment.length > 10 && !/^[a-z-]+$/.test(segment);
}

interface HeaderProps {
  onMenuClick: () => void;
}

export function Header({ onMenuClick }: HeaderProps) {
  const pathname = usePathname();
  const [nameCache, setNameCache] = useState<Record<string, { name: string; address?: string }>>({});
  const { user, logout } = useAuth();

  const segments = pathname.split("/").filter(Boolean);

  // Find project ID segments and fetch their names
  useEffect(() => {
    const projectIdx = segments.indexOf("projects");
    if (projectIdx !== -1 && projectIdx + 1 < segments.length) {
      const id = segments[projectIdx + 1];
      if (isId(id) && !nameCache[id]) {
        fetch(`/api/projects/${id}`)
          .then((r) => r.ok ? r.json() : null)
          .then((data) => {
            if (data?.name) {
              setNameCache((prev) => ({ ...prev, [id]: { name: data.name, address: data.address } }));
            }
          })
          .catch(() => {});
      }
    }
  }, [pathname]); // eslint-disable-line react-hooks/exhaustive-deps

  const breadcrumbs: { label: string; href: string }[] = [];
  let currentPath = "";
  for (const segment of segments) {
    currentPath += `/${segment}`;
    let label: string;
    if (KNOWN_SEGMENTS[segment]) {
      label = KNOWN_SEGMENTS[segment];
    } else if (isId(segment) && nameCache[segment]) {
      const cached = nameCache[segment];
      label = cached.address ? `${cached.name} - ${cached.address}` : cached.name;
    } else if (isId(segment)) {
      label = "...";
    } else {
      label = segment.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
    }
    breadcrumbs.push({ label, href: currentPath });
  }

  return (
    <header className="flex h-16 items-center gap-4 border-b border-border bg-card px-6">
      <SidebarTrigger onClick={onMenuClick} />

      <nav className="flex items-center gap-1 text-sm">
        {breadcrumbs.map((crumb, index) => (
          <span key={crumb.href} className="flex items-center gap-1">
            {index > 0 && (
              <ChevronRight className="h-4 w-4 text-muted-foreground" />
            )}
            {index === breadcrumbs.length - 1 ? (
              <span className="font-medium text-foreground">
                {crumb.label}
              </span>
            ) : (
              <Link
                href={crumb.href}
                className="text-muted-foreground hover:text-foreground"
              >
                {crumb.label}
              </Link>
            )}
          </span>
        ))}
      </nav>

      <div className="ml-auto flex items-center gap-3">
        {user && (
          <>
            <Link
              href="/profile"
              className="flex items-center gap-2 rounded-md px-2 py-1 transition-colors hover:bg-muted"
              title="Profile settings"
            >
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-primary-foreground text-xs font-medium">
                {user.name.split(" ").map((n) => n[0]).join("").slice(0, 2)}
              </div>
              <span className="text-sm font-medium hidden sm:inline">
                {user.name}
              </span>
            </Link>
            <Button variant="ghost" size="icon" onClick={logout} title="Sign out">
              <LogOut className="h-4 w-4" />
            </Button>
          </>
        )}
      </div>
    </header>
  );
}
