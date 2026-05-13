"use client";

import { useEffect, useRef } from "react";

export function PageTitle({ title }: { title: string }) {
  // The observer (set up once below) needs to read the latest title each
  // time it fires; refs let it bypass the captured closure. Sync the ref
  // inside an effect so we don't write to a ref during render.
  const titleRef = useRef(title);
  useEffect(() => {
    titleRef.current = title;
  });

  useEffect(() => {
    document.title = titleRef.current;

    // Persist our title against Next.js metadata overrides
    const observer = new MutationObserver(() => {
      const titleEl = document.querySelector("title");
      if (titleEl && titleEl.textContent !== titleRef.current) {
        titleEl.textContent = titleRef.current;
      }
    });

    const head = document.querySelector("head");
    if (head) {
      observer.observe(head, { childList: true, subtree: true, characterData: true });
    }

    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    document.title = title;
  }, [title]);

  return null;
}
