import { pool } from "@workspace/db";
import { resetAccountInTransaction } from "./accounts";

const connectClient = () => pool.connect();
type PoolClient = Awaited<ReturnType<typeof connectClient>>;

const AUCTION_ID = "lance-do-pix-demo";
const PRIZE_CENTS = 100_000;
const INITIAL_BID_CENTS = 10_000;
const TIMER_MS = 60_000;
const BONUS_PERIOD_MS = 60_000;
const BONUS_PERCENT = 10;
const MIN_INCREMENT_CENTS = 1_000;
const BID_HISTORY_LIMIT = 8;

type AuctionRow = {
  id: string;
  prize_cents: number;
  current_bid_cents: number;
  bonus_cents: number;
  period_bid_cents: number;
  next_bonus_at: Date;
  ends_at: Date;
  status: "live" | "closed";
  last_bidder_id: string;
  last_bidder_name: string;
};

type BidRow = {
  id: number;
  bidder_id: string;
  bidder_name: string;
  amount_cents: number;
  created_at: Date;
};

type DemoAuctionBid = {
  id: number;
  bidderName: string;
  amountCents: number;
  createdAt: Date;
  isCurrentUser: boolean;
};

type DemoAuctionState = {
  id: string;
  prizeCents: number;
  currentBidCents: number;
  minimumBidCents: number;
  suggestedBidIncrementsCents: number[];
  bonusCents: number;
  remainingSeconds: number;
  status: "live" | "urgent" | "closed";
  isCurrentUserLastBid: boolean;
  bids: DemoAuctionBid[];
};

export class AuctionConflictError extends Error {
  constructor(message: string, readonly statusCode: 402 | 403 | 409 = 409) {
    super(message);
    this.name = "AuctionConflictError";
  }
}

async function withTransaction<T>(
  operation: (client: PoolClient) => Promise<T>,
): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const result = await operation(client);
    await client.query("COMMIT");
    return result;
  } catch (error) {
    if (error instanceof AuctionConflictError) {
      await client.query("COMMIT");
    } else {
      await client.query("ROLLBACK");
    }
    throw error;
  } finally {
    client.release();
  }
}

async function lockAuction(client: PoolClient, now: Date): Promise<AuctionRow> {
  const initialEndsAt = new Date(now.getTime() + TIMER_MS);
  const inserted = await client.query<{ id: string }>(
    `INSERT INTO demo_auctions (
       id, prize_cents, current_bid_cents, bonus_cents, period_bid_cents,
       next_bonus_at, ends_at, status, last_bidder_id, last_bidder_name
     )
     VALUES ($1, $2, $3, 0, 0, $4, $5, 'live', $6, $7)
     ON CONFLICT (id) DO NOTHING
     RETURNING id`,
    [
      AUCTION_ID,
      PRIZE_CENTS,
      INITIAL_BID_CENTS,
      initialEndsAt,
      initialEndsAt,
      "demo-seed",
      "Outro participante",
    ],
  );

  if (inserted.rows.length > 0) {
    await client.query(
      `INSERT INTO demo_auction_bids
         (auction_id, bidder_id, bidder_name, amount_cents, created_at)
       VALUES ($1, $2, $3, $4, $5)`,
      [AUCTION_ID, "demo-seed", "Outro participante", INITIAL_BID_CENTS, now],
    );
  }

  const result = await client.query<AuctionRow>(
    `SELECT id, prize_cents, current_bid_cents, bonus_cents, period_bid_cents,
            next_bonus_at, ends_at, status, last_bidder_id, last_bidder_name
     FROM demo_auctions
     WHERE id = $1
     FOR UPDATE`,
    [AUCTION_ID],
  );
  const auction = result.rows[0];
  if (!auction) {
    throw new Error("The demonstration auction could not be initialized.");
  }
  return auction;
}

async function recordClosedAuctionWinner(
  client: PoolClient,
  auction: AuctionRow,
): Promise<void> {
  if (auction.status !== "closed" || auction.last_bidder_id === "demo-seed") return;
  const latestBidResult = await client.query<{ id: number; bidder_id: string }>(
    `SELECT id, bidder_id
     FROM demo_auction_bids
     WHERE auction_id = $1
     ORDER BY id DESC
     LIMIT 1`,
    [auction.id],
  );
  const latestBid = latestBidResult.rows[0];
  if (!latestBid || latestBid.bidder_id !== auction.last_bidder_id) return;

  await client.query(
    `INSERT INTO demo_auction_wins
       (auction_id, winning_bid_id, account_id, prize_cents, bonus_cents, pix_type, pix_key)
     VALUES (
       $1, $2, $3, $4, $5,
       (SELECT pix_type
        FROM demo_auction_wins
        WHERE account_id = $3 AND pix_key IS NOT NULL
        ORDER BY updated_at DESC, id DESC
        LIMIT 1),
       (SELECT pix_key
        FROM demo_auction_wins
        WHERE account_id = $3 AND pix_key IS NOT NULL
        ORDER BY updated_at DESC, id DESC
        LIMIT 1)
     )
     ON CONFLICT (winning_bid_id) DO NOTHING`,
    [
      auction.id,
      latestBid.id,
      latestBid.bidder_id,
      auction.prize_cents,
      auction.bonus_cents,
    ],
  );
}

async function applyElapsedTime(
  client: PoolClient,
  auction: AuctionRow,
  now: Date,
): Promise<AuctionRow> {
  if (auction.status === "closed") {
    await recordClosedAuctionWinner(client, auction);
    return auction;
  }

  const nowMs = now.getTime();
  const endsAtMs = auction.ends_at.getTime();
  let bonusCents = auction.bonus_cents;
  let periodBidCents = auction.period_bid_cents;
  let nextBonusAtMs = auction.next_bonus_at.getTime();

  // Bonus periods are independent of the bid countdown. Only complete periods
  // that ended before the auction itself are counted.
  while (nextBonusAtMs < endsAtMs && nextBonusAtMs <= nowMs) {
    bonusCents += Math.round((periodBidCents * BONUS_PERCENT) / 100);
    periodBidCents = 0;
    nextBonusAtMs += BONUS_PERIOD_MS;
  }

  const status = nowMs >= endsAtMs ? "closed" : "live";
  if (
    bonusCents === auction.bonus_cents &&
    periodBidCents === auction.period_bid_cents &&
    nextBonusAtMs === auction.next_bonus_at.getTime() &&
    status === auction.status
  ) {
    return auction;
  }

  const result = await client.query<AuctionRow>(
    `UPDATE demo_auctions
     SET bonus_cents = $2,
         period_bid_cents = $3,
         next_bonus_at = $4,
         status = $5,
         updated_at = $6
     WHERE id = $1
     RETURNING id, prize_cents, current_bid_cents, bonus_cents, period_bid_cents,
               next_bonus_at, ends_at, status, last_bidder_id, last_bidder_name`,
    [
      AUCTION_ID,
      bonusCents,
      periodBidCents,
      new Date(nextBonusAtMs),
      status,
      now,
    ],
  );
  const updated = result.rows[0];
  if (!updated) throw new Error("The demonstration auction state was not updated.");
  if (updated.status === "closed") {
    await recordClosedAuctionWinner(client, updated);
  }
  return updated;
}

async function getRecentBids(
  client: PoolClient,
  accountId: string,
): Promise<DemoAuctionBid[]> {
  const result = await client.query<BidRow>(
    `SELECT id, bidder_id, bidder_name, amount_cents, created_at
     FROM demo_auction_bids
     WHERE auction_id = $1
     ORDER BY id DESC
     LIMIT $2`,
    [AUCTION_ID, BID_HISTORY_LIMIT],
  );

  return result.rows.reverse().map((bid) => ({
    id: bid.id,
    bidderName: bid.bidder_name,
    amountCents: bid.amount_cents,
    createdAt: bid.created_at,
    isCurrentUser: bid.bidder_id === accountId,
  }));
}

function toAuctionState(
  auction: AuctionRow,
  bids: DemoAuctionBid[],
  now: Date,
  accountId: string,
): DemoAuctionState {
  const remainingSeconds =
    auction.status === "closed"
      ? 0
      : Math.max(0, Math.ceil((auction.ends_at.getTime() - now.getTime()) / 1000));

  return {
    id: auction.id,
    prizeCents: auction.prize_cents,
    currentBidCents: auction.current_bid_cents,
    minimumBidCents: auction.current_bid_cents + MIN_INCREMENT_CENTS,
    suggestedBidIncrementsCents: [5_000, 10_000, 20_000],
    bonusCents: auction.bonus_cents,
    remainingSeconds,
    status:
      auction.status === "closed"
        ? "closed"
        : remainingSeconds <= 10
          ? "urgent"
          : "live",
    isCurrentUserLastBid: auction.last_bidder_id === accountId,
    bids,
  };
}

export async function getDemoAuction(accountId: string): Promise<DemoAuctionState> {
  return withTransaction(async (client) => {
    const now = new Date();
    let auction = await lockAuction(client, now);
    auction = await applyElapsedTime(client, auction, now);
    const bids = await getRecentBids(client, accountId);
    return toAuctionState(auction, bids, now, accountId);
  });
}

export async function placeDemoAuctionBid(input: {
  accountId: string;
  amountCents: number;
}): Promise<DemoAuctionState> {
  return withTransaction(async (client) => {
    const now = new Date();
    let auction = await lockAuction(client, now);
    auction = await applyElapsedTime(client, auction, now);

    if (auction.status === "closed") {
      throw new AuctionConflictError("Este leilão já foi encerrado.");
    }
    const minimumBidCents = auction.current_bid_cents + MIN_INCREMENT_CENTS;
    if (input.amountCents < minimumBidCents) {
      throw new AuctionConflictError(
        `O lance mínimo é ${new Intl.NumberFormat("pt-BR", {
          style: "currency",
          currency: "BRL",
        }).format(minimumBidCents / 100)}.`,
      );
    }

    const accountResult = await client.query<{
      email: string | null;
      signed_in: boolean;
      credits_cents: number;
    }>(
      `SELECT email, signed_in, credits_cents
       FROM anonymous_accounts
       WHERE id = $1
       FOR UPDATE`,
      [input.accountId],
    );
    const account = accountResult.rows[0];
    if (!account) throw new Error("The anonymous account was not found.");
    if (!account.signed_in) {
      throw new AuctionConflictError("Entre para dar um lance.", 403);
    }
    if (account.credits_cents < input.amountCents) {
      throw new AuctionConflictError("Saldo insuficiente. Adicione créditos para continuar.", 402);
    }
    const bidderName =
      account.email?.split("@")[0].slice(0, 40) || "Participante";

    const endsAt = new Date(now.getTime() + TIMER_MS);
    await client.query(
      `INSERT INTO demo_auction_bids
         (auction_id, bidder_id, bidder_name, amount_cents, created_at)
       VALUES ($1, $2, $3, $4, $5)`,
      [
        AUCTION_ID,
        input.accountId,
        bidderName,
        input.amountCents,
        now,
      ],
    );
    await client.query(
      `UPDATE anonymous_accounts
       SET credits_cents = credits_cents - $2, updated_at = NOW()
       WHERE id = $1`,
      [input.accountId, input.amountCents],
    );
    await client.query(
      `INSERT INTO account_transactions (account_id, label, amount_cents, created_at)
       VALUES ($1, 'Lance no leilão', $2, $3)`,
      [input.accountId, -input.amountCents, now],
    );
    const updatedResult = await client.query<AuctionRow>(
      `UPDATE demo_auctions
       SET current_bid_cents = $2,
           period_bid_cents = period_bid_cents + $2,
           ends_at = $3,
           status = 'live',
           last_bidder_id = $4,
           last_bidder_name = $5,
           updated_at = $6
       WHERE id = $1
       RETURNING id, prize_cents, current_bid_cents, bonus_cents, period_bid_cents,
                 next_bonus_at, ends_at, status, last_bidder_id, last_bidder_name`,
      [
        AUCTION_ID,
        input.amountCents,
        endsAt,
        input.accountId,
        bidderName,
        now,
      ],
    );
    const updated = updatedResult.rows[0];
    if (!updated) throw new Error("The demonstration bid was not recorded.");

    const bids = await getRecentBids(client, input.accountId);
    return toAuctionState(updated, bids, now, input.accountId);
  });
}

export async function resetDemoAuction(accountId: string): Promise<DemoAuctionState> {
  return withTransaction(async (client) => {
    const now = new Date();
    let auction = await lockAuction(client, now);
    await resetAccountInTransaction(client, accountId);
    await client.query("DELETE FROM demo_auction_bids WHERE auction_id = $1", [
      AUCTION_ID,
    ]);

    const endsAt = new Date(now.getTime() + TIMER_MS);
    const updatedResult = await client.query<AuctionRow>(
      `UPDATE demo_auctions
       SET prize_cents = $2,
           current_bid_cents = $3,
           bonus_cents = 0,
           period_bid_cents = 0,
           next_bonus_at = $4,
           ends_at = $4,
           status = 'live',
           last_bidder_id = $5,
           last_bidder_name = $6,
           updated_at = $7
       WHERE id = $1
       RETURNING id, prize_cents, current_bid_cents, bonus_cents, period_bid_cents,
                 next_bonus_at, ends_at, status, last_bidder_id, last_bidder_name`,
      [
        AUCTION_ID,
        PRIZE_CENTS,
        INITIAL_BID_CENTS,
        endsAt,
        "demo-seed",
        "Outro participante",
        now,
      ],
    );
    const updated = updatedResult.rows[0];
    if (!updated) throw new Error("The demonstration auction could not be reset.");

    await client.query(
      `INSERT INTO demo_auction_bids
         (auction_id, bidder_id, bidder_name, amount_cents, created_at)
       VALUES ($1, $2, $3, $4, $5)`,
      [AUCTION_ID, "demo-seed", "Outro participante", INITIAL_BID_CENTS, now],
    );

    auction = updated;
    const bids = await getRecentBids(client, accountId);
    return toAuctionState(auction, bids, now, accountId);
  });
}
