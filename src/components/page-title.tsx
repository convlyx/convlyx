"use client";

import { useEffect, useRef } from "react";

export function PageTitle({ title }: { title: string }) {
  const titleRef = useRef(title);
  titleRef.current = title;

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
