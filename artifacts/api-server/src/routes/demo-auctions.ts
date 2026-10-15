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

const router: IRouter = Router();

router.get("/auctions/demo/current", async (req, res): Promise<void> => {
  try {
    const auction = await getDemoAuction();
    res.json(GetDemoAuctionResponse.parse(auction));
  } catch (error) {
    req.log.error({ err: error }, "Failed to load auction");
    res.status(500).json({ error: "Não foi possível carregar o leilão." });
  }
});

router.post("/auctions/demo/bids", async (req, res): Promise<void> => {
  const parsed = PlaceDemoAuctionBidBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Informe um lance válido." });
    return;
  }

  try {
    const auction = await placeDemoAuctionBid(parsed.data);
    res.status(201).json(PlaceDemoAuctionBidResponse.parse(auction));
  } catch (error) {
    if (error instanceof AuctionConflictError) {
      res.status(409).json({ error: error.message });
      return;
    }
    req.log.error({ err: error }, "Failed to place auction bid");
    res.status(500).json({ error: "Não foi possível registrar o lance." });
  }
});

router.post("/auctions/demo/reset", async (req, res): Promise<void> => {
  try {
    const auction = await resetDemoAuction();
    res.json(ResetDemoAuctionResponse.parse(auction));
  } catch (error) {
    req.log.error({ err: error }, "Failed to reset auction");
    res.status(500).json({ error: "Não foi possível reiniciar o leilão." });
  }
});

export default router;
