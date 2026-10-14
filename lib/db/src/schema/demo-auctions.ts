import { createInsertSchema } from "drizzle-zod";
import { integer, pgTable, serial, text, timestamp } from "drizzle-orm/pg-core";
import { z } from "zod/v4";

export type DemoAuctionStatus = "live" | "closed";

export const demoAuctionsTable = pgTable("demo_auctions", {
  id: text("id").primaryKey(),
  prizeCents: integer("prize_cents").notNull(),
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
  bidderId: text("bidder_id").notNull(),
  bidderName: text("bidder_name").notNull(),
  amountCents: integer("amount_cents").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
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
