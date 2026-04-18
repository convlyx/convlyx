import { cn } from "@/lib/utils";

export function UserAvatar({ name, className }: { name: string; className?: string }) {
  const initials = name
    .split(" ")
    .map((n) => n[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  return (
    <div className={cn("flex items-center justify-center rounded-full font-semibold text-sm", className)}>
      {initials}
    </div>
  );
}
