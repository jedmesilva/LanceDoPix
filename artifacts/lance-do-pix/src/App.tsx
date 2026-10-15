import { useEffect, useState } from 'react';
import { Check, ChevronDown, LogIn, Moon, Plus, Sun, Trophy, X } from 'lucide-react';
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

const money = (value: number) => value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const timeLabel = (seconds: number) => `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`;
const withdrawalLabels: Record<AccountWinWithdrawalStatus, string> = {
  available: 'disponível',
  requested: 'Solicitado',
  under_review: 'Em análise',
  paid: 'Pago',
};

function errorMessage(error: unknown, fallback: string): string {
  if (error && typeof error === 'object' && 'data' in error) {
    const data = (error as { data?: { error?: unknown } }).data;
    if (typeof data?.error === 'string') return data.error;
  }
  if (error instanceof Error) return error.message.replace(/^HTTP [^:]+:\s*/, '');
  return fallback;
}

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
  const remaining = auction?.remainingSeconds ?? 60;
  const status = auction?.status ?? 'live';
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
  const [sheet, setSheet] = useState<'account' | 'topup' | 'signin' | 'win' | 'withdrawal' | 'rules' | null>(null);
  const [selectedWinId, setSelectedWinId] = useState<number | null>(null);
  const selectedWin = selectedWinId === null
    ? currentWin
    : account?.wins.find((win) => win.id === selectedWinId) ?? null;
  const winningBid = auction?.bids.find((bid) => bid.id === selectedWin?.winningBidId) ?? null;
  const [topupStep, setTopupStep] = useState<1 | 2 | 3>(1);
  const [packageAmountCents, setPackageAmountCents] = useState(10_000);
  const [bidInput, setBidInput] = useState('');
  const [notice, setNotice] = useState('');
  const [emailInput, setEmailInput] = useState('marina@email.com');
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
  const [seenWinId, setSeenWinId] = useState<number | null>(null);
  const amount = Number(bidInput.replace(',', '.'));
  const amountValid = Number.isFinite(amount) && amount > 0;
  const auctionState = status === 'closed' ? 'closed' : status === 'urgent' ? 'urgent' : 'live';
  const prizeLabel = auction
    ? (auction.prizeCents / 100).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
    : '—';
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
      : selectedWin.withdrawalStatus === 'paid' ? 'Prêmio pago' : 'Resgate em análise';

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
    if (remaining === 30) setAnnouncement('Restam 30 segundos para encerrar.');
    if (remaining === 10) setAnnouncement('Últimos 10 segundos do leilão.');
    if (remaining === 0) setAnnouncement('Leilão encerrado.');
  }, [remaining]);

  useEffect(() => {
    if (!sheet) return undefined;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setSheet(null);
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [sheet]);

  useEffect(() => {
    if (status !== 'closed' || !isOwnLatestBid) return;

    setSheet('win');
    if (!currentWin) {
      void queryClient.invalidateQueries({ queryKey: getGetCurrentAccountQueryKey() });
      return;
    }
    if (seenWinId !== currentWin.id) {
      setSelectedWinId(currentWin.id);
      setSeenWinId(currentWin.id);
    }
  }, [status, isOwnLatestBid, currentWin?.id, seenWinId, queryClient]);

  function updateBid(value: number) {
    setBidInput((Math.round(value * 100) / 100).toFixed(2).replace('.', ','));
    setNotice('');
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
  function placeBid() {
    if (!signedIn) { setSheet('signin'); return; }
    if (!auction) { setNotice('Conectando ao leilão. Tente novamente em instantes.'); return; }
    if (!amountValid) {
      setNotice('Informe um valor válido para o lance.');
      return;
    }
    placeBidMutation.mutate({
      data: {
        amountCents: Math.round(amount * 100),
      },
    }, {
      onSuccess: (updatedAuction) => {
        queryClient.setQueryData(getGetDemoAuctionQueryKey(), updatedAuction);
        void queryClient.invalidateQueries({ queryKey: getGetCurrentAccountQueryKey() });
        setBidInput((updatedAuction.minimumBidCents / 100).toFixed(2).replace('.', ','));
        setNotice('Lance registrado. O cronômetro reiniciou.');
        setAnnouncement(`Lance de ${money(amount)} registrado. Restam 60 segundos.`);
      },
      onError: (error) => {
        void queryClient.invalidateQueries({ queryKey: getGetDemoAuctionQueryKey() });
        void queryClient.invalidateQueries({ queryKey: getGetCurrentAccountQueryKey() });
        const message = errorMessage(error, 'Não foi possível registrar o lance.');
        setNotice(message);
        if (message.toLowerCase().includes('saldo insuficiente')) openTopup();
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
        setAnnouncement(`${money(packageAmountCents / 100)} em créditos adicionados.`);
      },
      onError: (error) => setNotice(errorMessage(error, 'Não foi possível adicionar créditos.')),
    });
  }
  function signIn() {
    profileMutation.mutate({ data: { email: emailInput.trim() } }, {
      onSuccess: (updatedAccount) => {
        queryClient.setQueryData(getGetCurrentAccountQueryKey(), updatedAccount);
        setSheet(null);
        setNotice('');
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
    const confirmed = window.confirm('Isso reinicia o leilão compartilhado para todas as sessões e zera esta conta. Continuar?');
    if (!confirmed) return;
    resetAuctionMutation.mutate(undefined, {
      onSuccess: (resetAuction) => {
        queryClient.setQueryData(getGetDemoAuctionQueryKey(), resetAuction);
        void queryClient.invalidateQueries({ queryKey: getGetCurrentAccountQueryKey() });
        setTheme('light');
        setBidInput((resetAuction.minimumBidCents / 100).toFixed(2).replace('.', ','));
        setSelectedWinId(null);
        setSeenWinId(null);
        setNotice('Leilão reiniciado.');
        setSheet(null);
      },
      onError: (error) => {
        setNotice(errorMessage(error, 'Não foi possível reiniciar o leilão.'));
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
      <label htmlFor="pix-key" className="muted">{label}</label><input id="pix-key" className="input-field" data-testid="input-pix-key" aria-describedby="pix-key-owner-note" autoComplete="off" inputMode={pixType === 'CPF' ? 'numeric' : pixType === 'Celular' ? 'tel' : pixType === 'E-mail' ? 'email' : 'text'} value={pixInput} placeholder={pixType === 'CPF' ? '000.000.000-00' : pixType === 'Celular' ? '(00) 00000-0000' : pixType === 'E-mail' ? 'seu@email.com' : 'Cole a chave aleatória'} onChange={(event) => setPixInput(event.target.value)} />
    </>;
  }

  return (
    <div className={`app-shell ${auctionState}`}>
      <header className="topbar">
        <div className="top-inner">
          <div className="brand" aria-label="Lance do Pix"><span className="brand-mark" aria-hidden="true" />Lance do Pix</div>
          <div className="head-actions">
            {signedIn && account && <button className="balance-chip" data-testid="button-balance" onClick={() => openTopup()} aria-label={`Saldo ${money(credits)}. Adicionar créditos`}><span data-testid="value-credits">{money(credits)}</span><span className="add"><Plus size={16} /></span></button>}
            {signedIn ? <button className={`avatar ${account?.wins.some((win) => win.withdrawalStatus === 'available') ? 'pending' : ''}`} data-testid="button-account" onClick={() => setSheet('account')} aria-label="Minha conta">{initials}</button> : <button className="secondary-btn sign-in" data-testid="button-signin-open" onClick={() => setSheet('signin')}><LogIn size={16} /> Entrar</button>}
            <button className="close-btn" data-testid="button-theme" onClick={() => setTheme(theme === 'light' ? 'dark' : 'light')} aria-label={theme === 'light' ? 'Ativar tema escuro' : 'Ativar tema claro'}>{theme === 'light' ? <Moon size={17} /> : <Sun size={17} />}</button>
          </div>
        </div>
      </header>
      <main className="main-layout">
        <div className="auction-content">
          <section aria-labelledby="auction-title">
            <h1 className="hero-kicker" id="auction-title">Prêmio em disputa</h1>
            <p className="lead">O último lance leva</p>
            <p className="prize" data-testid="value-prize"><small>R$</small><span>{prizeLabel}</span></p>
            {bonusAmount > 0 && <p className="bonus" data-testid="value-bonus">+ {money(bonusAmount)} de bônus</p>}
            <div className="timer-row" role="timer" aria-label={`Tempo restante: ${timeLabel(remaining)}`} data-testid="status-countdown">
              <span className="timer" aria-hidden="true">{timeLabel(remaining)}</span>
              <span className="timer-label">{status === 'closed' ? 'leilão encerrado' : status === 'urgent' ? 'últimos segundos' : 'para encerrar'}</span>
            </div>
            <div className="progress-track" aria-hidden="true"><div className="progress-fill" style={{ width: `${remaining / 60 * 100}%` }} /></div>
            {(auctionQuery.isError || accountQuery.isError) && <p className="inline-error" role="alert">Não foi possível atualizar os dados agora. Tentando novamente…</p>}
          </section>
          <section aria-labelledby="bids-title">
            <h2 id="bids-title" className="sr-only">Últimos lances</h2>
            <ol className="bid-list" aria-live="polite">
              {latestBids.map((bid, index) => <li key={`${bid.timestamp}-${index}-${bid.amount}`} className={`bid-row ${index === 0 ? 'current' : ''}`} data-testid={`row-bid-${index}`}>
                {index === 0 ? <div className="bid-current">
                  <small data-testid="status-current-bid">{status === 'closed' ? 'Lance vencedor' : 'Lance atual'}{bid.ownBid ? ' - seu lance' : ''}</small>
                  <strong data-testid={`value-bid-${index}`}>{money(bid.amount)}</strong>
                </div> : <strong data-testid={`value-bid-${index}`}>{money(bid.amount)}</strong>}
                <time dateTime={bid.dateTime} data-testid={`time-bid-${index}`}>{bid.timestamp}</time>
              </li>)}
            </ol>
          </section>
          <details className="rules">
            <summary data-testid="toggle-rules">Como funciona <ChevronDown size={19} /></summary>
            <div className="rules-body"><p>Cada lance reinicia o cronômetro para 1 minuto.</p><p>Cada lance precisa superar o lance atual em pelo menos R$ 10,00.</p><p>Quando o tempo chega a zero, quem deu o último lance leva o prêmio, mais o bônus quando houver.</p><p>Se você ganhar, poderá solicitar o resgate separado dos créditos, para uma chave Pix em seu nome.</p></div>
          </details>
        </div>
        <section className="dock" aria-label="Painel de lance">
          <div className="dock-eyebrow">Seu próximo lance</div>
          <div className="stepper">
            <button data-testid="button-bid-minus" aria-label="Diminuir lance" disabled={status === 'closed' || placeBidMutation.isPending || !auction} onClick={() => updateBid(Number.isFinite(amount) ? amount - (auction ? (auction.minimumBidCents - auction.currentBidCents) / 100 : 10) : minBid)}>-</button>
            <label className="amount-wrap"><span>R$</span><input data-testid="input-bid-amount" aria-label="Valor do lance em reais" inputMode="decimal" value={bidInput} disabled={status === 'closed' || placeBidMutation.isPending || !auction} onChange={(event) => { setBidInput(event.target.value.replace(/[^\d,.]/g, '')); setNotice(''); }} /></label>
            <button data-testid="button-bid-plus" aria-label="Aumentar lance" disabled={status === 'closed' || placeBidMutation.isPending || !auction} onClick={() => updateBid((Number.isFinite(amount) ? amount : minBid) + (auction ? (auction.minimumBidCents - auction.currentBidCents) / 100 : 10))}>+</button>
          </div>
          <div className="quick-bids">{(auction?.suggestedBidIncrementsCents ?? []).map((valueCents) => <button key={valueCents} data-testid={`button-quick-${valueCents / 100}`} disabled={status === 'closed' || placeBidMutation.isPending || !auction} onClick={() => updateBid((Number.isFinite(amount) ? amount : minBid) + valueCents / 100)}>+{valueCents / 100}</button>)}</div>
          <p className={`hint ${notice.includes('insuficiente') || notice.includes('mínimo') ? 'error' : notice ? 'success' : ''}`} role="status" aria-live="polite" data-testid="status-bid-hint">
            {status === 'closed' ? (isOwnLatestBid ? 'Você deu o lance vencedor.' : 'O leilão foi encerrado sem um lance seu.') : !account ? 'Conectando à sua conta…' : !signedIn ? 'Entre para participar. Acompanhar o leilão não exige conta.' : notice || (placeBidMutation.isPending ? 'Registrando lance no servidor…' : `Lance mínimo: ${money(minBid)} · créditos: ${money(credits)}`)}
          </p>
          {status === 'closed' ? <button className="primary-btn" data-testid="button-auction-closed" disabled>Leilão encerrado</button> : !signedIn ? <button className="primary-btn" data-testid="button-signin-bid" onClick={() => setSheet('signin')}>Entrar para dar lance</button> : <button className="primary-btn" data-testid="button-place-bid" onClick={placeBid} disabled={!amountValid || placeBidMutation.isPending || !auction || !account}>{placeBidMutation.isPending ? 'Registrando…' : `Dar lance · ${Number.isFinite(amount) ? money(amount) : money(minBid)}`}</button>}
        </section>
      </main>
      <div className="sr-only" aria-live="polite" aria-atomic="true" data-testid="status-announcement">{announcement}</div>
      {sheet && <div className="overlay" onMouseDown={(event) => { if (event.target === event.currentTarget) setSheet(null); }} role="presentation">
        <section className="sheet" role="dialog" aria-modal="true" aria-labelledby="dialog-title" data-testid={`dialog-${sheet}`}>
          <div className="sheet-head">
            <h2 id="dialog-title">{sheet === 'account' ? 'Minha conta' : sheet === 'topup' ? 'Adicionar créditos' : sheet === 'signin' ? 'Entrar para dar lances' : sheet === 'withdrawal' ? withdrawalTitle : sheet === 'rules' ? 'Como funciona' : 'Você ganhou!'}</h2>
            <button className="close-btn" data-testid="button-close-dialog" aria-label="Fechar" onClick={() => setSheet(null)}><X size={18} /></button>
          </div>
          {sheet === 'account' && <div>
            {signedIn ? <>
              <div className="account-head"><span className="avatar">{initials}</span><div><div className="account-name">{userName}</div><div className="muted">{account?.email ?? 'Conta neste navegador'}</div></div></div>
              <div className="credit-card"><div><span className="muted">Créditos</span><strong data-testid="value-account-credits">{money(credits)}</strong></div><button className="primary-btn" style={{ width: 'auto' }} data-testid="button-account-topup" onClick={() => openTopup()}>Adicionar</button></div>
              <h3 className="sheet-section">Meus leilões</h3>
              <ul className="list" data-testid="list-auction-history">
                {account?.wins.length ? account.wins.map((win) => <li className="list-row" key={win.id}><span>Leilão<small>Prêmio {money((win.prizeCents + win.bonusCents) / 100)}</small></span><button className="secondary-btn" data-testid={win.withdrawalStatus === 'available' ? 'button-history-redeem' : 'button-history-status'} onClick={() => openWithdrawal(win.id)}>{win.withdrawalStatus === 'available' ? 'Resgatar' : withdrawalLabels[win.withdrawalStatus]}</button></li>) : <li className="no-items">Nenhum leilão encerrado.</li>}
                {auction && status !== 'closed' && <li className="list-row"><span>Leilão<small>Prêmio {money(auction.prizeCents / 100)}</small></span><span className="demo-tag">Em andamento</span></li>}
              </ul>
              <h3 className="sheet-section">Movimentações</h3>
              <ul className="list" data-testid="list-transactions">{account?.transactions.length ? account.transactions.map((tx) => <li className="list-row" key={tx.id} data-testid={`row-transaction-${tx.id}`}><span>{tx.label}<small>{new Date(String(tx.createdAt)).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</small></span><span className={tx.amountCents > 0 ? 'amount-positive' : 'amount-negative'}>{tx.amountCents > 0 ? '+' : '−'}{money(Math.abs(tx.amountCents) / 100)}</span></li>) : <li className="no-items">Suas movimentações aparecerão aqui.</li>}</ul>
              <button className="danger-btn" data-testid="button-signout" onClick={signOut} disabled={signOutMutation.isPending}>Sair da conta</button>
            </> : <div><p className="muted">Você saiu da conta.</p><button className="primary-btn" data-testid="button-account-signin" onClick={() => setSheet('signin')}>Entrar</button></div>}
            <button className="reset" data-testid="button-reset-demo" onClick={resetDemo} disabled={resetAuctionMutation.isPending}>{resetAuctionMutation.isPending ? 'Reiniciando…' : 'Reiniciar leilão (todas as sessões)'}</button>
          </div>}
          {sheet === 'signin' && <div><p className="muted">Use seu e-mail para identificar a conta neste navegador.</p><label className="muted" htmlFor="email-demo">E-mail</label><input id="email-demo" className="input-field" data-testid="input-email" type="email" autoComplete="email" value={emailInput} placeholder="seu@email.com" onChange={(event) => { setEmailInput(event.target.value); setNotice(''); }} />{notice && <p className="hint error">{notice}</p>}<button className="primary-btn" data-testid="button-signin-confirm" onClick={signIn} disabled={profileMutation.isPending}>{profileMutation.isPending ? 'Salvando…' : 'Continuar'}</button></div>}
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
            {topupStep === 3 && <div style={{ textAlign: 'center' }}><div style={{ margin: '14px auto', width: 58, height: 58, borderRadius: 50, display: 'grid', placeItems: 'center', background: 'hsl(var(--primary))' }}><Check /></div><h3>Créditos adicionados</h3><p className="muted">{money(packageAmountCents / 100)} adicionados ao saldo.</p><button className="primary-btn" data-testid="button-topup-finish" onClick={() => setSheet(null)}>Voltar ao leilão</button></div>}
          </div>}
          {sheet === 'win' && <div>
            <div style={{ display: 'grid', placeItems: 'center', margin: '6px auto 12px', width: 58, height: 58, borderRadius: '50%', background: 'hsl(var(--primary)/.14)', color: 'hsl(var(--primary))' }}><Trophy /></div>
            <p className="muted" data-testid="text-win-announcement">{winningBid ? `Seu lance de ${money(winningBid.amountCents / 100)} foi o último e levou este leilão.` : 'Seu lance foi o último e levou este leilão.'}</p>
            {selectedWin ? <>
              <div className="summary"><div className="summary-row"><span>Prêmio</span><strong>{money(selectedWin.prizeCents / 100)}</strong></div>{selectedWin.bonusCents > 0 && <div className="summary-row"><span>Bônus</span><strong>{money(selectedWin.bonusCents / 100)}</strong></div>}<div className="summary-row total"><span>Total</span><strong>{money((selectedWin.prizeCents + selectedWin.bonusCents) / 100)}</strong></div></div>
              <button className="primary-btn" data-testid="button-open-win-withdrawal" onClick={() => openWithdrawal(selectedWin.id)}>Resgatar</button>
              <button className="ghost-btn" data-testid="button-dismiss-win" style={{ width: '100%', marginTop: 8 }} onClick={() => setSheet(null)}>Agora não</button>
            </> : <p className="muted" role="status">Confirmando os dados do prêmio…</p>}
          </div>}
          {sheet === 'withdrawal' && <div>
            {selectedWin ? <>
              {selectedWin.withdrawalStatus === 'available' ? selectedWin.maskedPixKey && !isEditingPixKey ? <>
                <p className="muted">O valor será enviado para a chave Pix abaixo.</p>
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
                <p className="muted">{selectedWin.maskedPixKey ? 'Escolha o tipo e informe a nova chave que vai receber o prêmio.' : 'Escolha o tipo e informe a chave que vai receber o prêmio.'}</p>
                <p className="muted pix-key-note" id="pix-key-owner-note">A chave precisa estar no seu nome.</p>
                {renderPixKeyFields(selectedWin.maskedPixKey ? 'Nova chave Pix' : 'Sua chave Pix')}
                {notice && <p className="hint error" role="alert">{notice}</p>}
                <button className="primary-btn" data-testid="button-save-pix-key" disabled={updateWinPixKeyMutation.isPending || !validPix(pixType, pixInput)} onClick={updatePixKey}>{updateWinPixKeyMutation.isPending ? 'Salvando…' : 'Salvar chave'}</button>
                <button className="ghost-btn" data-testid="button-cancel-pix-key" style={{ width: '100%', marginTop: 8 }} onClick={() => { setIsEditingPixKey(false); setPixInput(''); setPixType(selectedWin.pixType ?? 'CPF'); setNotice(''); if (!selectedWin.maskedPixKey) setSheet(null); }}>{selectedWin.maskedPixKey ? 'Voltar' : 'Cancelar'}</button>
              </> : <>
                <p className="muted" data-testid="status-withdrawal-message">{selectedWin.withdrawalStatus === 'paid' ? `O Pix de ${money((selectedWin.prizeCents + selectedWin.bonusCents) / 100)} foi enviado para a chave ${selectedWin.maskedPixKey ?? '••••'}.` : 'Estamos conferindo os dados. Você será avisado quando o Pix for enviado.'}</p>
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
