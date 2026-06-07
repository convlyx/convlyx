import { router } from "../trpc";
import { schoolRouter } from "./school";
import { classRouter } from "./class";
import { enrollmentRouter } from "./enrollment";
import { userRouter } from "./user";
import { notificationRouter } from "./notification";
import { novidadesRouter } from "./novidades";
import { courseRouter } from "./course";
import { examRouter } from "./exam";
import { analyticsRouter } from "./analytics";

export const appRouter = router({
  school: schoolRouter,
  class: classRouter,
  enrollment: enrollmentRouter,
  user: userRouter,
  notification: notificationRouter,
  novidades: novidadesRouter,
  course: courseRouter,
  exam: examRouter,
  analytics: analyticsRouter,
});

export type AppRouter = typeof appRouter;
