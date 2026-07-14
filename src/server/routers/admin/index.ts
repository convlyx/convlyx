import { router } from "../../trpc";
import { portfolioRouter } from "./portfolio";
import { accountRouter } from "./account";
import { opsRouter } from "./ops";
import { supportRouter } from "./support";

export const adminRouter = router({
  portfolio: portfolioRouter,
  account: accountRouter,
  ops: opsRouter,
  support: supportRouter,
});
