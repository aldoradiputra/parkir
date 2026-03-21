import { cn, formatPlate } from "@/lib/utils";

interface PlateDisplayProps {
  plate: string;
  size?: "sm" | "md" | "lg";
  className?: string;
}

export function PlateDisplay({
  plate,
  size = "md",
  className,
}: PlateDisplayProps) {
  const sizeClasses = {
    sm: "text-xs px-1.5 py-0.5",
    md: "text-sm px-2 py-1",
    lg: "text-base px-3 py-1.5",
  };

  return (
    <span
      className={cn(
        "inline-block font-mono font-semibold text-amber tracking-[0.1em] bg-amber/10 rounded-md",
        sizeClasses[size],
        className
      )}
    >
      {formatPlate(plate)}
    </span>
  );
}
