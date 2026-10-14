import { Router, type IRouter } from "express";
import healthRouter from "./health";
import demoAuctionsRouter from "./demo-auctions";

const router: IRouter = Router();

router.use(healthRouter);
router.use(demoAuctionsRouter);

export default router;
