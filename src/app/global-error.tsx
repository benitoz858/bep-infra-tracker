"use client";

/**
 * Last-resort boundary for errors thrown in the root layout itself, where
 * (app)/error.tsx cannot help because the shell it renders inside is the thing
 * that failed. It must therefore render its own <html> and <body>, and must not
 * import from the design system — a broken import there is exactly the class of
 * failure that gets here.
 *
 * Styles are inline for the same reason: if globals.css failed to load, a
 * class-based layout would render as unstyled text on white.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#0A0A0A",
          color: "#E8E8E8",
          fontFamily:
            "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
          padding: "24px",
        }}
      >
        <div style={{ maxWidth: "440px" }}>
          <p
            style={{
              fontFamily: "ui-monospace, monospace",
              fontSize: "10px",
              letterSpacing: "0.15em",
              textTransform: "uppercase",
              color: "#FF4444",
              margin: "0 0 8px",
            }}
          >
            Application error
          </p>
          <h1 style={{ fontSize: "20px", margin: "0 0 10px", fontWeight: 700 }}>
            The tracker failed to start
          </h1>
          <p
            style={{
              fontSize: "13px",
              lineHeight: 1.6,
              color: "#9A9A9A",
              margin: "0 0 16px",
            }}
          >
            Something failed before the interface could render. No data has been
            changed. If this persists, check the server logs.
          </p>

          {/* The digest is a safe correlation id; the raw message is withheld
              because it can carry table names or connection details. */}
          {error.digest ? (
            <p
              style={{
                fontFamily: "ui-monospace, monospace",
                fontSize: "11px",
                color: "#6B6B6B",
                margin: "0 0 16px",
              }}
            >
              Reference: {error.digest}
            </p>
          ) : null}

          <button
            type="button"
            onClick={() => reset()}
            style={{
              background: "#00D4FF",
              color: "#000",
              border: "none",
              borderRadius: "6px",
              padding: "9px 16px",
              fontSize: "13px",
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            Try again
          </button>
        </div>
      </body>
    </html>
  );
}
