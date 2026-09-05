// Vitest stand-in for the "server-only" package. Next.js's own build
// aliases this package to a no-op for server-side code (it only throws
// when bundled into a client component's bundle); Vitest has no such
// server/client boundary, so every "server-only" import would otherwise
// throw here regardless of which module imports it. This stub restores
// the same "no-op in a server context" behavior for tests.
export {};
