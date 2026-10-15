import { Router, type IRouter } from "express";
import healthRouter from "./health";
import accountsRouter from "./accounts";
import demoAuctionsRouter from "./demo-auctions";
import { anonymousSession } from "../middleware/anonymous-session";

const router: IRouter = Router();

router.use(healthRouter);
router.use(anonymousSession);
router.use(accountsRouter);
router.use(demoAuctionsRouter);

export default router;
