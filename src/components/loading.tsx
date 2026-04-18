"use client";

export function Loading() {
  return (
    <div className="flex items-center justify-center py-16">
      <div className="flex items-center gap-1.5">
        <div className="h-2.5 w-2.5 rounded-full bg-primary animate-loading-dot" />
        <div className="h-2.5 w-2.5 rounded-full bg-primary animate-loading-dot [animation-delay:150ms]" />
        <div className="h-2.5 w-2.5 rounded-full bg-primary animate-loading-dot [animation-delay:300ms]" />
      </div>
    </div>
  );
}
