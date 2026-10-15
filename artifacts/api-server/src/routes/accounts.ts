import { Router, type IRouter, type Request, type Response } from "express";
import {
  AdvanceAccountWithdrawalParams,
  AdvanceAccountWithdrawalResponse,
  CreateAccountTopUpBody,
  CreateAccountTopUpResponse,
  GetCurrentAccountResponse,
  RequestAccountWithdrawalBody,
  RequestAccountWithdrawalParams,
  RequestAccountWithdrawalResponse,
  SignOutAccountResponse,
  UpdateAccountProfileBody,
  UpdateAccountProfileResponse,
} from "@workspace/api-zod";
import {
  AccountActionError,
  advanceAccountWithdrawal,
  createAccountTopUp,
  getCurrentAccount,
  requestAccountWithdrawal,
  signOutAccount,
  updateAccountProfile,
} from "../lib/accounts";
import { getSessionAccount } from "../middleware/anonymous-session";

const router: IRouter = Router();

function respondWithAccountError(
  req: Request,
  res: Response,
  error: unknown,
): void {
  if (error instanceof AccountActionError) {
    res.status(error.statusCode).json({ error: error.message });
    return;
  }
  req.log.error({ err: error }, "Account operation failed");
  res.status(500).json({ error: "Não foi possível atualizar sua conta." });
}

router.get("/account/current", async (_req, res): Promise<void> => {
  try {
    const account = await getCurrentAccount(getSessionAccount(res).id);
    res.json(GetCurrentAccountResponse.parse(account));
  } catch (error) {
    _req.log.error({ err: error }, "Failed to load account");
    res.status(500).json({ error: "Não foi possível carregar sua conta." });
  }
});

router.post("/account/profile", async (req, res): Promise<void> => {
  const parsed = UpdateAccountProfileBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Informe um e-mail válido." });
    return;
  }
  try {
    const account = await updateAccountProfile(
      getSessionAccount(res).id,
      parsed.data.email,
    );
    res.json(UpdateAccountProfileResponse.parse(account));
  } catch (error) {
    respondWithAccountError(req, res, error);
  }
});

router.post("/account/sign-out", async (req, res): Promise<void> => {
  try {
    const account = await signOutAccount(getSessionAccount(res).id);
    res.json(SignOutAccountResponse.parse(account));
  } catch (error) {
    respondWithAccountError(req, res, error);
  }
});

router.post("/account/top-ups", async (req, res): Promise<void> => {
  const parsed = CreateAccountTopUpBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Escolha um pacote de recarga válido." });
    return;
  }
  try {
    const account = await createAccountTopUp(
      getSessionAccount(res).id,
      parsed.data.amountCents,
    );
    res.json(CreateAccountTopUpResponse.parse(account));
  } catch (error) {
    respondWithAccountError(req, res, error);
  }
});

router.post("/account/wins/:winId/withdrawal", async (req, res): Promise<void> => {
  const params = RequestAccountWithdrawalParams.safeParse(req.params);
  const body = RequestAccountWithdrawalBody.safeParse(req.body);
  if (!params.success || !body.success) {
    res.status(400).json({ error: "Informe uma chave Pix válida." });
    return;
  }
  try {
    const account = await requestAccountWithdrawal(
      getSessionAccount(res).id,
      params.data.winId,
      body.data.pixType,
      body.data.pixKey,
    );
    res.json(RequestAccountWithdrawalResponse.parse(account));
  } catch (error) {
    respondWithAccountError(req, res, error);
  }
});

router.post(
  "/account/wins/:winId/advance-withdrawal",
  async (req, res): Promise<void> => {
    const params = AdvanceAccountWithdrawalParams.safeParse(req.params);
    if (!params.success) {
      res.status(400).json({ error: "Informe um prêmio válido." });
      return;
    }
    try {
      const account = await advanceAccountWithdrawal(
        getSessionAccount(res).id,
        params.data.winId,
      );
      res.json(AdvanceAccountWithdrawalResponse.parse(account));
    } catch (error) {
      respondWithAccountError(req, res, error);
    }
  },
);

export default router;
