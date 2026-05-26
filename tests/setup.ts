/**
 * Loads .env before tests run so DATABASE_URL etc. are available.
 * CI sets these env vars directly via the workflow and won't have a .env.
 */
import "dotenv/config";
import { vi } from "vitest";

/**
 * Stub the Supabase client so tests don't depend on a real Auth project.
 *
 * - Locally the placeholder URL/keys in `.env` already make Auth API calls
 *   fail; we tolerated the 404 path but more obscure failures (network /
 *   DNS / no status) still leaked through and rolled procedures back.
 * - In CI the URL is literally `https://example.supabase.co` — every call
 *   would fail and (without this stub) every test that exercises an Auth-
 *   touching procedure would fail too.
 *
 * Every admin method returns `{ data, error: null }` so callers treat the
 * call as a successful no-op. Tests that genuinely need to verify Auth
 * interactions should override these with `vi.mocked(...)` per-test.
 */
vi.mock("@supabase/supabase-js", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@supabase/supabase-js")>();
  const stubAdmin = {
    deleteUser: vi.fn().mockResolvedValue({ data: null, error: null }),
    listUsers: vi.fn().mockResolvedValue({ data: { users: [] }, error: null }),
    getUserById: vi.fn().mockResolvedValue({ data: { user: null }, error: null }),
    createUser: vi.fn().mockResolvedValue({ data: { user: null }, error: null }),
    inviteUserByEmail: vi.fn().mockResolvedValue({ data: { user: null }, error: null }),
  };
  return {
    ...actual,
    createClient: vi.fn(() => ({
      auth: {
        admin: stubAdmin,
        resetPasswordForEmail: vi.fn().mockResolvedValue({ data: null, error: null }),
        getUser: vi.fn().mockResolvedValue({ data: { user: null }, error: null }),
      },
    })),
  };
});
