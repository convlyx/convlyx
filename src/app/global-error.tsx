"use client";

import * as Sentry from "@sentry/nextjs";
import { useEffect } from "react";

export default function GlobalError({
  error,
}: {
  error: Error & { digest?: string };
}) {
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  return (
    <html>
      <body>
        <div
          style={{
            minHeight: "100vh",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "1rem",
            fontFamily: "system-ui, sans-serif",
          }}
        >
          <div style={{ maxWidth: "400px", textAlign: "center" }}>
            <h1 style={{ fontSize: "1.5rem", fontWeight: 600, marginBottom: "0.5rem" }}>
              Algo correu mal
            </h1>
            <p style={{ color: "#666", marginBottom: "1.5rem" }}>
              Ocorreu um erro inesperado. A nossa equipa foi notificada.
            </p>
            <button
              type="button"
              onClick={() => window.location.reload()}
              style={{
                padding: "0.5rem 1rem",
                background: "#16a34a",
                color: "white",
                border: 0,
                borderRadius: "0.5rem",
                cursor: "pointer",
                fontSize: "0.875rem",
              }}
            >
              Tentar novamente
            </button>
          </div>
        </div>
      </body>
    </html>
  );
}
