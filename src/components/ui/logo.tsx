import { cn } from "@/lib/utils";

interface LogoProps {
  size?: "sm" | "md" | "lg";
  className?: string;
}

export function Logo({ size = "md", className }: LogoProps) {
  const sizeClasses = {
    sm: "text-xl",
    md: "text-2xl",
    lg: "text-4xl",
  };

  const barHeight = {
    sm: "h-5",
    md: "h-6",
    lg: "h-8",
  };

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 font-extrabold tracking-tight select-none",
        sizeClasses[size],
        className
      )}
    >
      <span
        className={cn(
          "w-1 rounded-full bg-gradient-to-b from-primary to-primary/40",
          barHeight[size]
        )}
      />
      <span className="italic">
        <span className="text-foreground">Build</span><span className="bg-gradient-to-r from-primary to-primary/70 bg-clip-text text-transparent pr-1">Forza</span>
      </span>
    </span>
  );
}
