import { randomUUID } from "node:crypto";
import { pool } from "@workspace/db";
import { resetAccountInTransaction } from "./accounts";

const connectClient = () => pool.connect();
type PoolClient = Awaited<ReturnType<typeof connectClient>>;

const AUCTION_ID = "lance-do-pix-demo";
const DEFAULT_PRIZE_CENTS = 100_000;
const DEFAULT_INITIAL_BID_CENTS = 10_000;
const DEFAULT_DURATION_SECONDS = 60;
const SCHEDULE_DELAY_MS = 60_000;
const BONUS_PERIOD_MS = 60_000;
const BONUS_PERCENT = 10;
const MIN_INCREMENT_CENTS = 1_000;
const BID_HISTORY_LIMIT = 8;

type AuctionRow = {
  id: string;
  round_id: string;
  prize_cents: number;
  duration_seconds: number;
  initial_bid_cents: number;
  starts_at: Date;
  current_bid_cents: number;
  bonus_cents: number;
  period_bid_cents: number;
  next_bonus_at: Date;
  ends_at: Date;
  status: "scheduled" | "live" | "closed";
  last_bidder_id: string;
  last_bidder_name: string;
};

type SettingsRow = {
  next_prize_cents: number;
  next_duration_seconds: number;
  next_initial_bid_cents: number;
  enabled: boolean;
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
  durationSeconds: number;
  initialBidCents: number;
  currentBidCents: number;
  minimumBidCents: number;
  suggestedBidIncrementsCents: number[];
  bonusCents: number;
  remainingSeconds: number;
  scheduledRemainingSeconds: number;
  status: "live" | "urgent" | "closed" | "scheduled" | "idle";
  isCurrentUserLastBid: boolean;
  currentUserLastBidAmountCents: number | null;
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

async function lockAuctionManager(client: PoolClient): Promise<void> {
  await client.query("SELECT pg_advisory_xact_lock(hashtext($1))", [AUCTION_ID]);
}

async function getSettings(client: PoolClient, forUpdate = false): Promise<SettingsRow> {
  await client.query(
    `INSERT INTO demo_auction_settings (id)
     VALUES ($1)
     ON CONFLICT (id) DO NOTHING`,
    [AUCTION_ID],
  );
  const result = await client.query<SettingsRow>(
    `SELECT next_prize_cents, next_duration_seconds, next_initial_bid_cents, enabled
     FROM demo_auction_settings
     WHERE id = $1
     ${forUpdate ? "FOR UPDATE" : ""}`,
    [AUCTION_ID],
  );
  const settings = result.rows[0];
  if (!settings) throw new Error("The auction settings could not be initialized.");
  return settings;
}

async function findAuction(
  client: PoolClient,
  id: string,
  forUpdate = false,
): Promise<AuctionRow | null> {
  const result = await client.query<AuctionRow>(
    `SELECT id, round_id, prize_cents, duration_seconds, initial_bid_cents,
            starts_at, current_bid_cents, bonus_cents, period_bid_cents,
            next_bonus_at, ends_at, status, last_bidder_id, last_bidder_name
     FROM demo_auctions
     WHERE id = $1
     ${forUpdate ? "FOR UPDATE" : ""}`,
    [id],
  );
  return result.rows[0] ?? null;
}

async function getActiveAuction(client: PoolClient): Promise<AuctionRow | null> {
  const result = await client.query<AuctionRow>(
    `SELECT id, round_id, prize_cents, duration_seconds, initial_bid_cents,
            starts_at, current_bid_cents, bonus_cents, period_bid_cents,
            next_bonus_at, ends_at, status, last_bidder_id, last_bidder_name
     FROM demo_auctions
     WHERE status IN ('scheduled', 'live')
     ORDER BY CASE WHEN status = 'live' THEN 0 ELSE 1 END, created_at DESC
     LIMIT 1
     FOR UPDATE`,
  );
  return result.rows[0] ?? null;
}

async function getLatestClosedAuction(client: PoolClient): Promise<AuctionRow | null> {
  const result = await client.query<AuctionRow>(
    `SELECT id, round_id, prize_cents, duration_seconds, initial_bid_cents,
            starts_at, current_bid_cents, bonus_cents, period_bid_cents,
            next_bonus_at, ends_at, status, last_bidder_id, last_bidder_name
     FROM demo_auctions
     WHERE status = 'closed'
     ORDER BY ends_at DESC, created_at DESC
     LIMIT 1`,
  );
  return result.rows[0] ?? null;
}

async function getAuctionById(
  client: PoolClient,
  id: string,
  forUpdate = false,
): Promise<AuctionRow> {
  const auction = await findAuction(client, id, forUpdate);
  if (!auction) throw new Error("The auction round could not be loaded.");
  return auction;
}

async function createRound(
  client: PoolClient,
  config: { prizeCents: number; durationSeconds: number; initialBidCents: number },
  startsAt: Date,
  status: "scheduled" | "live",
): Promise<AuctionRow> {
  if (
    !Number.isSafeInteger(config.prizeCents) ||
    config.prizeCents < 0 ||
    !Number.isSafeInteger(config.durationSeconds) ||
    config.durationSeconds < 1 ||
    !Number.isSafeInteger(config.initialBidCents) ||
    config.initialBidCents < 1
  ) {
    throw new Error("The next auction round settings are invalid.");
  }
  const id = randomUUID();
  const durationSeconds = config.durationSeconds;
  const endsAt = new Date(startsAt.getTime() + durationSeconds * 1000);
  const isLive = status === "live";
  const result = await client.query<AuctionRow>(
    `INSERT INTO demo_auctions (
       id, round_id, prize_cents, duration_seconds, initial_bid_cents, starts_at,
       current_bid_cents, bonus_cents, period_bid_cents, next_bonus_at,
       ends_at, status, last_bidder_id, last_bidder_name
     )
     VALUES ($1, $2, $3, $4, $5, $6, $7, 0, 0, $8, $9, $10, $11, $12)
     RETURNING id, round_id, prize_cents, duration_seconds, initial_bid_cents,
               starts_at, current_bid_cents, bonus_cents, period_bid_cents,
               next_bonus_at, ends_at, status, last_bidder_id, last_bidder_name`,
    [
      id,
      id,
      config.prizeCents,
      durationSeconds,
      config.initialBidCents,
      startsAt,
      isLive ? config.initialBidCents : 0,
      new Date(startsAt.getTime() + BONUS_PERIOD_MS),
      endsAt,
      status,
      "demo-seed",
      "Outro participante",
    ],
  );
  const auction = result.rows[0];
  if (!auction) throw new Error("The auction round could not be created.");
  if (isLive) await addOpeningBid(client, auction, startsAt);
  return auction;
}

async function addOpeningBid(
  client: PoolClient,
  auction: AuctionRow,
  createdAt: Date,
): Promise<void> {
  await client.query(
    `INSERT INTO demo_auction_bids
       (auction_id, round_id, prize_cents, bidder_id, bidder_name, amount_cents, created_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7)`,
    [
      auction.id,
      auction.round_id,
      auction.prize_cents,
      "demo-seed",
      "Outro participante",
      auction.initial_bid_cents,
      createdAt,
    ],
  );
}

async function startScheduledAuction(
  client: PoolClient,
  auction: AuctionRow,
  now: Date,
): Promise<AuctionRow> {
  const endsAt = new Date(now.getTime() + auction.duration_seconds * 1000);
  const result = await client.query<AuctionRow>(
    `UPDATE demo_auctions
     SET starts_at = $2,
         current_bid_cents = initial_bid_cents,
         next_bonus_at = $3,
         ends_at = $4,
         status = 'live',
         updated_at = $2
     WHERE id = $1 AND status = 'scheduled'
     RETURNING id, round_id, prize_cents, duration_seconds, initial_bid_cents,
               starts_at, current_bid_cents, bonus_cents, period_bid_cents,
               next_bonus_at, ends_at, status, last_bidder_id, last_bidder_name`,
    [auction.id, now, new Date(now.getTime() + BONUS_PERIOD_MS), endsAt],
  );
  const started = result.rows[0];
  if (!started) throw new Error("The scheduled auction could not be started.");
  await addOpeningBid(client, started, now);
  return started;
}

async function scheduleNextAuction(
  client: PoolClient,
  now: Date,
  settings: SettingsRow,
): Promise<AuctionRow | null> {
  if (!settings.enabled) return null;
  const startsAt = new Date(now.getTime() + SCHEDULE_DELAY_MS);
  return createRound(
    client,
    {
      prizeCents: settings.next_prize_cents,
      durationSeconds: settings.next_duration_seconds,
      initialBidCents: settings.next_initial_bid_cents,
    },
    startsAt,
    "scheduled",
  );
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
  const nowMs = now.getTime();
  const endsAtMs = auction.ends_at.getTime();
  let bonusCents = auction.bonus_cents;
  let periodBidCents = auction.period_bid_cents;
  let nextBonusAtMs = auction.next_bonus_at.getTime();

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
     RETURNING id, round_id, prize_cents, duration_seconds, initial_bid_cents,
               starts_at, current_bid_cents, bonus_cents, period_bid_cents,
               next_bonus_at, ends_at, status, last_bidder_id, last_bidder_name`,
    [
      auction.id,
      bonusCents,
      periodBidCents,
      new Date(nextBonusAtMs),
      status,
      now,
    ],
  );
  const updated = result.rows[0];
  if (!updated) throw new Error("The auction state was not updated.");
  if (updated.status === "closed") await recordClosedAuctionWinner(client, updated);
  return updated;
}

async function syncCurrentAuction(
  client: PoolClient,
  now: Date,
): Promise<AuctionRow | null> {
  await lockAuctionManager(client);
  const settings = await getSettings(client, true);
  let auction = await getActiveAuction(client);

  if (auction?.status === "scheduled") {
    if (auction.starts_at.getTime() <= now.getTime()) {
      return startScheduledAuction(client, auction, now);
    }
    return auction;
  }

  if (auction?.status === "live") {
    auction = await applyElapsedTime(client, auction, now);
    if (auction.status === "live") return auction;
    await scheduleNextAuction(client, now, settings);
    return auction;
  }

  const latestClosed = await getLatestClosedAuction(client);
  if (latestClosed) {
    const scheduled = await scheduleNextAuction(client, now, settings);
    return scheduled;
  }

  if (!settings.enabled) return null;
  return createRound(
    client,
    {
      prizeCents: settings.next_prize_cents || DEFAULT_PRIZE_CENTS,
      durationSeconds: settings.next_duration_seconds || DEFAULT_DURATION_SECONDS,
      initialBidCents: settings.next_initial_bid_cents || DEFAULT_INITIAL_BID_CENTS,
    },
    now,
    "live",
  );
}

async function getRecentBids(
  client: PoolClient,
  auctionId: string,
  accountId: string,
): Promise<DemoAuctionBid[]> {
  const result = await client.query<BidRow>(
    `SELECT id, bidder_id, bidder_name, amount_cents, created_at
     FROM demo_auction_bids
     WHERE auction_id = $1
     ORDER BY id DESC
     LIMIT $2`,
    [auctionId, BID_HISTORY_LIMIT],
  );

  return result.rows.reverse().map((bid) => ({
    id: bid.id,
    bidderName: bid.bidder_name,
    amountCents: bid.amount_cents,
    createdAt: bid.created_at,
    isCurrentUser: bid.bidder_id === accountId,
  }));
}

async function getCurrentUserLastBidAmountCents(
  client: PoolClient,
  auctionId: string,
  accountId: string,
): Promise<number | null> {
  const result = await client.query<{ amount_cents: number }>(
    `SELECT amount_cents
     FROM demo_auction_bids
     WHERE auction_id = $1 AND bidder_id = $2
     ORDER BY id DESC
     LIMIT 1`,
    [auctionId, accountId],
  );
  return result.rows[0]?.amount_cents ?? null;
}

function toAuctionState(
  auction: AuctionRow,
  bids: DemoAuctionBid[],
  now: Date,
  accountId: string,
  currentUserLastBidAmountCents: number | null,
): DemoAuctionState {
  const remainingSeconds = auction.status === "live"
    ? Math.max(0, Math.ceil((auction.ends_at.getTime() - now.getTime()) / 1000))
    : 0;
  const scheduledRemainingSeconds = auction.status === "scheduled"
    ? Math.max(0, Math.ceil((auction.starts_at.getTime() - now.getTime()) / 1000))
    : 0;

  return {
    id: auction.id,
    prizeCents: auction.prize_cents,
    durationSeconds: auction.duration_seconds,
    initialBidCents: auction.initial_bid_cents,
    currentBidCents: auction.current_bid_cents,
    minimumBidCents: auction.status === "scheduled"
      ? auction.initial_bid_cents
      : auction.current_bid_cents + MIN_INCREMENT_CENTS,
    suggestedBidIncrementsCents: [5_000, 10_000, 20_000],
    bonusCents: auction.bonus_cents,
    remainingSeconds,
    scheduledRemainingSeconds,
    status: auction.status === "scheduled"
      ? "scheduled"
      : auction.status === "closed"
        ? "closed"
        : remainingSeconds <= 10
          ? "urgent"
          : "live",
    isCurrentUserLastBid: auction.last_bidder_id === accountId,
    currentUserLastBidAmountCents,
    bids,
  };
}

function idleAuctionState(): DemoAuctionState {
  return {
    id: "none",
    prizeCents: 0,
    durationSeconds: 0,
    initialBidCents: 0,
    currentBidCents: 0,
    minimumBidCents: 0,
    suggestedBidIncrementsCents: [],
    bonusCents: 0,
    remainingSeconds: 0,
    scheduledRemainingSeconds: 0,
    status: "idle",
    isCurrentUserLastBid: false,
    currentUserLastBidAmountCents: null,
    bids: [],
  };
}

async function stateForAuction(
  client: PoolClient,
  auction: AuctionRow,
  accountId: string,
  now: Date,
): Promise<DemoAuctionState> {
  let historyAuction = auction;
  if (auction.status === "scheduled") {
    historyAuction = (await getLatestClosedAuction(client)) ?? auction;
  }
  const bids = await getRecentBids(client, historyAuction.id, accountId);
  const lastBidAmount = await getCurrentUserLastBidAmountCents(
    client,
    historyAuction.id,
    accountId,
  );
  return toAuctionState(historyAuction === auction ? auction : {
    ...auction,
    last_bidder_id: historyAuction.last_bidder_id,
    last_bidder_name: historyAuction.last_bidder_name,
  }, bids, now, accountId, lastBidAmount);
}

export async function getDemoAuction(accountId: string): Promise<DemoAuctionState> {
  return withTransaction(async (client) => {
    const now = new Date();
    const auction = await syncCurrentAuction(client, now);
    if (!auction) return idleAuctionState();

    if (auction.status === "closed") {
      const settings = await getSettings(client);
      const next = await getActiveAuction(client);
      if (next?.status === "scheduled") {
        const scheduledState = await stateForAuction(client, next, accountId, now);
        return {
          ...scheduledState,
          isCurrentUserLastBid: auction.last_bidder_id === accountId,
          currentUserLastBidAmountCents: await getCurrentUserLastBidAmountCents(
            client,
            auction.id,
            accountId,
          ),
        };
      }
      if (settings.enabled) {
        const scheduled = await scheduleNextAuction(client, now, settings);
        if (scheduled) return stateForAuction(client, scheduled, accountId, now);
      }
      const bids = await getRecentBids(client, auction.id, accountId);
      const lastBidAmount = await getCurrentUserLastBidAmountCents(client, auction.id, accountId);
      return toAuctionState(auction, bids, now, accountId, lastBidAmount);
    }
    return stateForAuction(client, auction, accountId, now);
  });
}

export async function placeDemoAuctionBid(input: {
  accountId: string;
  amountCents: number;
}): Promise<DemoAuctionState> {
  return withTransaction(async (client) => {
    const now = new Date();
    const auction = await syncCurrentAuction(client, now);
    if (!auction || auction.status !== "live") {
      throw new AuctionConflictError(
        auction?.status === "scheduled"
          ? "A próxima disputa ainda está programada para começar."
          : "Não há disputa aberta para receber lances.",
      );
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

    const bidderName = account.email?.split("@")[0].slice(0, 40) || "Participante";
    const endsAt = new Date(now.getTime() + auction.duration_seconds * 1000);
    await client.query(
      `INSERT INTO demo_auction_bids
         (auction_id, round_id, prize_cents, bidder_id, bidder_name, amount_cents, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [
        auction.id,
        auction.round_id,
        auction.prize_cents,
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
       VALUES ($1, 'Lance na disputa', $2, $3)`,
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
       RETURNING id, round_id, prize_cents, duration_seconds, initial_bid_cents,
                 starts_at, current_bid_cents, bonus_cents, period_bid_cents,
                 next_bonus_at, ends_at, status, last_bidder_id, last_bidder_name`,
      [auction.id, input.amountCents, endsAt, input.accountId, bidderName, now],
    );
    const updated = updatedResult.rows[0];
    if (!updated) throw new Error("The bid was not recorded.");

    const bids = await getRecentBids(client, updated.id, input.accountId);
    return toAuctionState(updated, bids, now, input.accountId, input.amountCents);
  });
}

export async function resetDemoAuction(accountId: string): Promise<DemoAuctionState> {
  return withTransaction(async (client) => {
    const now = new Date();
    await lockAuctionManager(client);
    const settings = await getSettings(client, true);
    await resetAccountInTransaction(client, accountId);

    let auction = await getActiveAuction(client);
    if (!auction) {
      auction = await createRound(
        client,
        {
          prizeCents: settings.next_prize_cents || DEFAULT_PRIZE_CENTS,
          durationSeconds: settings.next_duration_seconds || DEFAULT_DURATION_SECONDS,
          initialBidCents: settings.next_initial_bid_cents || DEFAULT_INITIAL_BID_CENTS,
        },
        now,
        "live",
      );
    } else {
      await client.query("DELETE FROM demo_auction_bids WHERE auction_id = $1", [auction.id]);
      const endsAt = new Date(now.getTime() + auction.duration_seconds * 1000);
      const updatedResult = await client.query<AuctionRow>(
        `UPDATE demo_auctions
         SET current_bid_cents = initial_bid_cents,
             bonus_cents = 0,
             period_bid_cents = 0,
             starts_at = $2,
             next_bonus_at = $3,
             ends_at = $4,
             status = 'live',
             last_bidder_id = $5,
             last_bidder_name = $6,
             updated_at = $2
         WHERE id = $1
         RETURNING id, round_id, prize_cents, duration_seconds, initial_bid_cents,
                   starts_at, current_bid_cents, bonus_cents, period_bid_cents,
                   next_bonus_at, ends_at, status, last_bidder_id, last_bidder_name`,
        [
          auction.id,
          now,
          new Date(now.getTime() + BONUS_PERIOD_MS),
          endsAt,
          "demo-seed",
          "Outro participante",
        ],
      );
      auction = updatedResult.rows[0];
      if (!auction) throw new Error("The auction could not be reset.");
      await addOpeningBid(client, auction, now);
    }

    const bids = await getRecentBids(client, auction.id, accountId);
    return toAuctionState(auction, bids, now, accountId, null);
  });
}
