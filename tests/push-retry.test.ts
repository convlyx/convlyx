import { describe, it, expect, vi, beforeEach } from "vitest";

const sendNotification = vi.fn();
vi.mock("web-push", () => ({
  default: { setVapidDetails: vi.fn(), sendNotification: (...a: unknown[]) => sendNotification(...a) },
}));

// VAPID keys must be set for push.ts to attempt sending.
process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ||= "test-public";
process.env.VAPID_PRIVATE_KEY ||= "test-private";

const fakeDb = {
  pushSubscription: {
    findMany: async () => [{ id: "s1", endpoint: "e", p256dh: "p", auth: "a" }],
    delete: async () => ({}),
  },
} as unknown as import("@/server/lib/tenant-scope").DbClient;

beforeEach(() => sendNotification.mockReset());

describe("sendPushToUser retry", () => {
  it("retries a transient failure then succeeds", async () => {
    const { sendPushToUser } = await import("@/server/lib/push");
    sendNotification
      .mockRejectedValueOnce({ statusCode: 500 })
      .mockResolvedValueOnce(undefined);
    await sendPushToUser(fakeDb, "t1", "u1", { title: "x", body: "y" });
    expect(sendNotification).toHaveBeenCalledTimes(2);
  });

  it("does not retry a 410 (prunes instead)", async () => {
    const { sendPushToUser } = await import("@/server/lib/push");
    sendNotification.mockRejectedValueOnce({ statusCode: 410 });
    await sendPushToUser(fakeDb, "t1", "u1", { title: "x", body: "y" });
    expect(sendNotification).toHaveBeenCalledTimes(1);
  });
});
