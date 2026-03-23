"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Copy, Check, Link } from "lucide-react";
import { useToast } from "@/components/ui/toast";

interface GenerateBidLinkProps {
  projectId: string;
  onCreated: () => void;
}

export function GenerateBidLink({ projectId, onCreated }: GenerateBidLinkProps) {
  const [loading, setLoading] = useState(false);
  const [generatedLink, setGeneratedLink] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const { toast } = useToast();

  const handleGenerate = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/projects/${projectId}/bids/invite`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      if (!res.ok) throw new Error("Failed to create invitation");
      const invitation = await res.json();
      const link = `${window.location.origin}/bid/${invitation.token}`;
      setGeneratedLink(link);
      await navigator.clipboard.writeText(link);
      setCopied(true);
      toast({ title: "Bid link generated and copied to clipboard" });
      setTimeout(() => setCopied(false), 2000);
      onCreated();
    } catch {
      toast({ title: "Error", description: "Failed to generate bid link", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = async () => {
    if (!generatedLink) return;
    await navigator.clipboard.writeText(generatedLink);
    setCopied(true);
    toast({ title: "Link copied to clipboard" });
    setTimeout(() => setCopied(false), 2000);
  };

  if (generatedLink) {
    return (
      <div className="flex items-center gap-2">
        <Input value={generatedLink} readOnly className="font-mono text-xs w-64" />
        <Button variant="outline" size="icon" onClick={handleCopy}>
          {copied ? (
            <Check className="h-4 w-4 text-emerald-500" />
          ) : (
            <Copy className="h-4 w-4" />
          )}
        </Button>
        <Button onClick={handleGenerate} disabled={loading} variant="outline" size="sm">
          New Link
        </Button>
      </div>
    );
  }

  return (
    <Button onClick={handleGenerate} disabled={loading}>
      <Link className="h-4 w-4 mr-2" />
      {loading ? "Generating..." : "Generate Bid Link"}
    </Button>
  );
}
