import { useEffect, useRef, useState } from 'react';
import { ArrowLeft, Check, ChevronRight, CircleHelp, LogIn, Moon, Plus, Sun, Trophy, X } from 'lucide-react';
import { QueryClient, QueryClientProvider, useQueryClient } from '@tanstack/react-query';
import { Route, Switch, Router as WouterRouter } from 'wouter';
import {
  getGetCurrentAccountQueryKey,
  getGetDemoAuctionQueryKey,
  useAdvanceAccountWithdrawal,
  useCreateAccountTopUp,
  useGetCurrentAccount,
  useGetDemoAuction,
  usePlaceDemoAuctionBid,
  useRequestAccountWithdrawal,
  useResetDemoAuction,
  useSignOutAccount,
  useUpdateAccountWinPixKey,
  useUpdateAccountProfile,
  type AccountTopUpInput,
  type AccountWinWithdrawalStatus,
  type PixKeyType,
} from '@workspace/api-client-react';

const money = (value: number) => Number.isFinite(value)
  ? value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
  : '—';
const isValidBidAmountCents = (value: unknown): value is number =>
  typeof value === 'number' && Number.isSafeInteger(value) && value > 0;
const timeLabel = (seconds: number) => `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`;
const withdrawalLabels: Record<AccountWinWithdrawalStatus, string> = {
  available: 'disponível',
  requested: 'Solicitado',
  under_review: 'Em análise',
  paid: 'Concluído',
};

function errorMessage(error: unknown, fallback: string): string {
  if (error && typeof error === 'object' && 'data' in error) {
    const data = (error as { data?: { error?: unknown } }).data;
    if (typeof data?.error === 'string') return data.error;
  }
  if (error instanceof Error) return error.message.replace(/^HTTP [^:]+:\s*/, '');
  return fallback;
}

function GoogleMark() {
  return <svg className="google-mark" viewBox="0 0 48 48" aria-hidden="true">
    <path fill="#4285F4" d="M43.6 24.5c0-1.4-.1-2.8-.4-4.2H24v8h11a9.4 9.4 0 0 1-4.1 6.2v5.2h6.7c3.9-3.6 6-8.8 6-15.2Z" />
    <path fill="#34A853" d="M24 44c5.5 0 10.1-1.8 13.5-4.8l-6.7-5.2c-1.8 1.2-4 1.9-6.8 1.9-5.2 0-9.6-3.5-11.2-8.2H5.9v5.4A20 20 0 0 0 24 44Z" />
    <path fill="#FBBC05" d="M12.8 27.7a12 12 0 0 1 0-7.4V15H5.9a20 20 0 0 0 0 18l6.9-5.3Z" />
    <path fill="#EA4335" d="M24 12.1c3 0 5.7 1 7.8 3.1l5.9-5.9C34.1 6 29.5 4 24 4A20 20 0 0 0 5.9 15l6.9 5.3c1.6-4.7 6-8.2 11.2-8.2Z" />
  </svg>;
}

function AnimatedBonus({ amount }: { amount: number }) {
  const [displayAmount, setDisplayAmount] = useState(0);
  const displayAmountRef = useRef(0);

  useEffect(() => {
    const fromAmount = displayAmountRef.current;
    if (amount <= fromAmount) {
      displayAmountRef.current = amount;
      setDisplayAmount(amount);
      return;
    }

    const duration = fromAmount === 0 ? 720 : 560;
    const difference = amount - fromAmount;
    let frame = 0;
    let startTime = 0;

    const animate = (now: number) => {
      if (startTime === 0) startTime = now;
      const progress = Math.min((now - startTime) / duration, 1);
      const easedProgress = 1 - Math.pow(1 - progress, 3);
      const nextAmount = fromAmount + difference * easedProgress;
      displayAmountRef.current = nextAmount;
      setDisplayAmount(nextAmount);

      if (progress < 1) frame = requestAnimationFrame(animate);
    };

    frame = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(frame);
  }, [amount]);

  return (
    <div className={`bonus-slot ${amount > 0 ? 'is-visible' : ''}`} aria-hidden={amount <= 0}>
      <div className="bonus-slot-inner">
        {amount > 0 && <p className="bonus" data-testid="value-bonus">
          <span key={amount} className="bonus-value">+ {money(displayAmount)}</span> de bônus
        </p>}
      </div>
    </div>
  );
}

const DEMO_GOOGLE_EMAIL = 'marina@email.com';

function Home() {
  const queryClient = useQueryClient();
  const accountQuery = useGetCurrentAccount({
    query: { queryKey: getGetCurrentAccountQueryKey(), refetchInterval: 2000 },
  });
  const account = accountQuery.data;
  const auctionQuery = useGetDemoAuction({
    query: {
      queryKey: getGetDemoAuctionQueryKey(),
      refetchInterval: 1000,
      enabled: Boolean(account),
    },
  });
  const placeBidMutation = usePlaceDemoAuctionBid();
  const resetAuctionMutation = useResetDemoAuction();
  const profileMutation = useUpdateAccountProfile();
  const signOutMutation = useSignOutAccount();
  const topUpMutation = useCreateAccountTopUp();
  const withdrawalMutation = useRequestAccountWithdrawal();
  const updateWinPixKeyMutation = useUpdateAccountWinPixKey();
  const advanceWithdrawalMutation = useAdvanceAccountWithdrawal();
  const auction = auctionQuery.data;
  const isAuctionLoading = !auction && (accountQuery.isLoading || auctionQuery.isLoading);
  const remaining = auction?.remainingSeconds ?? 0;
  const scheduledRemaining = auction?.scheduledRemainingSeconds ?? 0;
  const status = auction?.status ?? 'idle';
  const isAuctionOpen = status === 'live' || status === 'urgent';
  const minBid = (auction?.minimumBidCents ?? 0) / 100;
  const credits = (account?.creditsCents ?? 0) / 100;
  const signedIn = account?.signedIn ?? false;
  const topUpOptionsCents = account?.topUpOptionsCents ?? [];
  const latestBids = auction?.bids.slice().reverse().map((bid) => ({
    amount: bid.amountCents / 100,
    timestamp: new Date(String(bid.createdAt)).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
    dateTime: String(bid.createdAt),
    ownBid: bid.isCurrentUser,
  })) ?? [];
  const isOwnLatestBid = auction?.isCurrentUserLastBid ?? false;
  const winningBidId = auction?.bids.at(-1)?.id ?? null;
  const currentWin = account?.wins.find((win) => win.winningBidId === winningBidId) ?? null;
  const apiCurrentUserLastBidCents = auction?.currentUserLastBidAmountCents;
  const recentCurrentUserLastBidCents = auction?.bids.slice().reverse().find((bid) => bid.isCurrentUser)?.amountCents;
  const currentUserLastBidAmountCents =
    typeof apiCurrentUserLastBidCents === 'number' &&
    Number.isFinite(apiCurrentUserLastBidCents) &&
    apiCurrentUserLastBidCents > 0
      ? apiCurrentUserLastBidCents
      : typeof recentCurrentUserLastBidCents === 'number' &&
          Number.isFinite(recentCurrentUserLastBidCents) &&
          recentCurrentUserLastBidCents > 0
        ? recentCurrentUserLastBidCents
        : null;
  const hasParticipatedInCurrentAuction = currentUserLastBidAmountCents !== null;
  const [sheet, setSheet] = useState<'account' | 'statement' | 'topup' | 'signin' | 'win' | 'withdrawal' | 'rules' | null>(null);
  const sheetRef = useRef<HTMLElement | null>(null);
  const [selectedWinId, setSelectedWinId] = useState<number | null>(null);
  const selectedWin = selectedWinId === null
    ? currentWin
    : account?.wins.find((win) => win.id === selectedWinId) ?? null;
  const winningBid = auction?.bids.find((bid) => bid.id === selectedWin?.winningBidId) ?? null;
  const showSharedAuction = Boolean(
    auction &&
    (!signedIn || (hasParticipatedInCurrentAuction && !currentWin)),
  );
  const [topupStep, setTopupStep] = useState<1 | 2 | 3>(1);
  const [packageAmountCents, setPackageAmountCents] = useState(10_000);
  const [bidInput, setBidInput] = useState('');
  const [notice, setNotice] = useState('');
  const [bidNotice, setBidNotice] = useState('');
  const [emailInput, setEmailInput] = useState('marina@email.com');
  const [googleChooserOpen, setGoogleChooserOpen] = useState(false);
  const [pixType, setPixType] = useState<PixKeyType>('CPF');
  const [pixInput, setPixInput] = useState('');
  const [isEditingPixKey, setIsEditingPixKey] = useState(false);
  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    try {
      const savedTheme = localStorage.getItem('lance-do-pix-theme');
      if (savedTheme === 'light' || savedTheme === 'dark') return savedTheme;
      const legacyState = JSON.parse(localStorage.getItem('lance-do-pix-demo-v1') ?? 'null') as { theme?: string } | null;
      if (legacyState?.theme === 'light' || legacyState?.theme === 'dark') return legacyState.theme;
    } catch { /* Theme preference is optional. */ }
    return 'light';
  });
  const [announcement, setAnnouncement] = useState('');
  const lastAuctionSnapshotRef = useRef<{ winningBidId: number | null; status: string } | null>(null);
  const pageWasHiddenRef = useRef(false);
  const pendingWinBidIdRef = useRef<number | null>(null);
  const shownWinIdsRef = useRef(new Set<number>());
  const amount = Number(bidInput.replace(',', '.'));
  const amountValid = Number.isFinite(amount) && amount > 0;
  const bidAmountCents = Math.round(amount * 100);
  const bidMeetsMinimum = Boolean(auction && amountValid && bidAmountCents >= auction.minimumBidCents);
  const hasInsufficientBalanceNotice = bidNotice.toLowerCase().includes('saldo insuficiente');
  const bidExceedsCredits = Boolean(
    signedIn && account && bidMeetsMinimum && bidAmountCents > account.creditsCents,
  );
  const needsTopup = Boolean(
    signedIn && account && auction && isAuctionOpen &&
    (hasInsufficientBalanceNotice || bidExceedsCredits),
  );
  const bidFeedback = bidExceedsCredits && !hasInsufficientBalanceNotice
    ? 'Saldo insuficiente. Adicione créditos para continuar.'
    : bidNotice;
  const auctionState = status === 'urgent' ? 'urgent' : status;
  const prizeLabel = auction
    ? (auction.prizeCents / 100).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
    : '0,00';
  const bonusAmount = (auction?.bonusCents ?? 0) / 100;
  const userName = account?.email
    ? account.email.split('@')[0].split(/[._-]/).map((part) => part.charAt(0).toUpperCase() + part.slice(1)).join(' ')
    : 'Participante';
  const initials = userName.split(' ').map((part) => part[0]).join('').slice(0, 2).toUpperCase() || 'P';
  const withdrawalTitle = !selectedWin
    ? 'Resgate do prêmio'
    : selectedWin.withdrawalStatus === 'available'
      ? selectedWin.maskedPixKey
        ? isEditingPixKey ? 'Alterar chave Pix' : 'Confirmar resgate'
        : 'Informe sua chave Pix'
      : selectedWin.withdrawalStatus === 'paid' ? 'Resgate concluído' : 'Resgate em análise';

  useEffect(() => {
    try { localStorage.setItem('lance-do-pix-theme', theme); } catch { /* Theme preference is optional. */ }
  }, [theme]);

  useEffect(() => {
    if (!auction || !minBid) return;
    setBidInput((current) => {
      const value = Number(current.replace(',', '.'));
      return !current || !Number.isFinite(value) || value < minBid
        ? minBid.toFixed(2).replace('.', ',')
        : current;
    });
  }, [minBid, auction]);

  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark');
    document.documentElement.dataset.theme = theme;
  }, [theme]);

  useEffect(() => {
    if (!isAuctionOpen) return;
    if (remaining === 30) setAnnouncement('A disputa termina em 30 segundos.');
    if (remaining === 10) setAnnouncement('A disputa termina em 10 segundos.');
  }, [isAuctionOpen, remaining]);

  useEffect(() => {
    if (status === 'scheduled' && scheduledRemaining === 60) {
      setAnnouncement('Uma nova disputa foi programada para começar em um minuto.');
    }
  }, [scheduledRemaining, status]);

  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState !== 'visible') {
        pageWasHiddenRef.current = true;
        pendingWinBidIdRef.current = null;
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, []);

  useEffect(() => {
    if (!sheet) return undefined;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setSheet(null);
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [sheet]);

  useEffect(() => {
    if (sheet === 'account' || sheet === 'statement') {
      sheetRef.current?.scrollTo(0, 0);
    }
  }, [sheet]);

  useEffect(() => {
    if (!auction) return;

    const currentSnapshot = { winningBidId, status };
    if (document.visibilityState !== 'visible') {
      lastAuctionSnapshotRef.current = currentSnapshot;
      pageWasHiddenRef.current = true;
      pendingWinBidIdRef.current = null;
      return;
    }

    // After returning to the tab, use the next server snapshot as a baseline.
    // This prevents a close that happened while the user was away from opening the modal.
    if (pageWasHiddenRef.current) {
      lastAuctionSnapshotRef.current = currentSnapshot;
      pageWasHiddenRef.current = false;
      pendingWinBidIdRef.current = null;
      return;
    }

    const previousSnapshot = lastAuctionSnapshotRef.current;
    lastAuctionSnapshotRef.current = currentSnapshot;

    if (!previousSnapshot || previousSnapshot.winningBidId !== winningBidId) {
      pendingWinBidIdRef.current = null;
    } else if (
      (previousSnapshot.status === 'live' || previousSnapshot.status === 'urgent') &&
      status === 'scheduled' &&
      signedIn &&
      isOwnLatestBid &&
      winningBidId !== null
    ) {
      pendingWinBidIdRef.current = winningBidId;
      if (!currentWin) {
        void queryClient.invalidateQueries({ queryKey: getGetCurrentAccountQueryKey() });
      }
    }

    const pendingWinBidId = pendingWinBidIdRef.current;
    if (pendingWinBidId === null) return;
    if (pendingWinBidId !== winningBidId || status !== 'closed' || !signedIn || !isOwnLatestBid) {
      pendingWinBidIdRef.current = null;
      return;
    }
    if (!currentWin) return;
    if (shownWinIdsRef.current.has(currentWin.id)) {
      pendingWinBidIdRef.current = null;
      return;
    }

    pendingWinBidIdRef.current = null;
    shownWinIdsRef.current.add(currentWin.id);
    setSelectedWinId(currentWin.id);
    setSheet('win');
  }, [auction, auctionQuery.dataUpdatedAt, currentWin?.id, isOwnLatestBid, queryClient, signedIn, status, winningBidId]);

  function updateBid(value: number) {
    setBidInput((Math.round(value * 100) / 100).toFixed(2).replace('.', ','));
    setNotice('');
    setBidNotice('');
  }
  function openTopup(initialAmountCents?: number) {
    const options = account?.topUpOptionsCents ?? [];
    const defaultAmount = options.includes(10_000) ? 10_000 : options[0] ?? 10_000;
    setPackageAmountCents(
      initialAmountCents && options.includes(initialAmountCents)
        ? initialAmountCents
        : defaultAmount,
    );
    setTopupStep(1);
    setSheet('topup');
  }
  function openSignIn() {
    setGoogleChooserOpen(false);
    setNotice('');
    setSheet('signin');
  }
  function placeBid() {
    if (!signedIn) { openSignIn(); return; }
    if (!auction) { setBidNotice('Conectando à disputa. Tente novamente em instantes.'); return; }
    if (!amountValid) {
      setBidNotice('Informe um valor válido para o lance.');
      return;
    }
    setBidNotice('');
    placeBidMutation.mutate({
      data: {
        amountCents: Math.round(amount * 100),
      },
    }, {
      onSuccess: (updatedAuction) => {
        queryClient.setQueryData(getGetDemoAuctionQueryKey(), updatedAuction);
        void queryClient.invalidateQueries({ queryKey: getGetCurrentAccountQueryKey() });
        setBidInput((updatedAuction.minimumBidCents / 100).toFixed(2).replace('.', ','));
        setBidNotice('');
        setAnnouncement(`Lance de ${money(amount)} registrado. Restam ${updatedAuction.durationSeconds} segundos.`);
      },
      onError: (error) => {
        void queryClient.invalidateQueries({ queryKey: getGetDemoAuctionQueryKey() });
        void queryClient.invalidateQueries({ queryKey: getGetCurrentAccountQueryKey() });
        const message = errorMessage(error, 'Não foi possível registrar o lance.');
        setBidNotice(message);
      },
    });
  }
  function confirmTopup() {
    topUpMutation.mutate({
      data: { amountCents: packageAmountCents as AccountTopUpInput['amountCents'] },
    }, {
      onSuccess: (updatedAccount) => {
        queryClient.setQueryData(getGetCurrentAccountQueryKey(), updatedAccount);
        setTopupStep(3);
        setBidNotice('');
        setAnnouncement(`${money(packageAmountCents / 100)} em créditos adicionados.`);
      },
      onError: (error) => setNotice(errorMessage(error, 'Não foi possível adicionar créditos.')),
    });
  }
  function signIn(email = emailInput.trim(), viaGoogleDemo = false) {
    profileMutation.mutate({ data: { email } }, {
      onSuccess: (updatedAccount) => {
        queryClient.setQueryData(getGetCurrentAccountQueryKey(), updatedAccount);
        setGoogleChooserOpen(false);
        setSheet(viaGoogleDemo ? 'account' : null);
        setNotice('');
        setBidNotice('');
      },
      onError: (error) => setNotice(errorMessage(error, 'Informe um e-mail válido para continuar.')),
    });
  }
  function signOut() {
    signOutMutation.mutate(undefined, {
      onSuccess: (updatedAccount) => {
        queryClient.setQueryData(getGetCurrentAccountQueryKey(), updatedAccount);
        setSheet(null);
        setNotice('Você saiu da conta.');
      },
      onError: (error) => setNotice(errorMessage(error, 'Não foi possível sair da conta.')),
    });
  }
  function startWithdrawal() {
    if (!selectedWin) return;
    withdrawalMutation.mutate({
      winId: selectedWin.id,
      data: {},
    }, {
      onSuccess: (updatedAccount) => {
        queryClient.setQueryData(getGetCurrentAccountQueryKey(), updatedAccount);
        setPixInput('');
        setIsEditingPixKey(false);
        setNotice('');
        setAnnouncement('Solicitação de resgate registrada.');
      },
      onError: (error) => setNotice(errorMessage(error, 'Não foi possível solicitar o resgate.')),
    });
  }
  function updatePixKey() {
    if (!selectedWin) return;
    updateWinPixKeyMutation.mutate({
      winId: selectedWin.id,
      data: { pixType, pixKey: pixInput },
    }, {
      onSuccess: (updatedAccount) => {
        queryClient.setQueryData(getGetCurrentAccountQueryKey(), updatedAccount);
        setIsEditingPixKey(false);
        setPixInput('');
        setNotice('');
        setAnnouncement(selectedWin?.maskedPixKey ? 'Chave Pix atualizada.' : 'Chave Pix salva.');
      },
      onError: (error) => setNotice(errorMessage(error, 'Não foi possível alterar a chave Pix.')),
    });
  }
  function advanceWithdrawal() {
    if (!selectedWin) return;
    advanceWithdrawalMutation.mutate({ winId: selectedWin.id }, {
      onSuccess: (updatedAccount) => {
        queryClient.setQueryData(getGetCurrentAccountQueryKey(), updatedAccount);
      },
      onError: (error) => setNotice(errorMessage(error, 'Não foi possível atualizar o resgate.')),
    });
  }
  function resetDemo() {
    const confirmed = window.confirm('Isso reinicia a disputa compartilhada para todas as sessões e zera esta conta. Continuar?');
    if (!confirmed) return;
    resetAuctionMutation.mutate(undefined, {
      onSuccess: (resetAuction) => {
        queryClient.setQueryData(getGetDemoAuctionQueryKey(), resetAuction);
        void queryClient.invalidateQueries({ queryKey: getGetCurrentAccountQueryKey() });
        setTheme('light');
        setBidInput((resetAuction.minimumBidCents / 100).toFixed(2).replace('.', ','));
        setBidNotice('');
        setSelectedWinId(null);
        lastAuctionSnapshotRef.current = {
          winningBidId: resetAuction.bids.at(-1)?.id ?? null,
          status: resetAuction.status,
        };
        pendingWinBidIdRef.current = null;
        shownWinIdsRef.current.clear();
        setNotice('Disputa reiniciada.');
        setSheet(null);
      },
      onError: (error) => {
        setNotice(errorMessage(error, 'Não foi possível reiniciar a disputa.'));
      },
    });
  }
  function openWithdrawal(winId: number) {
    const win = account?.wins.find((item) => item.id === winId);
    setSelectedWinId(winId);
    setPixType(win?.pixType ?? 'CPF');
    setPixInput('');
    setIsEditingPixKey(false);
    setNotice('');
    setSheet('withdrawal');
  }
  function renderPixKeyFields(label: string) {
    return <>
      <div className="key-grid">{(['CPF', 'Celular', 'E-mail', 'Aleatória'] as PixKeyType[]).map((type) => <label className="key-choice" key={type}><input type="radio" name="pix-type" data-testid={`radio-pix-${type.toLowerCase()}`} checked={pixType === type} onChange={() => { setPixType(type); setPixInput(''); setNotice(''); }} /><span>{type}</span></label>)}</div>
      <div className="pix-key-field-heading">
        <label htmlFor="pix-key" className="pix-key-field-label">{label}</label>
        <p className="pix-key-field-help" id="pix-key-owner-note">A chave precisa estar no seu nome.</p>
      </div>
      <input id="pix-key" className="input-field" data-testid="input-pix-key" aria-describedby="pix-key-owner-note" autoComplete="off" inputMode={pixType === 'CPF' ? 'numeric' : pixType === 'Celular' ? 'tel' : pixType === 'E-mail' ? 'email' : 'text'} value={pixInput} placeholder={pixType === 'CPF' ? '000.000.000-00' : pixType === 'Celular' ? '(00) 00000-0000' : pixType === 'E-mail' ? 'seu@email.com' : 'Cole a chave aleatória'} onChange={(event) => setPixInput(event.target.value)} />
    </>;
  }

  return (
    <div className={`app-shell ${auctionState}`}>
      <header className="topbar">
        <div className="top-inner">
          <div className="brand" aria-label="Lance do Pix"><span className="brand-mark" aria-hidden="true" />Lance do Pix</div>
          <div className="head-actions">
            {signedIn && account && <button className="balance-chip" data-testid="button-balance" onClick={() => openTopup()} aria-label={`Saldo ${money(credits)}. Adicionar créditos`}><span data-testid="value-credits">{money(credits)}</span><span className="add"><Plus size={16} /></span></button>}
            {signedIn && account
              ? <button className={`avatar ${account.wins.some((win) => win.withdrawalStatus === 'available') ? 'pending' : ''}`} data-testid="button-account" onClick={() => { void accountQuery.refetch(); setSheet('account'); }} aria-label="Minha conta">{initials}</button>
              : <button className="secondary-btn sign-in" data-testid="button-signin-open" onClick={openSignIn}><LogIn size={16} /> Entrar</button>}
            <button className="close-btn" data-testid="button-theme" onClick={() => setTheme(theme === 'light' ? 'dark' : 'light')} aria-label={theme === 'light' ? 'Ativar tema escuro' : 'Ativar tema claro'}>{theme === 'light' ? <Moon size={17} /> : <Sun size={17} />}</button>
          </div>
        </div>
      </header>
      <main className="main-layout">
        <div className="auction-content">
          <section aria-labelledby="auction-title" aria-busy={isAuctionLoading}>
            <h1 className="hero-kicker" id="auction-title">
              {status === 'scheduled' ? 'Próxima disputa' : status === 'idle' ? 'Nenhuma disputa' : 'Prêmio em disputa'}
            </h1>
            <p className="lead">
              {status === 'scheduled'
                ? 'A próxima disputa começa em breve.'
                : status === 'idle'
                  ? 'Não há disputas em andamento nem programadas.'
                  : 'Quando o relógio zerar, o último lance leva o prêmio.'}
            </p>
            {(isAuctionLoading || status !== 'idle') && <p className="prize" data-testid="value-prize">
              <small>R$</small>
              {isAuctionLoading
                ? <span className="loading-skeleton prize-skeleton" role="status" data-testid="status-prize-loading"><span className="sr-only">Carregando valor do prêmio</span></span>
                : <span>{prizeLabel}</span>}
            </p>}
            {status !== 'scheduled' && status !== 'idle' && <AnimatedBonus amount={bonusAmount} />}
            {isAuctionLoading ? <div className="auction-live-status">
              <div className="auction-timer-panel">
                <div className="timer-row" role="timer" aria-label="Carregando dados da disputa" aria-busy="true" data-testid="status-countdown">
                  <span className="timer loading-skeleton timer-skeleton" aria-hidden="true" />
                  <span className="timer-label">Carregando disputa…</span>
                </div>
                <div className="progress-track" aria-hidden="true"><div className="loading-skeleton progress-skeleton" /></div>
              </div>
            </div> : status === 'scheduled' ? <div className="scheduled-start-panel">
              <div className="scheduled-start-copy">A próxima disputa começa em</div>
              <div className="scheduled-start-timer" role="timer" aria-label={`Início da próxima disputa em ${timeLabel(scheduledRemaining)}`} data-testid="status-scheduled-countdown">
                <span className="timer" aria-hidden="true">{timeLabel(scheduledRemaining)}</span>
                <span className="timer-label">até o início</span>
              </div>
            </div> : status === 'idle' ? <p className="empty-auction-state" role="status" data-testid="status-no-auction">
              Nenhuma disputa está acontecendo ou programada no momento.
            </p> : <div className="auction-live-status">
              <div className="auction-timer-panel">
                <div className="timer-row" role="timer" aria-label={`Tempo restante: ${timeLabel(remaining)}`} data-testid="status-countdown">
                  <span className="timer" aria-hidden="true">{timeLabel(remaining)}</span>
                  <span className="timer-label">{status === 'closed' ? 'disputa encerrada' : status === 'urgent' ? 'últimos segundos da disputa' : 'para encerrar a disputa'}</span>
                </div>
                <div className="progress-track" aria-hidden="true">
                  <div className="progress-fill" style={{ width: `${Math.min(100, remaining / Math.max(1, auction?.durationSeconds ?? 60) * 100)}%` }} />
                </div>
              </div>
            </div>}
            {(auctionQuery.isError || accountQuery.isError) && <p className="inline-error" role="alert">Não foi possível atualizar os dados agora. Tentando novamente…</p>}
          </section>
          {status !== 'idle' && <section className="bid-history-section" aria-labelledby="bids-title" aria-busy={isAuctionLoading}>
            <h2 id="bids-title" className="bid-section-title">Lances</h2>
            <ol className="bid-timeline" aria-live="polite" aria-busy={isAuctionLoading}>
              {isAuctionLoading && latestBids.length === 0 && Array.from({ length: 3 }, (_, index) => <li className="bid-timeline-row bid-timeline-row-skeleton" key={`loading-bid-${index}`} aria-hidden="true">
                <span className={`bid-timeline-marker ${index === 0 ? 'is-current' : ''}`} />
                <div className="bid-timeline-skeleton-content">
                  {index === 0 && <div className="bid-timeline-top">
                    <span className="loading-skeleton bid-skeleton-tag" />
                    <span className="loading-skeleton bid-skeleton-time" />
                  </div>}
                  <span className={`loading-skeleton bid-skeleton-amount ${index === 0 ? 'is-current' : ''}`} />
                </div>
              </li>)}
              {latestBids.slice(0, 3).map((bid, index) => {
                const isLatest = index === 0;
                const isWinner = isLatest && (status === 'closed' || status === 'scheduled');
                return <li
                  key={`${bid.timestamp}-${index}-${bid.amount}`}
                  className={`bid-timeline-row ${isLatest ? 'is-current' : ''}`}
                  aria-current={isLatest ? 'true' : undefined}
                  data-testid={`row-bid-${index}`}
                >
                  <span className={`bid-timeline-marker ${isLatest ? 'is-current' : ''} ${isWinner ? 'is-winner' : ''}`} aria-hidden="true">
                    {isWinner && <Check size={14} strokeWidth={3.4} />}
                  </span>
                  {isLatest ? <div className="bid-timeline-current">
                    <div className="bid-timeline-top">
                      <span className="bid-timeline-tag" data-testid="status-current-bid">{isWinner ? 'Lance vencedor' : 'Último lance'}</span>
                      <time className="bid-timeline-time" dateTime={bid.dateTime} data-testid="time-bid-0">{bid.timestamp}</time>
                    </div>
                    <strong className="bid-timeline-amount is-current" data-testid="value-bid-0">{money(bid.amount)}</strong>
                    {bid.ownBid && <span className="bid-timeline-status is-leading" data-testid="status-own-leading-bid">{isWinner ? 'Você venceu a disputa' : 'Você está ganhando a disputa'}</span>}
                  </div> : <div className="bid-timeline-history">
                    <div className="bid-timeline-history-info">
                      <strong className="bid-timeline-amount" data-testid={`value-bid-${index}`}>{money(bid.amount)}</strong>
                      {bid.ownBid && <span className="bid-timeline-status" data-testid={`status-own-bid-${index}`}>Seu lance foi superado</span>}
                    </div>
                    <time className="bid-timeline-time" dateTime={bid.dateTime} data-testid={`time-bid-${index}`}>{bid.timestamp}</time>
                  </div>}
                </li>;
              })}
              {!isAuctionLoading && latestBids.length === 0 && <li className="bid-timeline-empty">Nenhum lance ainda</li>}
            </ol>
          </section>}
        </div>
        <section className={`dock ${isAuctionOpen ? '' : 'dock-awaiting'}`} aria-label={isAuctionOpen ? 'Painel de lance' : 'Status da disputa'}>
          <div className="dock-heading">
            <div className="dock-eyebrow">{isAuctionOpen ? 'Seu próximo lance' : status === 'scheduled' ? 'Próxima disputa' : 'Aguardando disputa'}</div>
            <button className="rules-link" type="button" data-testid="button-auction-rules" aria-haspopup="dialog" onClick={() => setSheet('rules')}>
              <CircleHelp size={16} aria-hidden="true" />
              Como funciona
            </button>
          </div>
          {!isAuctionOpen ? <p className="dock-state-message" data-testid="status-auction-waiting">
            {status === 'scheduled'
              ? `A disputa começa em ${timeLabel(scheduledRemaining)}. O valor do primeiro lance será ${money((auction?.initialBidCents ?? 0) / 100)}.`
              : 'Os lances poderão ser feitos quando uma disputa estiver disponível.'}
          </p> : <>
          <div className="stepper">
            <button data-testid="button-bid-minus" aria-label="Diminuir lance" disabled={placeBidMutation.isPending || !auction} onClick={() => updateBid(Number.isFinite(amount) ? amount - (auction ? (auction.minimumBidCents - auction.currentBidCents) / 100 : 10) : minBid)}>-</button>
            <label className="amount-wrap"><span>R$</span><input data-testid="input-bid-amount" aria-label="Valor do lance em reais" inputMode="decimal" value={bidInput} disabled={placeBidMutation.isPending || !auction} onChange={(event) => { setBidInput(event.target.value.replace(/[^\d,.]/g, '')); setNotice(''); setBidNotice(''); }} /></label>
            <button data-testid="button-bid-plus" aria-label="Aumentar lance" disabled={placeBidMutation.isPending || !auction} onClick={() => updateBid((Number.isFinite(amount) ? amount : minBid) + (auction ? (auction.minimumBidCents - auction.currentBidCents) / 100 : 10))}>+</button>
          </div>
          <div className="quick-bids">{(auction?.suggestedBidIncrementsCents ?? []).map((valueCents) => <button key={valueCents} data-testid={`button-quick-${valueCents / 100}`} disabled={placeBidMutation.isPending || !auction} onClick={() => updateBid((Number.isFinite(amount) ? amount : minBid) + valueCents / 100)}>+{valueCents / 100}</button>)}</div>
          {auction && <p className="hint" role="status" aria-live="polite" data-testid="status-bid-hint">
            Lance mínimo: {money(minBid)}
          </p>}
          {!signedIn ? <button className="primary-btn" data-testid="button-signin-bid" onClick={openSignIn}>Entrar para dar lance</button> : <button className="primary-btn" data-testid="button-place-bid" onClick={needsTopup ? () => openTopup() : placeBid} disabled={(!amountValid && !needsTopup) || placeBidMutation.isPending || !auction || !account}>{placeBidMutation.isPending ? 'Registrando…' : needsTopup ? 'Adicionar créditos' : `Dar lance · ${Number.isFinite(amount) ? money(amount) : money(minBid)}`}</button>}
          {signedIn && bidFeedback && <p className="hint error" role="alert" aria-live="assertive" data-testid="status-bid-feedback">{bidFeedback}</p>}
          </>}
        </section>
      </main>
      <div className="sr-only" aria-live="polite" aria-atomic="true" data-testid="status-announcement">{announcement}</div>
      {sheet && <div className="overlay" onMouseDown={(event) => { if (event.target === event.currentTarget) setSheet(null); }} role="presentation">
        <section ref={sheetRef} className="sheet" role="dialog" aria-modal="true" aria-labelledby="dialog-title" data-testid={`dialog-${sheet}`}>
          {sheet === 'account' && signedIn && account ? <div className="sheet-head account-sheet-head">
            <div className="account-head">
              <span className="avatar account-avatar" aria-hidden="true">{initials}</span>
              <div className="account-identity">
                <strong className="account-name" id="dialog-title">{userName}</strong>
                <span className="muted">{account.email ?? 'Conta neste navegador'}</span>
              </div>
            </div>
            <button className="close-btn" data-testid="button-close-dialog" aria-label="Fechar" onClick={() => setSheet(null)}><X size={18} /></button>
          </div> : sheet === 'statement' ? <div className="sheet-head statement-sheet-head">
            <div className="statement-heading">
              <button className="statement-back" data-testid="button-statement-back" aria-label="Voltar para minha conta" onClick={() => setSheet('account')}>
                <ArrowLeft size={16} aria-hidden="true" /> Voltar
              </button>
              <h2 id="dialog-title">Extrato de movimentações</h2>
            </div>
            <button className="close-btn" data-testid="button-close-dialog" aria-label="Fechar" onClick={() => setSheet(null)}><X size={18} /></button>
          </div> : <div className={`sheet-head ${sheet === 'signin' ? 'signin-sheet-head' : ''}`}>
            {sheet === 'signin' ? <div className="signin-heading">
              <h2 id="dialog-title">Entre para dar lances</h2>
              {!googleChooserOpen && <p className="signin-description">Use seu e-mail para entrar ou criar sua conta.</p>}
            </div> : <h2 id="dialog-title">{sheet === 'account' ? signedIn ? 'Minha conta' : 'Disputa compartilhada' : sheet === 'topup' ? 'Adicionar créditos' : sheet === 'withdrawal' ? withdrawalTitle : sheet === 'rules' ? 'Como funciona a disputa' : 'Você ganhou!'}</h2>}
            <button className="close-btn" data-testid="button-close-dialog" aria-label="Fechar" onClick={() => setSheet(null)}><X size={18} /></button>
          </div>}
          {sheet === 'account' && <div>
            {signedIn ? <div className="account-balance">
                <span className="account-balance-label">Créditos</span>
                <strong data-testid="value-account-credits">{money(credits)}</strong>
                <button className="account-pill account-pill-topup" data-testid="button-account-topup" onClick={() => openTopup()}>
                  <Plus size={16} aria-hidden="true" />
                  Adicionar
                </button>
                <button className="account-statement-link" data-testid="button-account-statement" onClick={() => setSheet('statement')}>
                  <span className="account-statement-copy">
                    <strong>Ver extrato</strong>
                    <small>Recargas e lances da sua conta</small>
                  </span>
                  <ChevronRight size={18} aria-hidden="true" />
                </button>
              </div> : <div className="account-guest">
                <p className="muted">A disputa é compartilhada e fica visível para todos. Entre para dar lances e acessar sua conta.</p>
                <button className="primary-btn" data-testid="button-account-signin" onClick={openSignIn}>Entrar para dar lances</button>
              </div>}
            <h3 className="account-section">{signedIn ? 'Minhas disputas' : 'Disputa'}</h3>
            <ul className="account-list account-auction-list" data-testid="list-auction-history">
              {showSharedAuction && auction && <li
                className={`account-list-row account-list-auction-card ${hasParticipatedInCurrentAuction && !auction.isCurrentUserLastBid ? 'account-list-auction-card-outbid' : ''}`}
                data-testid="row-auction-current"
              >
                <div className="account-list-card-top">
                  <span className="account-list-label">Prêmio</span>
                  <span
                    className={`account-list-status ${status !== 'closed' && auction.isCurrentUserLastBid ? 'account-list-status-live' : 'account-list-status-muted'}`}
                    role="status"
                  >
                    {status === 'closed'
                      ? 'Disputa encerrada'
                      : auction.isCurrentUserLastBid
                        ? 'Você está ganhando'
                        : hasParticipatedInCurrentAuction
                          ? 'Lance superado'
                          : 'Disputa em andamento'}
                  </span>
                </div>
                <div className="account-list-prize-row">
                  <div className="account-list-prize-info">
                    <strong className="account-prize">{money(auction.prizeCents / 100)}</strong>
                    {auction.bonusCents > 0 && <span className="account-prize-bonus" data-testid="value-current-auction-bonus">
                      + {money(auction.bonusCents / 100)} de bônus
                    </span>}
                  </div>
                </div>
                {currentUserLastBidAmountCents !== null && <div className="account-list-bid">
                  <span>Seu lance</span>
                  <strong>{money(currentUserLastBidAmountCents / 100)}</strong>
                </div>}
              </li>}
              {signedIn && account?.wins.slice(0, showSharedAuction ? 3 : 4).map((win) => {
                const currentAuctionBidAmountCents = auction?.bids.find((bid) => bid.id === win.winningBidId)?.amountCents;
                const winningBidAmountCents =
                  isValidBidAmountCents(win.winningBidAmountCents)
                    ? win.winningBidAmountCents
                    : isValidBidAmountCents(currentAuctionBidAmountCents)
                      ? currentAuctionBidAmountCents
                      : null;
                const hasPrizeAvailable = win.withdrawalStatus === 'available';
                const hasPrizeBeenPaid = win.withdrawalStatus === 'paid';
                const withdrawalCardStatus = hasPrizeBeenPaid
                  ? 'Resgatado'
                  : win.withdrawalStatus === 'requested'
                    ? 'Resgate solicitado'
                    : withdrawalLabels[win.withdrawalStatus];

                return <li className="account-list-row account-list-auction-card" key={win.id} data-testid={`row-auction-win-${win.id}`}>
                  <div className="account-list-card-top">
                    <span className="account-list-label">Prêmio</span>
                    {hasPrizeAvailable
                      ? <span className="account-list-status account-list-status-live" role="status">Você ganhou</span>
                      : <button
                        className={`account-list-status account-list-status-button ${hasPrizeBeenPaid ? 'account-list-status-muted account-list-status-paid' : 'account-list-status-muted'}`}
                        data-testid="button-history-status"
                        aria-label={`Ver status do prêmio: ${withdrawalCardStatus}`}
                        onClick={() => openWithdrawal(win.id)}
                      >
                        {withdrawalCardStatus}
                      </button>}
                  </div>
                  <div className="account-list-prize-row">
                    <div className="account-list-prize-info">
                      <strong className="account-prize">{money(win.prizeCents / 100)}</strong>
                      {win.bonusCents > 0 && <span className="account-prize-bonus" data-testid={`value-auction-bonus-${win.id}`}>
                        + {money(win.bonusCents / 100)} de bônus
                      </span>}
                    </div>
                    {hasPrizeAvailable && <button
                      className="account-pill account-list-redeem auction-action"
                      data-testid="button-history-redeem"
                      aria-label={`Resgatar prêmio de ${money(win.prizeCents / 100)}`}
                      onClick={() => openWithdrawal(win.id)}
                    >
                      Resgatar
                    </button>}
                    {win.withdrawalStatus === 'requested' && <span className="account-list-action-status" role="status">
                      Em análise
                    </span>}
                  </div>
                  <div className={`account-list-bid ${winningBidAmountCents === null ? 'account-list-bid-missing' : ''}`}>
                    {winningBidAmountCents !== null ? <>
                      <span>{hasPrizeAvailable ? 'Seu lance vencedor' : 'Seu lance'}</span>
                      <strong>{money(winningBidAmountCents / 100)}</strong>
                    </> : <span>Valor do lance indisponível</span>}
                  </div>
                </li>;
              })}
              {signedIn && auction && !showSharedAuction && !account?.wins.length && <li className="account-empty">Você ainda não participou de nenhuma disputa.</li>}
              {!auction && !(signedIn && account?.wins.length) && <li className="account-empty">{accountQuery.isLoading || auctionQuery.isLoading ? 'Carregando a disputa compartilhada…' : accountQuery.isError || auctionQuery.isError ? 'Não foi possível carregar a disputa agora.' : 'Não há nenhuma disputa ativa no momento.'}</li>}
            </ul>
            {signedIn && <>
              <button className="danger-btn account-signout" data-testid="button-signout" onClick={signOut} disabled={signOutMutation.isPending}>Sair da conta</button>
              <button className="reset" data-testid="button-reset-demo" onClick={resetDemo} disabled={resetAuctionMutation.isPending}>{resetAuctionMutation.isPending ? 'Reiniciando…' : 'Reiniciar disputa (todas as sessões)'}</button>
            </>}
          </div>}
          {sheet === 'rules' && <div className="rules-content" data-testid="content-auction-rules">
            <ol className="rules-list">
              <li>
                <span className="rules-step-number" aria-hidden="true">01</span>
                <div><h3>Dê um lance acima do atual</h3><p>O próximo lance precisa ser pelo menos R$ 10,00 maior que o lance atual.</p></div>
              </li>
              <li>
                <span className="rules-step-number" aria-hidden="true">02</span>
                <div><h3>O relógio volta para 1 minuto</h3><p>Cada lance aceito reinicia o cronômetro.</p></div>
              </li>
              <li>
                <span className="rules-step-number" aria-hidden="true">03</span>
                <div><h3>O último lance vence</h3><p>Se ninguém der outro lance antes de o tempo zerar, quem deu o último lance leva o prêmio e o bônus, quando houver.</p></div>
              </li>
              <li>
                <span className="rules-step-number" aria-hidden="true">04</span>
                <div><h3>O resgate é separado</h3><p>Se vencer, você poderá solicitar o resgate do prêmio por uma chave Pix em seu nome, separado dos créditos.</p></div>
              </li>
            </ol>
          </div>}
          {sheet === 'statement' && <div>
            <ul className="account-list" data-testid="list-transactions">
              {account?.transactions.length
                ? account.transactions.map((tx) => <li className="account-list-row" key={tx.id} data-testid={`row-transaction-${tx.id}`}>
                  <span className="account-list-description">{tx.label === 'Lance no leilão' ? 'Lance na disputa' : tx.label}<small>{new Date(String(tx.createdAt)).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</small></span>
                  <span className={tx.amountCents > 0 ? 'account-amount-positive' : 'account-amount-negative'}>{tx.amountCents > 0 ? '+' : '−'}{money(Math.abs(tx.amountCents) / 100)}</span>
                </li>)
                : <li className="account-empty">Suas movimentações aparecerão aqui.</li>}
            </ul>
          </div>}
          {sheet === 'signin' && <div className="signin-content">
            {googleChooserOpen ? <>
              <div className="google-chooser">
                <div className="google-chooser-brand"><GoogleMark /><strong>Escolha uma conta</strong></div>
                <p className="muted">para continuar no Lance do Pix</p>
                <button className="google-account-option" data-testid="button-google-account-demo" onClick={() => { setEmailInput(DEMO_GOOGLE_EMAIL); signIn(DEMO_GOOGLE_EMAIL, true); }} disabled={profileMutation.isPending}>
                  <span className="google-account-avatar">M</span>
                  <span className="google-account-copy"><strong>Marina Oliveira</strong><small>{DEMO_GOOGLE_EMAIL}</small></span>
                  <span className="google-account-arrow" aria-hidden="true">›</span>
                </button>
                {notice && <p className="hint error" role="alert">{notice}</p>}
                <button className="google-alt-account" data-testid="button-google-another-account" onClick={() => setGoogleChooserOpen(false)}>Usar outro e-mail</button>
              </div>
            </> : <>
              <button className="google-btn" data-testid="button-google-login" onClick={() => setGoogleChooserOpen(true)} disabled={profileMutation.isPending}>
                <GoogleMark />
                Continuar com Google
              </button>
              <div className="auth-divider"><span>ou use seu e-mail</span></div>
              <label className="muted" htmlFor="email-demo">E-mail</label>
              <input id="email-demo" className="input-field" data-testid="input-email" type="email" autoComplete="email" value={emailInput} placeholder="seu@email.com" onChange={(event) => { setEmailInput(event.target.value); setNotice(''); }} />
              {notice && <p className="hint error" role="alert">{notice}</p>}
              <button className="primary-btn" data-testid="button-signin-confirm" onClick={() => signIn()} disabled={profileMutation.isPending}>{profileMutation.isPending ? 'Salvando…' : 'Continuar com e-mail'}</button>
            </>}
          </div>}
          {sheet === 'topup' && <div>
            {topupStep === 1 && <>
              <h3 className="sheet-section">Escolha o valor</h3><div className="package-grid">{topUpOptionsCents.map((valueCents) => <button className={`package-btn ${packageAmountCents === valueCents ? 'selected' : ''}`} key={valueCents} data-testid={`button-package-${valueCents / 100}`} aria-pressed={packageAmountCents === valueCents} onClick={() => setPackageAmountCents(valueCents)}>{money(valueCents / 100)}</button>)}</div>
              <button className="primary-btn" data-testid="button-generate-demo-code" onClick={() => { setNotice(''); setTopupStep(2); }}>Continuar · {money(packageAmountCents / 100)}</button>
            </>}
            {topupStep === 2 && <>
              <div className="qr-demo" role="img" aria-label="QR Code Pix" data-testid="image-demo-qr" /><div className="demo-code"><code data-testid="text-demo-code">LDP-PIX-{packageAmountCents / 100}-001</code><button className="secondary-btn" data-testid="button-copy-demo-code" onClick={() => { void navigator.clipboard?.writeText(`LDP-PIX-${packageAmountCents / 100}-001`); setAnnouncement('Código Pix copiado.'); }}>Copiar</button></div>
              {notice && <p className="hint error" role="alert">{notice}</p>}
              <button className="primary-btn" data-testid="button-simulate-confirmation" style={{ marginTop: 14 }} onClick={confirmTopup} disabled={topUpMutation.isPending}>{topUpMutation.isPending ? 'Confirmando…' : 'Confirmar recarga'}</button>
              <button className="reset" data-testid="button-topup-back" onClick={() => setTopupStep(1)}>Voltar e escolher outro valor</button>
            </>}
            {topupStep === 3 && <div style={{ textAlign: 'center' }}><div style={{ margin: '14px auto', width: 58, height: 58, borderRadius: 50, display: 'grid', placeItems: 'center', background: 'hsl(var(--primary))' }}><Check /></div><h3>Créditos adicionados</h3><p className="muted">{money(packageAmountCents / 100)} adicionados ao saldo.</p><button className="primary-btn" data-testid="button-topup-finish" onClick={() => setSheet(null)}>Voltar à disputa</button></div>}
          </div>}
          {sheet === 'win' && <div>
            <div style={{ display: 'grid', placeItems: 'center', margin: '6px auto 12px', width: 58, height: 58, borderRadius: '50%', background: 'hsl(var(--primary)/.14)', color: 'hsl(var(--primary))' }}><Trophy /></div>
            <p className="muted" data-testid="text-win-announcement">{winningBid ? `Seu lance de ${money(winningBid.amountCents / 100)} foi o último e levou esta disputa.` : 'Seu lance foi o último e levou esta disputa.'}</p>
            {selectedWin ? <>
              <div className="summary"><div className="summary-row"><span>Prêmio</span><strong>{money(selectedWin.prizeCents / 100)}</strong></div>{selectedWin.bonusCents > 0 && <div className="summary-row"><span>Bônus</span><strong>{money(selectedWin.bonusCents / 100)}</strong></div>}<div className="summary-row total"><span>Total</span><strong>{money((selectedWin.prizeCents + selectedWin.bonusCents) / 100)}</strong></div></div>
              <button className="primary-btn" data-testid="button-open-win-withdrawal" onClick={() => openWithdrawal(selectedWin.id)}>Resgatar</button>
              <button className="ghost-btn" data-testid="button-dismiss-win" style={{ width: '100%', marginTop: 8 }} onClick={() => setSheet(null)}>Agora não</button>
            </> : <p className="muted" role="status">Confirmando os dados do prêmio…</p>}
          </div>}
          {sheet === 'withdrawal' && <div>
            {selectedWin ? <>
              {selectedWin.withdrawalStatus === 'available' ? selectedWin.maskedPixKey && !isEditingPixKey ? <>
                <p className="muted withdrawal-note">Chave Pix cadastrada para este resgate:</p>
                <div className="summary">
                  <div className="summary-row pix-confirm-key">
                    <span><small>Chave Pix ({selectedWin.pixType ?? 'Pix'})</small><strong data-testid="value-saved-pix-key">{selectedWin.maskedPixKey}</strong></span>
                    <button className="pix-edit-link" data-testid="button-edit-pix-key" onClick={() => { setPixType(selectedWin.pixType ?? 'CPF'); setPixInput(''); setNotice(''); setIsEditingPixKey(true); }}>Alterar</button>
                  </div>
                  <div className="summary-row total"><span>Você recebe</span><strong>{money((selectedWin.prizeCents + selectedWin.bonusCents) / 100)}</strong></div>
                </div>
                {notice && <p className="hint error" role="alert">{notice}</p>}
                <button className="primary-btn" data-testid="button-request-withdrawal-saved-key" disabled={withdrawalMutation.isPending} onClick={startWithdrawal}>{withdrawalMutation.isPending ? 'Enviando…' : 'Confirmar resgate'}</button>
                <button className="ghost-btn" data-testid="button-cancel-withdrawal" style={{ width: '100%', marginTop: 8 }} onClick={() => setSheet(null)}>Cancelar</button>
              </> : <>
                <p className="muted withdrawal-note">{selectedWin.maskedPixKey ? 'Informe a nova chave Pix para este resgate.' : 'Informe uma chave Pix para este resgate.'}</p>
                {renderPixKeyFields(selectedWin.maskedPixKey ? 'Nova chave Pix' : 'Sua chave Pix')}
                {notice && <p className="hint error" role="alert">{notice}</p>}
                <button className="primary-btn" data-testid="button-save-pix-key" disabled={updateWinPixKeyMutation.isPending || !validPix(pixType, pixInput)} onClick={updatePixKey}>{updateWinPixKeyMutation.isPending ? 'Salvando…' : 'Salvar chave'}</button>
                <button className="ghost-btn" data-testid="button-cancel-pix-key" style={{ width: '100%', marginTop: 8 }} onClick={() => { setIsEditingPixKey(false); setPixInput(''); setPixType(selectedWin.pixType ?? 'CPF'); setNotice(''); if (!selectedWin.maskedPixKey) setSheet(null); }}>{selectedWin.maskedPixKey ? 'Voltar' : 'Cancelar'}</button>
              </> : <>
                <p className="muted withdrawal-note" data-testid="status-withdrawal-message">{selectedWin.withdrawalStatus === 'paid' ? `Resgate concluído. Valor: ${money((selectedWin.prizeCents + selectedWin.bonusCents) / 100)}. Chave Pix: ${selectedWin.maskedPixKey ?? '••••'}.` : 'Solicitação registrada. Acompanhe o status abaixo.'}</p>
                {notice && <p className="hint error" role="alert">{notice}</p>}
                <ol className="timeline" data-testid="list-withdrawal-timeline">{(['requested', 'under_review', 'paid'] as AccountWinWithdrawalStatus[]).map((status) => {
                  const order: AccountWinWithdrawalStatus[] = ['requested', 'under_review', 'paid'];
                  return <li key={status} className={order.indexOf(status) <= order.indexOf(selectedWin.withdrawalStatus) ? 'done' : ''} data-testid={`status-withdrawal-${status.replace('_', '-')}`}>{withdrawalLabels[status]}</li>;
                })}</ol>
                <button className="primary-btn" data-testid="button-close-withdrawal-status" onClick={() => setSheet(null)}>Fechar</button>
                {selectedWin.withdrawalStatus !== 'paid' && <button className="ghost-btn" style={{ width: '100%', marginTop: 8 }} data-testid="button-simulate-withdrawal-status" onClick={advanceWithdrawal} disabled={advanceWithdrawalMutation.isPending}>{advanceWithdrawalMutation.isPending ? 'Atualizando…' : 'Avançar status'}</button>}
              </>}
            </> : <p className="muted" role="status">Carregando os dados do resgate…</p>}
          </div>}
        </section>
      </div>}
    </div>
  );
}

function validPix(type: PixKeyType, value: string) {
  if (type === 'CPF') return value.replace(/\D/g, '').length === 11;
  if (type === 'Celular') return [10, 11].includes(value.replace(/\D/g, '').length);
  if (type === 'E-mail') return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
  return /^[0-9a-f]{8}-?[0-9a-f]{4}-?[0-9a-f]{4}-?[0-9a-f]{4}-?[0-9a-f]{12}$/i.test(value.trim());
}
function maskPix(type: PixKeyType, value: string) {
  if (type === 'CPF') return '•••.456.789-••';
  if (type === 'Celular') return value.length > 4 ? `${value.slice(0, 3)} •••••-${value.slice(-4)}` : '••••••••••';
  if (type === 'E-mail') {
    const [name, domain] = value.split('@');
    return domain ? `${name.slice(0, 2)}•••@${domain}` : '••••••@••••';
  }
  return value.length > 8 ? `${value.slice(0, 4)}••••••${value.slice(-4)}` : '••••••••';
}

const queryClient = new QueryClient();

function App() {
  return <QueryClientProvider client={queryClient}><WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, '')}><Switch><Route path="/" component={Home} /><Route><main className="main-layout"><h1>Página não encontrada</h1></main></Route></Switch></WouterRouter></QueryClientProvider>;
}

export default App;
