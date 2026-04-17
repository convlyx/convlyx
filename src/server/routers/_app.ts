import { router } from "../trpc";
import { schoolRouter } from "./school";
import { classRouter } from "./class";
import { enrollmentRouter } from "./enrollment";
import { userRouter } from "./user";

export const appRouter = router({
  school: schoolRouter,
  class: classRouter,
  enrollment: enrollmentRouter,
  user: userRouter,
});

export type AppRouter = typeof appRouter;
