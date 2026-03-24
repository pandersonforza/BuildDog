"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

interface ProjectTabsNavProps {
  projectId: string;
}

const tabs = [
  { label: "Overview", href: "" },
  { label: "Budget", href: "/budget" },
  { label: "Draws", href: "/draws" },
  { label: "Invoices", href: "/invoices" },
  { label: "Bids", href: "/bids" },
  { label: "Notes", href: "/notes" },
];

export function ProjectTabsNav({ projectId }: ProjectTabsNavProps) {
  const pathname = usePathname();
  const basePath = `/projects/${projectId}`;

  return (
    <nav className="flex border-b border-border mb-6">
      {tabs.map((tab) => {
        const href = `${basePath}${tab.href}`;
        const isActive =
          tab.href === ""
            ? pathname === basePath
            : pathname.startsWith(href);

        return (
          <Link
            key={tab.label}
            href={href}
            className={cn(
              "px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors",
              isActive
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground hover:border-border"
            )}
          >
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}
