import { createInsertSchema } from "drizzle-zod";
import { boolean, index, integer, pgTable, serial, text, timestamp } from "drizzle-orm/pg-core";
import { z } from "zod/v4";

export type DemoAuctionStatus = "scheduled" | "live" | "closed";
export type DemoAuctionBidStatus =
  | "leading"
  | "outbid"
  | "won"
  | "closed_without_win"
  | "cancelled";

export const demoAuctionsTable = pgTable("demo_auctions", {
  id: text("id").primaryKey(),
  roundId: text("round_id").notNull().default("legacy"),
  prizeCents: integer("prize_cents").notNull(),
  durationSeconds: integer("duration_seconds").notNull().default(60),
  initialBidCents: integer("initial_bid_cents").notNull().default(10_000),
  startsAt: timestamp("starts_at", { withTimezone: true }).notNull().defaultNow(),
  currentBidCents: integer("current_bid_cents").notNull(),
  bonusCents: integer("bonus_cents").notNull().default(0),
  periodBidCents: integer("period_bid_cents").notNull().default(0),
  nextBonusAt: timestamp("next_bonus_at", { withTimezone: true }).notNull(),
  endsAt: timestamp("ends_at", { withTimezone: true }).notNull(),
  status: text("status").$type<DemoAuctionStatus>().notNull(),
  lastBidderId: text("last_bidder_id").notNull(),
  lastBidderName: text("last_bidder_name").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const demoAuctionBidsTable = pgTable("demo_auction_bids", {
  id: serial("id").primaryKey(),
  auctionId: text("auction_id").notNull().references(() => demoAuctionsTable.id, { onDelete: "cascade" }),
  roundId: text("round_id").notNull().default("legacy"),
  prizeCents: integer("prize_cents").notNull().default(100_000),
  bidStatus: text("bid_status").$type<DemoAuctionBidStatus>().notNull().default("outbid"),
  bidderId: text("bidder_id").notNull(),
  bidderName: text("bidder_name").notNull(),
  amountCents: integer("amount_cents").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  index("demo_auction_bids_round_id_id_idx").on(table.roundId, table.id),
  index("demo_auction_bids_bidder_id_id_idx").on(table.bidderId, table.id),
]);

export const demoAuctionSettingsTable = pgTable("demo_auction_settings", {
  id: text("id").primaryKey(),
  nextPrizeCents: integer("next_prize_cents").notNull().default(100_000),
  nextDurationSeconds: integer("next_duration_seconds").notNull().default(60),
  nextInitialBidCents: integer("next_initial_bid_cents").notNull().default(10_000),
  enabled: boolean("enabled").notNull().default(true),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertDemoAuctionSchema = createInsertSchema(demoAuctionsTable).omit({
  createdAt: true,
  updatedAt: true,
});
export type InsertDemoAuction = z.infer<typeof insertDemoAuctionSchema>;
export type DemoAuction = typeof demoAuctionsTable.$inferSelect;

export const insertDemoAuctionBidSchema = createInsertSchema(demoAuctionBidsTable).omit({
  id: true,
  createdAt: true,
});
export type InsertDemoAuctionBid = z.infer<typeof insertDemoAuctionBidSchema>;
export type DemoAuctionBid = typeof demoAuctionBidsTable.$inferSelect;

export const insertDemoAuctionSettingsSchema = createInsertSchema(demoAuctionSettingsTable);
export type InsertDemoAuctionSettings = z.infer<typeof insertDemoAuctionSettingsSchema>;
export type DemoAuctionSettings = typeof demoAuctionSettingsTable.$inferSelect;
