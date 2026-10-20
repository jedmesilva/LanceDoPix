import { Router, type IRouter } from "express";
import {
  GetDemoAuctionResponse,
  PlaceDemoAuctionBidBody,
  PlaceDemoAuctionBidResponse,
  ResetDemoAuctionResponse,
} from "@workspace/api-zod";
import {
  AuctionConflictError,
  getDemoAuction,
  placeDemoAuctionBid,
  resetDemoAuction,
} from "../lib/demo-auction";
import { getSessionAccount } from "../middleware/anonymous-session";

const router: IRouter = Router();

router.get("/auctions/demo/current", async (req, res): Promise<void> => {
  try {
    const auction = await getDemoAuction(getSessionAccount(res).id);
    res.json(GetDemoAuctionResponse.parse(auction));
  } catch (error) {
    req.log.error({ err: error }, "Failed to load auction");
    res.status(500).json({ error: "Não foi possível carregar a disputa." });
  }
});

router.post("/auctions/demo/bids", async (req, res): Promise<void> => {
  const parsed = PlaceDemoAuctionBidBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Informe um lance válido." });
    return;
  }

  try {
    const auction = await placeDemoAuctionBid({
      accountId: getSessionAccount(res).id,
      amountCents: parsed.data.amountCents,
    });
    res.status(201).json(PlaceDemoAuctionBidResponse.parse(auction));
  } catch (error) {
    if (error instanceof AuctionConflictError) {
      res.status(error.statusCode).json({ error: error.message });
      return;
    }
    req.log.error({ err: error }, "Failed to place auction bid");
    res.status(500).json({ error: "Não foi possível registrar o lance." });
  }
});

router.post("/auctions/demo/reset", async (req, res): Promise<void> => {
  try {
    const auction = await resetDemoAuction(getSessionAccount(res).id);
    res.json(ResetDemoAuctionResponse.parse(auction));
  } catch (error) {
    req.log.error({ err: error }, "Failed to reset auction");
    res.status(500).json({ error: "Não foi possível reiniciar a disputa." });
  }
});

export default router;
