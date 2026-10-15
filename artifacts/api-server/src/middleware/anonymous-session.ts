import { createHash, randomBytes, randomUUID } from "node:crypto";
import type { RequestHandler, Response } from "express";
import { pool } from "@workspace/db";

const COOKIE_NAME = "lance_session";
const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000;
const DEFAULT_CREDITS_CENTS = 25_000;

export type SessionAccount = {
  id: string;
  email: string | null;
  signedIn: boolean;
  creditsCents: number;
};

export function getSessionAccount(res: Response): SessionAccount {
  return res.locals.sessionAccount as SessionAccount;
}

function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

function readSessionToken(cookieHeader: string | undefined): string | null {
  const pair = cookieHeader
    ?.split(";")
    .map((cookie) => cookie.trim())
    .find((cookie) => cookie.startsWith(`${COOKIE_NAME}=`));
  const token = pair?.slice(COOKIE_NAME.length + 1);
  return token && /^[a-f0-9]{64}$/.test(token) ? token : null;
}

export const anonymousSession: RequestHandler = async (req, res, next) => {
  try {
    const token = readSessionToken(req.headers.cookie);
    if (token) {
      const result = await pool.query<{
        id: string;
        email: string | null;
        signed_in: boolean;
        credits_cents: number;
      }>(
        `SELECT a.id, a.email, a.signed_in, a.credits_cents
         FROM anonymous_sessions s
         JOIN anonymous_accounts a ON a.id = s.account_id
         WHERE s.token_hash = $1 AND s.expires_at > NOW()
         LIMIT 1`,
        [hashToken(token)],
      );
      const row = result.rows[0];
      if (row) {
        res.locals.sessionAccount = {
          id: row.id,
          email: row.email,
          signedIn: row.signed_in,
          creditsCents: row.credits_cents,
        } satisfies SessionAccount;
        next();
        return;
      }
    }

    const newToken = randomBytes(32).toString("hex");
    const accountId = randomUUID();
    const expiresAt = new Date(Date.now() + SESSION_TTL_MS);
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      await client.query(
        `INSERT INTO anonymous_accounts (id, email, signed_in, credits_cents)
         VALUES ($1, NULL, FALSE, $2)`,
        [accountId, DEFAULT_CREDITS_CENTS],
      );
      await client.query(
        `INSERT INTO anonymous_sessions (token_hash, account_id, expires_at)
         VALUES ($1, $2, $3)`,
        [hashToken(newToken), accountId, expiresAt],
      );
      await client.query("COMMIT");
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }

    res.cookie(COOKIE_NAME, newToken, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/api",
      maxAge: SESSION_TTL_MS,
    });
    res.locals.sessionAccount = {
      id: accountId,
      email: null,
      signedIn: false,
      creditsCents: DEFAULT_CREDITS_CENTS,
    } satisfies SessionAccount;
    next();
  } catch (error) {
    req.log.error({ err: error }, "Failed to initialize anonymous session");
    res.status(500).json({ error: "Não foi possível carregar sua conta." });
  }
};
