import { router } from "../trpc";
import { schoolRouter } from "./school";
import { classRouter } from "./class";
import { enrollmentRouter } from "./enrollment";
import { userRouter } from "./user";
import { notificationRouter } from "./notification";
import { courseRouter } from "./course";
import { examRouter } from "./exam";

export const appRouter = router({
  school: schoolRouter,
  class: classRouter,
  enrollment: enrollmentRouter,
  user: userRouter,
  notification: notificationRouter,
  course: courseRouter,
  exam: examRouter,
});

export type AppRouter = typeof appRouter;
