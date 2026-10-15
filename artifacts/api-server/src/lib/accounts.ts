import { pool } from "@workspace/db";
import type { PixKeyType } from "@workspace/db";

const DEFAULT_CREDITS_CENTS = 25_000;
export const TOP_UP_OPTIONS_CENTS = [5_000, 10_000, 20_000, 50_000] as const;

const connectClient = () => pool.connect();
type PoolClient = Awaited<ReturnType<typeof connectClient>>;

type AccountRow = {
  email: string | null;
  signed_in: boolean;
  credits_cents: number;
};

type TransactionRow = {
  id: number;
  label: string;
  amount_cents: number;
  created_at: Date;
};

type WinRow = {
  id: number;
  winning_bid_id: number;
  prize_cents: number;
  bonus_cents: number;
  withdrawal_status: "available" | "requested" | "under_review" | "paid";
  pix_type: PixKeyType | null;
  pix_key: string | null;
  created_at: Date;
};

export type CurrentAccountState = {
  signedIn: boolean;
  email: string | null;
  creditsCents: number;
  topUpOptionsCents: number[];
  transactions: Array<{
    id: number;
    label: string;
    amountCents: number;
    createdAt: Date;
  }>;
  wins: Array<{
    id: number;
    winningBidId: number;
    prizeCents: number;
    bonusCents: number;
    withdrawalStatus: WinRow["withdrawal_status"];
    pixType: PixKeyType | null;
    maskedPixKey: string | null;
    createdAt: Date;
  }>;
};

export class AccountActionError extends Error {
  constructor(
    message: string,
    readonly statusCode: 400 | 403 | 404 | 409,
  ) {
    super(message);
    this.name = "AccountActionError";
  }
}

async function readAccount(
  client: PoolClient,
  accountId: string,
): Promise<CurrentAccountState> {
  const accountResult = await client.query<AccountRow>(
    `SELECT email, signed_in, credits_cents
     FROM anonymous_accounts
     WHERE id = $1`,
    [accountId],
  );
  const account = accountResult.rows[0];
  if (!account) throw new Error("The anonymous account was not found.");

  const transactionResult = await client.query<TransactionRow>(
    `SELECT id, label, amount_cents, created_at
     FROM account_transactions
     WHERE account_id = $1
     ORDER BY id DESC
     LIMIT 30`,
    [accountId],
  );
  const winResult = await client.query<WinRow>(
    `SELECT id, winning_bid_id, prize_cents, bonus_cents,
            withdrawal_status, pix_type, pix_key, created_at
     FROM demo_auction_wins
     WHERE account_id = $1
     ORDER BY id DESC
     LIMIT 20`,
    [accountId],
  );

  return {
    signedIn: account.signed_in,
    email: account.email,
    creditsCents: account.credits_cents,
    topUpOptionsCents: [...TOP_UP_OPTIONS_CENTS],
    transactions: transactionResult.rows.map((row) => ({
      id: row.id,
      label: row.label,
      amountCents: row.amount_cents,
      createdAt: row.created_at,
    })),
    wins: winResult.rows.map((row) => ({
      id: row.id,
      winningBidId: row.winning_bid_id,
      prizeCents: row.prize_cents,
      bonusCents: row.bonus_cents,
      withdrawalStatus: row.withdrawal_status,
      pixType: row.pix_type,
      maskedPixKey: row.pix_key ? maskPixKey(row.pix_type, row.pix_key) : null,
      createdAt: row.created_at,
    })),
  };
}

function maskPixKey(type: PixKeyType | null, key: string): string {
  if (type === "CPF") {
    const digits = key.replace(/\D/g, "");
    return `•••.${digits.slice(3, 6)}.${digits.slice(6, 9)}-••`;
  }
  if (type === "Celular") {
    return `••••••${key.replace(/\D/g, "").slice(-4)}`;
  }
  if (type === "E-mail") {
    const [name = "", domain = ""] = key.split("@");
    return `${name.slice(0, 2)}•••@${domain}`;
  }
  return `${key.slice(0, 4)}••••••${key.slice(-4)}`;
}

function isValidPixKey(type: PixKeyType, key: string): boolean {
  const value = key.trim();
  if (type === "CPF") return value.replace(/\D/g, "").length === 11;
  if (type === "Celular") {
    const digits = value.replace(/\D/g, "");
    return digits.length >= 10 && digits.length <= 13;
  }
  if (type === "E-mail") return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
  return value.length >= 20 && value.length <= 100;
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
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

function requireSignedIn(account: AccountRow): void {
  if (!account.signed_in) {
    throw new AccountActionError("Entre para continuar.", 403);
  }
}

export function getCurrentAccount(accountId: string): Promise<CurrentAccountState> {
  return withTransaction((client) => readAccount(client, accountId));
}

export function updateAccountProfile(
  accountId: string,
  email: string,
): Promise<CurrentAccountState> {
  return withTransaction(async (client) => {
    await client.query(
      `UPDATE anonymous_accounts
       SET email = $2, signed_in = TRUE, updated_at = NOW()
       WHERE id = $1`,
      [accountId, email.trim().toLowerCase()],
    );
    return readAccount(client, accountId);
  });
}

export function signOutAccount(accountId: string): Promise<CurrentAccountState> {
  return withTransaction(async (client) => {
    await client.query(
      `UPDATE anonymous_accounts
       SET signed_in = FALSE, updated_at = NOW()
       WHERE id = $1`,
      [accountId],
    );
    return readAccount(client, accountId);
  });
}

export function createAccountTopUp(
  accountId: string,
  amountCents: number,
): Promise<CurrentAccountState> {
  return withTransaction(async (client) => {
    const accountResult = await client.query<AccountRow>(
      `SELECT email, signed_in, credits_cents
       FROM anonymous_accounts
       WHERE id = $1
       FOR UPDATE`,
      [accountId],
    );
    const account = accountResult.rows[0];
    if (!account) throw new Error("The anonymous account was not found.");
    requireSignedIn(account);
    if (!TOP_UP_OPTIONS_CENTS.includes(amountCents as (typeof TOP_UP_OPTIONS_CENTS)[number])) {
      throw new AccountActionError("Escolha um pacote de recarga válido.", 400);
    }

    await client.query(
      `UPDATE anonymous_accounts
       SET credits_cents = credits_cents + $2, updated_at = NOW()
       WHERE id = $1`,
      [accountId, amountCents],
    );
    await client.query(
      `INSERT INTO account_transactions (account_id, label, amount_cents)
       VALUES ($1, 'Créditos adicionados', $2)`,
      [accountId, amountCents],
    );
    return readAccount(client, accountId);
  });
}

export function requestAccountWithdrawal(
  accountId: string,
  winId: number,
  pixType: PixKeyType,
  pixKey: string,
): Promise<CurrentAccountState> {
  return withTransaction(async (client) => {
    const accountResult = await client.query<AccountRow>(
      `SELECT email, signed_in, credits_cents
       FROM anonymous_accounts
       WHERE id = $1
       FOR UPDATE`,
      [accountId],
    );
    const account = accountResult.rows[0];
    if (!account) throw new Error("The anonymous account was not found.");
    requireSignedIn(account);

    if (!isValidPixKey(pixType, pixKey)) {
      throw new AccountActionError("Informe uma chave Pix válida.", 400);
    }

    const winResult = await client.query<{ withdrawal_status: WinRow["withdrawal_status"] }>(
      `SELECT withdrawal_status
       FROM demo_auction_wins
       WHERE id = $1 AND account_id = $2
       FOR UPDATE`,
      [winId, accountId],
    );
    const win = winResult.rows[0];
    if (!win) throw new AccountActionError("Prêmio não encontrado.", 404);
    if (win.withdrawal_status !== "available") {
      throw new AccountActionError("O resgate já foi solicitado.", 409);
    }

    await client.query(
      `UPDATE demo_auction_wins
       SET withdrawal_status = 'requested',
           pix_type = $3,
           pix_key = $4,
           updated_at = NOW()
       WHERE id = $1 AND account_id = $2`,
      [winId, accountId, pixType, pixKey.trim()],
    );
    return readAccount(client, accountId);
  });
}

export function updateAccountWinPixKey(
  accountId: string,
  winId: number,
  pixType: PixKeyType,
  pixKey: string,
): Promise<CurrentAccountState> {
  return withTransaction(async (client) => {
    const accountResult = await client.query<AccountRow>(
      `SELECT email, signed_in, credits_cents
       FROM anonymous_accounts
       WHERE id = $1
       FOR UPDATE`,
      [accountId],
    );
    const account = accountResult.rows[0];
    if (!account) throw new Error("The anonymous account was not found.");
    requireSignedIn(account);

    if (!isValidPixKey(pixType, pixKey)) {
      throw new AccountActionError("Informe uma chave Pix válida.", 400);
    }

    const winResult = await client.query<{
      withdrawal_status: WinRow["withdrawal_status"];
      pix_key: string | null;
    }>(
      `SELECT withdrawal_status, pix_key
       FROM demo_auction_wins
       WHERE id = $1 AND account_id = $2
       FOR UPDATE`,
      [winId, accountId],
    );
    const win = winResult.rows[0];
    if (!win) throw new AccountActionError("Prêmio não encontrado.", 404);
    if (
      win.withdrawal_status === "available" ||
      win.withdrawal_status === "paid" ||
      !win.pix_key
    ) {
      throw new AccountActionError(
        "A chave Pix só pode ser alterada após solicitar o resgate e antes do pagamento.",
        409,
      );
    }

    await client.query(
      `UPDATE demo_auction_wins
       SET pix_type = $3, pix_key = $4, updated_at = NOW()
       WHERE id = $1 AND account_id = $2`,
      [winId, accountId, pixType, pixKey.trim()],
    );
    return readAccount(client, accountId);
  });
}

export function advanceAccountWithdrawal(
  accountId: string,
  winId: number,
): Promise<CurrentAccountState> {
  return withTransaction(async (client) => {
    const winResult = await client.query<{ withdrawal_status: WinRow["withdrawal_status"] }>(
      `SELECT withdrawal_status
       FROM demo_auction_wins
       WHERE id = $1 AND account_id = $2
       FOR UPDATE`,
      [winId, accountId],
    );
    const win = winResult.rows[0];
    if (!win) throw new AccountActionError("Prêmio não encontrado.", 404);

    const nextStatus =
      win.withdrawal_status === "requested"
        ? "under_review"
        : win.withdrawal_status === "under_review"
          ? "paid"
          : null;
    if (!nextStatus) {
      throw new AccountActionError("O status do resgate não pode avançar.", 409);
    }

    await client.query(
      `UPDATE demo_auction_wins
       SET withdrawal_status = $2, updated_at = NOW()
       WHERE id = $1 AND account_id = $3`,
      [winId, nextStatus, accountId],
    );
    return readAccount(client, accountId);
  });
}

export async function resetAccountInTransaction(
  client: PoolClient,
  accountId: string,
): Promise<void> {
  await client.query("DELETE FROM account_transactions WHERE account_id = $1", [
    accountId,
  ]);
  await client.query("DELETE FROM demo_auction_wins WHERE account_id = $1", [
    accountId,
  ]);
  await client.query(
    `UPDATE anonymous_accounts
     SET email = NULL, signed_in = TRUE, credits_cents = $2, updated_at = NOW()
     WHERE id = $1`,
    [accountId, DEFAULT_CREDITS_CENTS],
  );
}
