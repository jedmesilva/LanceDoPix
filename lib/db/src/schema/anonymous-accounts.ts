import { createInsertSchema } from "drizzle-zod";
import {
  boolean,
  integer,
  pgTable,
  serial,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { z } from "zod/v4";

export type PixKeyType = "CPF" | "Celular" | "E-mail" | "Aleatória";
export type AccountWithdrawalStatus =
  | "available"
  | "requested"
  | "under_review"
  | "paid";

export const anonymousAccountsTable = pgTable("anonymous_accounts", {
  id: text("id").primaryKey(),
  email: text("email"),
  signedIn: boolean("signed_in").notNull().default(true),
  creditsCents: integer("credits_cents").notNull().default(25_000),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const anonymousSessionsTable = pgTable("anonymous_sessions", {
  tokenHash: text("token_hash").primaryKey(),
  accountId: text("account_id")
    .notNull()
    .references(() => anonymousAccountsTable.id, { onDelete: "cascade" }),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const accountTransactionsTable = pgTable("account_transactions", {
  id: serial("id").primaryKey(),
  accountId: text("account_id")
    .notNull()
    .references(() => anonymousAccountsTable.id, { onDelete: "cascade" }),
  label: text("label").notNull(),
  amountCents: integer("amount_cents").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const demoAuctionWinsTable = pgTable(
  "demo_auction_wins",
  {
    id: serial("id").primaryKey(),
    auctionId: text("auction_id").notNull(),
    winningBidId: integer("winning_bid_id").notNull(),
    accountId: text("account_id")
      .notNull()
      .references(() => anonymousAccountsTable.id, { onDelete: "cascade" }),
    prizeCents: integer("prize_cents").notNull(),
    bonusCents: integer("bonus_cents").notNull(),
    withdrawalStatus: text("withdrawal_status")
      .$type<AccountWithdrawalStatus>()
      .notNull()
      .default("available"),
    pixType: text("pix_type").$type<PixKeyType>(),
    pixKey: text("pix_key"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("demo_auction_wins_bid_unique").on(table.winningBidId),
  ],
);

export const insertAnonymousAccountSchema = createInsertSchema(
  anonymousAccountsTable,
).omit({ createdAt: true, updatedAt: true });
export type AnonymousAccount = typeof anonymousAccountsTable.$inferSelect;

export const insertAnonymousSessionSchema = createInsertSchema(
  anonymousSessionsTable,
).omit({ createdAt: true });
export type AnonymousSession = typeof anonymousSessionsTable.$inferSelect;

export const insertAccountTransactionSchema = createInsertSchema(
  accountTransactionsTable,
).omit({ id: true, createdAt: true });
export type AccountTransaction = typeof accountTransactionsTable.$inferSelect;

export const insertDemoAuctionWinSchema = createInsertSchema(
  demoAuctionWinsTable,
).omit({ id: true, createdAt: true, updatedAt: true });
export type DemoAuctionWin = typeof demoAuctionWinsTable.$inferSelect;
