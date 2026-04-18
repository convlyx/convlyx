"use client";

import { useEffect, useState } from "react";
import { LayoutGrid, List } from "lucide-react";
import { Button } from "@/components/ui/button";

export type ViewMode = "cards" | "table";

const STORAGE_PREFIX = "viewMode:";

function getStoredView(route: string): ViewMode {
  if (typeof window === "undefined") return "cards";
  return (localStorage.getItem(`${STORAGE_PREFIX}${route}`) as ViewMode) ?? "cards";
}

function storeView(route: string, mode: ViewMode) {
  localStorage.setItem(`${STORAGE_PREFIX}${route}`, mode);
}

export function useViewMode(route: string, urlValue?: ViewMode): [ViewMode, (mode: ViewMode) => void] {
  const [view, setView] = useState<ViewMode>(() => {
    if (urlValue === "cards" || urlValue === "table") return urlValue;
    return "cards";
  });

  useEffect(() => {
    // On mount, resolve from URL or localStorage
    if (urlValue === "cards" || urlValue === "table") {
      setView(urlValue);
      storeView(route, urlValue);
    } else {
      setView(getStoredView(route));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [route]);

  function setAndStore(mode: ViewMode) {
    setView(mode);
    storeView(route, mode);
  }

  return [view, setAndStore];
}

export function ViewToggle({
  view,
  onChange,
}: {
  view: ViewMode;
  onChange: (mode: ViewMode) => void;
}) {
  return (
    <div className="flex items-center rounded-lg border p-0.5 gap-0.5">
      <Button
        variant={view === "cards" ? "default" : "ghost"}
        size="icon-sm"
        onClick={() => onChange("cards")}
        title="Vista em cartões"
        className="h-7 w-7"
      >
        <LayoutGrid className="h-3.5 w-3.5" />
      </Button>
      <Button
        variant={view === "table" ? "default" : "ghost"}
        size="icon-sm"
        onClick={() => onChange("table")}
        title="Vista em tabela"
        className="h-7 w-7"
      >
        <List className="h-3.5 w-3.5" />
      </Button>
    </div>
  );
}
