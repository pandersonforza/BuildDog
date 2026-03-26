import { cn } from "@/lib/utils";

interface LogoProps {
  size?: "sm" | "md" | "lg";
  className?: string;
}

function DogHouseIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      className={className}
      xmlns="http://www.w3.org/2000/svg"
    >
      {/* Roof */}
      <path
        d="M12 2L2 10h3v10h14V10h3L12 2z"
        fill="currentColor"
        opacity={0.15}
        stroke="currentColor"
        strokeWidth={1.5}
        strokeLinejoin="round"
      />
      {/* Door opening */}
      <path
        d="M9.5 20v-5.5a2.5 2.5 0 0 1 5 0V20"
        fill="currentColor"
        opacity={0.3}
        stroke="currentColor"
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {/* Roof ridge line */}
      <path
        d="M12 2L2 10"
        stroke="currentColor"
        strokeWidth={2}
        strokeLinecap="round"
      />
      <path
        d="M12 2L22 10"
        stroke="currentColor"
        strokeWidth={2}
        strokeLinecap="round"
      />
    </svg>
  );
}

export function Logo({ size = "md", className }: LogoProps) {
  const sizeClasses = {
    sm: "text-xl",
    md: "text-2xl",
    lg: "text-4xl",
  };

  const iconSize = {
    sm: "h-6 w-6",
    md: "h-8 w-8",
    lg: "h-11 w-11",
  };

  return (
    <span
      className={cn(
        "inline-flex items-center gap-0.5 font-extrabold tracking-tight select-none",
        sizeClasses[size],
        className
      )}
    >
      <DogHouseIcon className={cn("text-teal-500 shrink-0", iconSize[size])} />
      <span className="italic">
        <span className="text-foreground">Prop</span><span className="bg-gradient-to-r from-primary to-primary/70 bg-clip-text text-transparent pr-1">Hound</span>
      </span>
    </span>
  );
}
