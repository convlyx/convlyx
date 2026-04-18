import { router } from "../trpc";
import { schoolRouter } from "./school";
import { classRouter } from "./class";
import { enrollmentRouter } from "./enrollment";
import { userRouter } from "./user";
import { notificationRouter } from "./notification";

export const appRouter = router({
  school: schoolRouter,
  class: classRouter,
  enrollment: enrollmentRouter,
  user: userRouter,
  notification: notificationRouter,
});

export type AppRouter = typeof appRouter;
