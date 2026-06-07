// Stub for the `server-only` marker package in the vitest (Node) environment.
// `server-only` is provided by Next.js at build time to fail the build if a
// server module is imported into a client bundle; it has no behavior to test.
// Vitest runs in Node and can't resolve it, so we alias it to this no-op.
export {};
