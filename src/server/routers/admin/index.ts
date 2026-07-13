import { router } from "../../trpc";
import { portfolioRouter } from "./portfolio";

export const adminRouter = router({
  portfolio: portfolioRouter,
});
