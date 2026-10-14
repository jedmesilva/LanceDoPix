import { useEffect, useMemo, useState } from 'react';
import { Check, ChevronDown, LogIn, Moon, Plus, Sun, Trophy, X } from 'lucide-react';
import { QueryClient, QueryClientProvider, useQueryClient } from '@tanstack/react-query';
import { Route, Switch, Router as WouterRouter } from 'wouter';
import {
  getGetDemoAuctionQueryKey,
  useGetDemoAuction,
  usePlaceDemoAuctionBid,
  useResetDemoAuction,
} from '@workspace/api-client-react';

type Transaction = { label: string; amount: number; timestamp: string };
type PixType = 'CPF' | 'Celular' | 'E-mail' | 'Aleatória';
type WonAuction = { winningBidId: number; prize: number; bonus: number; withdrawal: 'disponível' | 'Solicitado' | 'Em análise' | 'Pago'; keyType: PixType; keyValue: string };
type DemoState = {
  bidderId: string; credits: number; signedIn: boolean; email: string;
  transactions: Transaction[]; wonAuction: WonAuction | null; theme: 'light' | 'dark'; seenWinBidId: number | null;
};

const STORAGE_KEY = 'lance-do-pix-demo-v1';
const initialState: DemoState = {
  bidderId: '', credits: 250, signedIn: true, email: 'marina@email.com',
  transactions: [], wonAuction: null, theme: 'light', seenWinBidId: null,
};
const PACKAGES = [50, 100, 200, 500];
const money = (value: number) => value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const timeLabel = (seconds: number) => `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`;
const stamp = () => new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
const packagesForGap = (gap: number) => PACKAGES.find((value) => value >= gap) ?? 500;
const createBidderId = () => `demo-${crypto.randomUUID()}`;

function readSaved(): DemoState {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      const saved = JSON.parse(stored) as Partial<DemoState>;
      return {
        ...initialState,
        ...saved,
        bidderId: saved.bidderId || createBidderId(),
      };
    }
  } catch { /* Start with a clean demo if saved data is invalid. */ }
  return { ...initialState, bidderId: createBidderId() };
}

function Home() {
  const [demo, setDemo] = useState<DemoState>(readSaved);
  const queryClient = useQueryClient();
  const auctionQuery = useGetDemoAuction({
    query: { queryKey: getGetDemoAuctionQueryKey(), refetchInterval: 1000 },
  });
  const placeBidMutation = usePlaceDemoAuctionBid();
  const resetAuctionMutation = useResetDemoAuction();
  const auction = auctionQuery.data;
  const remaining = auction?.remainingSeconds ?? 60;
  const status = auction?.status ?? 'live';
  const currentBid = (auction?.currentBidCents ?? 10_000) / 100;
  const minBid = currentBid + 10;
  const latestBids = auction?.bids.slice(-5).reverse().map((bid) => ({
    amount: bid.amountCents / 100,
    timestamp: new Date(String(bid.createdAt)).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
    ownBid: bid.bidderId === demo.bidderId,
    bidder: bid.bidderId === demo.bidderId ? 'Você' : bid.bidderName,
  })) ?? [];
  const isOwnLatestBid = auction?.lastBidderId === demo.bidderId;
  const winningBidId = auction?.bids.at(-1)?.id ?? null;
  const [sheet, setSheet] = useState<'account' | 'topup' | 'signin' | 'win' | 'rules' | null>(null);
  const [topupStep, setTopupStep] = useState<1 | 2 | 3>(1);
  const [packageAmount, setPackageAmount] = useState(100);
  const [bidInput, setBidInput] = useState('110');
  const [notice, setNotice] = useState('');
  const [emailInput, setEmailInput] = useState('marina@email.com');
  const [pixType, setPixType] = useState<PixType>('CPF');
  const [pixInput, setPixInput] = useState('123.456.789-00');
  const [theme, setTheme] = useState<'light' | 'dark'>(demo.theme);
  const [announcement, setAnnouncement] = useState('');

  useEffect(() => {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...demo, theme })); } catch { /* Local storage may be unavailable. */ }
  }, [demo, theme]);

  useEffect(() => {
    setBidInput((current) => {
      const value = Number(current.replace(',', '.'));
      return !Number.isFinite(value) || value < minBid
        ? minBid.toFixed(2).replace('.', ',')
        : current;
    });
  }, [minBid]);

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
    if (!auction || status !== 'closed' || auction.lastBidderId !== demo.bidderId || winningBidId === null) return;
    setDemo((current) => {
      if (current.wonAuction?.winningBidId === winningBidId) return current;
      return {
        ...current,
        wonAuction: {
          winningBidId,
          prize: auction.prizeCents / 100,
          bonus: auction.bonusCents / 100,
          withdrawal: 'disponível',
          keyType: 'CPF',
          keyValue: '•••.456.789-••',
        },
      };
    });
  }, [auction?.status, auction?.lastBidderId, auction?.prizeCents, auction?.bonusCents, demo.bidderId, status, winningBidId]);

  useEffect(() => {
    if (
      status === 'closed' &&
      isOwnLatestBid &&
      winningBidId !== null &&
      demo.wonAuction?.winningBidId === winningBidId &&
      demo.seenWinBidId !== winningBidId
    ) {
      const id = window.setTimeout(() => setSheet('win'), 900);
      setDemo((current) => ({ ...current, seenWinBidId: winningBidId }));
      return () => window.clearTimeout(id);
    }
    return undefined;
  }, [status, isOwnLatestBid, winningBidId, demo.wonAuction?.winningBidId, demo.seenWinBidId]);

  const amount = Number(bidInput.replace(',', '.'));
  const amountValid = Number.isFinite(amount) && amount >= minBid;
  const insufficient = demo.signedIn && amountValid && amount > demo.credits;
  const auctionState = status === 'closed' ? 'closed' : remaining <= 10 ? 'urgent' : 'live';
  const prizeLabel = ((auction?.prizeCents ?? 100_000) / 100).toLocaleString('pt-BR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  const bonusAmount = (auction?.bonusCents ?? 0) / 100;
  const maskedKey = useMemo(() => maskPix(pixType, pixInput), [pixType, pixInput]);
  const isValidPix = validPix(pixType, pixInput);
  const userName = demo.email.split('@')[0].split(/[._-]/).map((part) => part.charAt(0).toUpperCase() + part.slice(1)).join(' ') || 'Pessoa participante';

  function updateBid(value: number) {
    setBidInput(Math.max(minBid, Math.round(value * 100) / 100).toFixed(2).replace('.', ','));
    setNotice('');
  }
  function openTopup(initial?: number) {
    setPackageAmount(initial ?? 100);
    setTopupStep(1);
    setSheet('topup');
  }
  function placeBid() {
    if (!demo.signedIn) { setSheet('signin'); return; }
    if (!auction) { setNotice('Conectando ao leilão de demonstração. Tente novamente em instantes.'); return; }
    if (!amountValid) { setNotice(`O lance mínimo é ${money(minBid)}.`); return; }
    if (amount > demo.credits) {
      const gap = amount - demo.credits;
      setNotice(`Saldo insuficiente. Faltam ${money(gap)}.`);
      openTopup(packagesForGap(gap));
      return;
    }
    placeBidMutation.mutate({
      data: {
        bidderId: demo.bidderId,
        bidderName: userName.slice(0, 40),
        amountCents: Math.round(amount * 100),
      },
    }, {
      onSuccess: (updatedAuction) => {
        queryClient.setQueryData(getGetDemoAuctionQueryKey(), updatedAuction);
        const timestamp = stamp();
        setDemo((current) => ({
          ...current,
          credits: Math.round((current.credits - amount) * 100) / 100,
          transactions: [{ label: 'Lance no leilão · demonstração', amount: -amount, timestamp }, ...current.transactions],
        }));
        setBidInput(((updatedAuction.currentBidCents + 1_000) / 100).toFixed(2).replace('.', ','));
        setNotice('Lance de demonstração registrado. O cronômetro reiniciou.');
        setAnnouncement(`Lance de ${money(amount)} registrado. Restam 60 segundos.`);
      },
      onError: (error) => {
        void queryClient.invalidateQueries({ queryKey: getGetDemoAuctionQueryKey() });
        setNotice(error instanceof Error ? error.message.replace(/^HTTP [^:]+:\s*/, '') : 'Não foi possível registrar o lance.');
      },
    });
  }
  function confirmTopup() {
    setDemo((current) => ({
      ...current, credits: current.credits + packageAmount,
      transactions: [{ label: 'Créditos adicionados · demonstração', amount: packageAmount, timestamp: stamp() }, ...current.transactions],
    }));
    setTopupStep(3);
    setAnnouncement(`${money(packageAmount)} em créditos adicionados na demonstração.`);
  }
  function signIn() {
    const email = emailInput.trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { setNotice('Informe um e-mail válido para continuar.'); return; }
    setDemo((current) => ({ ...current, signedIn: true, email }));
    setSheet(null); setNotice('Conta de demonstração conectada.');
  }
  function signOut() {
    setDemo((current) => ({ ...current, signedIn: false }));
    setSheet(null); setNotice('Você saiu da conta de demonstração.');
  }
  function startWithdrawal() {
    if (!demo.wonAuction) return;
    setDemo((current) => ({
      ...current, wonAuction: current.wonAuction ? { ...current.wonAuction, withdrawal: 'Solicitado', keyType: pixType, keyValue: maskedKey } : null,
    }));
    setAnnouncement('Solicitação de resgate registrada na demonstração.');
  }
  function advanceWithdrawal() {
    setDemo((current) => {
      if (!current.wonAuction) return current;
      const next = current.wonAuction.withdrawal === 'Solicitado' ? 'Em análise' : 'Pago';
      return { ...current, wonAuction: { ...current.wonAuction, withdrawal: next } };
    });
  }
  function resetDemo() {
    const confirmed = window.confirm('Isso reinicia o leilão de demonstração compartilhado para todas as sessões e zera esta conta demonstrativa. Continuar?');
    if (!confirmed) return;
    resetAuctionMutation.mutate(undefined, {
      onSuccess: (resetAuction) => {
        queryClient.setQueryData(getGetDemoAuctionQueryKey(), resetAuction);
        setDemo({ ...initialState, bidderId: createBidderId(), transactions: [] });
        setTheme('light');
        setBidInput(((resetAuction.currentBidCents + 1_000) / 100).toFixed(2).replace('.', ','));
        setNotice('Demonstração compartilhada reiniciada.');
        setSheet(null);
      },
      onError: (error) => {
        setNotice(error instanceof Error ? error.message : 'Não foi possível reiniciar a demonstração.');
      },
    });
  }

  return (
    <div className={`app-shell ${auctionState}`}>
      <header className="topbar">
        <div className="top-inner">
          <div className="brand" aria-label="Lance do Pix"><span className="brand-mark" aria-hidden="true" />Lance do Pix</div>
          <div className="head-actions">
            <span className="demo-tag">Demonstração</span>
            {demo.signedIn && <button className="balance-chip" data-testid="button-balance" onClick={() => openTopup()} aria-label={`Saldo de demonstração ${money(demo.credits)}. Adicionar créditos`}><span data-testid="value-credits">{money(demo.credits)}</span><span className="add"><Plus size={16} /></span></button>}
            {demo.signedIn ? <button className={`avatar ${demo.wonAuction && demo.wonAuction.withdrawal === 'disponível' ? 'pending' : ''}`} data-testid="button-account" onClick={() => setSheet('account')} aria-label="Minha conta de demonstração">{userName.split(' ').map((part) => part[0]).join('').slice(0, 2).toUpperCase()}</button> : <button className="secondary-btn sign-in" data-testid="button-signin-open" onClick={() => setSheet('signin')}><LogIn size={16} /> Entrar</button>}
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
            <p className="muted" style={{ marginTop: 11 }}>{status === 'closed' ? 'Este leilão de demonstração foi encerrado.' : 'Leilão de demonstração · lances e bônus atualizados pelo servidor'}</p>
            {auctionQuery.isError && <p className="demo-warning" role="alert">Não foi possível atualizar o leilão agora. Tentando novamente…</p>}
          </section>
          <section aria-labelledby="bids-title">
            <h2 id="bids-title" className="section-head">{status === 'closed' ? 'Lances · Lance vencedor' : 'Lance atual'}</h2>
            <ol className="bid-list" aria-live="polite">
              {latestBids.map((bid, index) => <li key={`${bid.timestamp}-${index}-${bid.amount}`} className={`bid-row ${index === 0 ? 'current' : ''}`} data-testid={`row-bid-${index}`}>
                <span><span className="bid-label">{index === 0 && status === 'closed' ? 'Lance vencedor' : bid.bidder}</span>{bid.ownBid && <span className="own-bid">Seu lance</span>}</span>
                <span className="bid-amount" data-testid={`value-bid-${index}`}>{money(bid.amount)}</span>
              </li>)}
            </ol>
          </section>
          <details className="rules">
            <summary data-testid="toggle-rules">Como funciona <ChevronDown size={19} /></summary>
            <div className="rules-body"><p>Cada lance reinicia o cronômetro para 1 minuto.</p><p>Cada lance precisa superar o lance atual em pelo menos R$ 10,00.</p><p>Quando o tempo chega a zero, quem deu o último lance leva o prêmio, mais o bônus quando houver.</p><p>Se você ganhar, poderá solicitar o resgate separado dos créditos, para uma chave Pix em seu nome.</p><p><strong>Esta é uma demonstração.</strong> Os lances e bônus são processados pelo servidor; saldo, recargas e resgates são fictícios. Não há pagamento real nem aprovação legal.</p></div>
          </details>
        </div>
        <section className="dock" aria-label="Painel de lance">
          <div className="dock-eyebrow">Seu próximo lance</div>
          <div className="stepper">
            <button data-testid="button-bid-minus" aria-label="Diminuir lance em dez reais" disabled={status === 'closed' || placeBidMutation.isPending || !auction} onClick={() => updateBid(Number.isFinite(amount) ? amount - 10 : minBid)}>-</button>
            <label className="amount-wrap"><span>R$</span><input data-testid="input-bid-amount" aria-label="Valor do lance em reais" inputMode="decimal" value={bidInput} disabled={status === 'closed' || placeBidMutation.isPending || !auction} onChange={(event) => { setBidInput(event.target.value.replace(/[^\d,.]/g, '')); setNotice(''); }} /></label>
            <button data-testid="button-bid-plus" aria-label="Aumentar lance em dez reais" disabled={status === 'closed' || placeBidMutation.isPending || !auction} onClick={() => updateBid((Number.isFinite(amount) ? amount : minBid) + 10)}>+</button>
          </div>
          <div className="quick-bids">{[50, 100, 200].map((value) => <button key={value} data-testid={`button-quick-${value}`} disabled={status === 'closed' || placeBidMutation.isPending || !auction} onClick={() => updateBid((Number.isFinite(amount) ? amount : minBid) + value)}>+{value}</button>)}</div>
          <p className={`hint ${notice.includes('insuficiente') || notice.includes('mínimo') ? 'error' : notice ? 'success' : ''}`} role="status" aria-live="polite" data-testid="status-bid-hint">
            {status === 'closed' ? (isOwnLatestBid ? 'Você deu o lance vencedor.' : 'O leilão foi encerrado sem um lance seu.') : !demo.signedIn ? 'Entre para participar. Acompanhar o leilão não exige conta.' : notice || (placeBidMutation.isPending ? 'Registrando lance no servidor…' : insufficient ? `Saldo insuficiente. Faltam ${money(amount - demo.credits)}.` : `Lance mínimo: ${money(minBid)} · créditos: ${money(demo.credits)}`)}
          </p>
          {status === 'closed' && isOwnLatestBid && demo.wonAuction ? <button className="primary-btn" data-testid="button-claim-prize" onClick={() => { setSheet('win'); }}>Receber prêmio via Pix</button> : status === 'closed' ? <button className="primary-btn" data-testid="button-auction-closed" disabled>Leilão encerrado</button> : !demo.signedIn ? <button className="primary-btn" data-testid="button-signin-bid" onClick={() => setSheet('signin')}>Entrar para dar lance</button> : insufficient ? <button className="primary-btn" data-testid="button-add-insufficient" onClick={() => openTopup(packagesForGap(amount - demo.credits))}>Adicionar créditos</button> : <button className="primary-btn" data-testid="button-place-bid" onClick={placeBid} disabled={!amountValid || placeBidMutation.isPending || !auction}>{placeBidMutation.isPending ? 'Registrando…' : `Dar lance · ${Number.isFinite(amount) ? money(amount) : money(minBid)}`}</button>}
          <p className="footer-note">DEMONSTRAÇÃO · sem movimentação financeira real</p>
        </section>
      </main>
      <div className="sr-only" aria-live="polite" aria-atomic="true" data-testid="status-announcement">{announcement}</div>
      {sheet && <div className="overlay" onMouseDown={(event) => { if (event.target === event.currentTarget) setSheet(null); }} role="presentation">
        <section className="sheet" role="dialog" aria-modal="true" aria-labelledby="dialog-title" data-testid={`dialog-${sheet}`}>
          <div className="sheet-head">
            <h2 id="dialog-title">{sheet === 'account' ? 'Minha conta' : sheet === 'topup' ? 'Adicionar créditos' : sheet === 'signin' ? 'Entrar para dar lances' : sheet === 'rules' ? 'Como funciona' : 'Você ganhou!'}</h2>
            <button className="close-btn" data-testid="button-close-dialog" aria-label="Fechar" onClick={() => setSheet(null)}><X size={18} /></button>
          </div>
          {sheet === 'account' && <div>
            {demo.signedIn ? <>
              <div className="account-head"><span className="avatar">{userName.split(' ').map((part) => part[0]).join('').slice(0, 2).toUpperCase()}</span><div><div className="account-name">{userName}</div><div className="muted">{demo.email}</div></div><span className="demo-tag">DEMO</span></div>
              <div className="demo-warning">Conta, saldo e movimentações são dados locais de demonstração. Não representam dinheiro real.</div>
              <div className="credit-card"><div><span className="muted">Créditos</span><strong data-testid="value-account-credits">{money(demo.credits)}</strong></div><button className="primary-btn" style={{ width: 'auto' }} data-testid="button-account-topup" onClick={() => openTopup()}>Adicionar</button></div>
              <h3 className="sheet-section">Meus leilões</h3>
              <ul className="list" data-testid="list-auction-history">
                {demo.wonAuction ? <li className="list-row"><span>Leilão de demonstração<small>Prêmio {money(demo.wonAuction.prize + demo.wonAuction.bonus)}</small></span>{demo.wonAuction.withdrawal === 'disponível' ? <button className="secondary-btn" data-testid="button-history-redeem" onClick={() => setSheet('win')}>Resgatar</button> : <button className="secondary-btn" data-testid="button-history-status" onClick={() => setSheet('win')}>{demo.wonAuction.withdrawal}</button>}</li> : <li className="no-items">Nenhum leilão encerrado na demonstração.</li>}
                {status !== 'closed' && <li className="list-row"><span>Leilão de demonstração<small>Prêmio {money((auction?.prizeCents ?? 100_000) / 100)}</small></span><span className="demo-tag">Em andamento</span></li>}
              </ul>
              <h3 className="sheet-section">Movimentações</h3>
              <ul className="list" data-testid="list-transactions">{demo.transactions.length ? demo.transactions.map((tx, index) => <li className="list-row" key={`${tx.timestamp}-${index}`} data-testid={`row-transaction-${index}`}><span>{tx.label}<small>{tx.timestamp} · DEMONSTRAÇÃO</small></span><span className={tx.amount > 0 ? 'amount-positive' : 'amount-negative'}>{tx.amount > 0 ? '+' : '−'}{money(Math.abs(tx.amount))}</span></li>) : <li className="no-items">Suas movimentações de demonstração aparecerão aqui.</li>}</ul>
              {demo.wonAuction && <button className="secondary-btn" style={{ width: '100%', marginTop: 14 }} data-testid="button-view-withdrawal" onClick={() => setSheet('win')}>Acompanhar resgate</button>}
              <button className="danger-btn" data-testid="button-signout" onClick={signOut}>Sair da conta</button>
            </> : <div><p className="muted">Você saiu da conta de demonstração.</p><button className="primary-btn" data-testid="button-account-signin" onClick={() => setSheet('signin')}>Entrar</button></div>}
            <button className="reset" data-testid="button-reset-demo" onClick={resetDemo} disabled={resetAuctionMutation.isPending}>{resetAuctionMutation.isPending ? 'Reiniciando…' : 'Reiniciar leilão de demonstração (todas as sessões)'}</button>
          </div>}
          {sheet === 'signin' && <div><p className="muted">Use um e-mail para entrar ou criar uma conta de demonstração. Não há autenticação nem serviço externo.</p><label className="muted" htmlFor="email-demo">E-mail</label><input id="email-demo" className="input-field" data-testid="input-email" type="email" autoComplete="email" value={emailInput} placeholder="seu@email.com" onChange={(event) => { setEmailInput(event.target.value); setNotice(''); }} /><p className="demo-warning">Entrada simulada · nenhum dado será enviado.</p>{notice && <p className="hint error">{notice}</p>}<button className="primary-btn" data-testid="button-signin-confirm" onClick={signIn}>Continuar na demonstração</button></div>}
          {sheet === 'topup' && <div>
            <p className="muted">Créditos são apenas um saldo fictício deste protótipo. O tempo do leilão continua correndo.</p>
            <p className="demo-warning">Demonstração: não existe cobrança real, QR Pix válido ou pagamento.</p>
            {topupStep === 1 && <>
              <h3 className="sheet-section">Escolha o valor</h3><div className="package-grid">{PACKAGES.map((value) => <button className={`package-btn ${packageAmount === value ? 'selected' : ''}`} key={value} data-testid={`button-package-${value}`} aria-pressed={packageAmount === value} onClick={() => setPackageAmount(value)}>{money(value)}</button>)}</div>
              <button className="primary-btn" data-testid="button-generate-demo-code" onClick={() => setTopupStep(2)}>Continuar · {money(packageAmount)}</button>
            </>}
            {topupStep === 2 && <>
              <p className="muted">Código ilustrativo. Não copie para um banco nem tente pagar.</p><div className="qr-demo" role="img" aria-label="Ilustração demonstrativa, não é um QR Code válido" data-testid="image-demo-qr" /><div className="demo-code"><code data-testid="text-demo-code">DEMO-SEM-COBRANCA-{packageAmount}-LANCE-DO-PIX</code><button className="secondary-btn" data-testid="button-copy-demo-code" onClick={() => { void navigator.clipboard?.writeText(`DEMO-SEM-COBRANCA-${packageAmount}-LANCE-DO-PIX`); setAnnouncement('Código de demonstração copiado.'); }}>Copiar</button></div>
              <p className="muted" style={{ textAlign: 'center' }}>Tempo restante: <strong data-testid="value-topup-timer">{timeLabel(remaining)}</strong></p>
              <button className="primary-btn" data-testid="button-simulate-confirmation" style={{ marginTop: 14 }} onClick={confirmTopup}>Simular confirmação</button>
              <button className="reset" data-testid="button-topup-back" onClick={() => setTopupStep(1)}>Voltar e escolher outro valor</button>
            </>}
            {topupStep === 3 && <div style={{ textAlign: 'center' }}><div style={{ margin: '14px auto', width: 58, height: 58, borderRadius: 50, display: 'grid', placeItems: 'center', background: 'hsl(var(--primary))' }}><Check /></div><h3>Créditos adicionados</h3><p className="muted">{money(packageAmount)} adicionados ao saldo demonstrativo.</p><p className="demo-warning">Confirmação simulada. Nenhum pagamento foi realizado.</p><button className="primary-btn" data-testid="button-topup-finish" onClick={() => setSheet(null)}>Voltar ao leilão</button></div>}
            <p className="fine">Tempo restante no leilão: {timeLabel(remaining)}</p>
          </div>}
          {sheet === 'win' && <div>
            {demo.wonAuction ? <div>
              {demo.wonAuction.withdrawal === 'disponível' ? <>
                <div style={{ display: 'grid', placeItems: 'center', margin: '6px auto 12px', width: 58, height: 58, borderRadius: '50%', background: 'hsl(var(--primary)/.14)', color: 'hsl(var(--primary))' }}><Trophy /></div>
                <p className="muted">Lance vencedor na demonstração.</p>
                <div className="summary"><div className="summary-row"><span>Prêmio</span><strong>{money(demo.wonAuction.prize)}</strong></div>{demo.wonAuction.bonus > 0 && <div className="summary-row"><span>Bônus</span><strong>{money(demo.wonAuction.bonus)}</strong></div>}<div className="summary-row total"><span>Total</span><strong>{money(demo.wonAuction.prize + demo.wonAuction.bonus)}</strong></div></div>
                <h3 className="sheet-section">Chave Pix de recebimento</h3><p className="muted">A chave precisa estar no seu nome. Escolha uma chave para esta simulação.</p>
                <div className="key-grid">{(['CPF', 'Celular', 'E-mail', 'Aleatória'] as PixType[]).map((type) => <label className="key-choice" key={type}><input type="radio" name="pix-type" data-testid={`radio-pix-${type.toLowerCase()}`} checked={pixType === type} onChange={() => { setPixType(type); setPixInput(type === 'CPF' ? '123.456.789-00' : ''); }} /><span>{type}</span></label>)}</div>
                <label htmlFor="pix-key" className="muted">Sua chave Pix</label><input id="pix-key" className="input-field" data-testid="input-pix-key" value={pixInput} placeholder={pixType === 'CPF' ? '000.000.000-00' : pixType === 'Celular' ? '(11) 99999-9999' : pixType === 'E-mail' ? 'voce@email.com' : 'Chave aleatória'} onChange={(event) => setPixInput(event.target.value)} />
                <p className="muted" data-testid="text-pix-masked">Prévia mascarada: {isValidPix ? maskedKey : 'Informe uma chave válida'}</p>
                <p className="demo-warning">Resgate simulado. Nenhum Pix será enviado e o prêmio não é dinheiro disponível.</p>
                <button className="primary-btn" data-testid="button-request-withdrawal" disabled={!isValidPix} onClick={startWithdrawal}>Confirmar resgate (demonstração)</button>
              </> : <>
                <p className="status-line" data-testid="status-withdrawal">{demo.wonAuction.withdrawal}</p>
                <p className="muted">Status de resgate demonstrativo para a chave {demo.wonAuction.keyType}: {demo.wonAuction.keyValue}.</p>
                <ol className="timeline" data-testid="list-withdrawal-timeline">{(['Solicitado', 'Em análise', 'Pago'] as const).map((status) => {
                  const order = ['Solicitado', 'Em análise', 'Pago'];
                  return <li key={status} className={order.indexOf(status) <= order.indexOf(demo.wonAuction!.withdrawal) ? 'done' : ''} data-testid={`status-withdrawal-${status.toLowerCase().replace(' ', '-')}`}>{status}</li>;
                })}</ol>
                <p className="demo-warning">Demonstração: nenhum pagamento será processado.</p>
                {demo.wonAuction.withdrawal !== 'Pago' && <button className="secondary-btn" style={{ width: '100%' }} data-testid="button-simulate-withdrawal-status" onClick={advanceWithdrawal}>Simular próximo status</button>}
              </>}
            </div> : <div>
              <div style={{ display: 'grid', placeItems: 'center', margin: '6px auto 12px', width: 58, height: 58, borderRadius: '50%', background: 'hsl(var(--primary)/.14)', color: 'hsl(var(--primary))' }}><Trophy /></div>
              <h3>Você ganhou!</h3>
              <p className="muted">Seu lance foi o último quando o cronômetro encerrou. Prêmio demonstrativo: {money((auction?.prizeCents ?? 100_000) / 100)}.</p>
              <p className="demo-warning">Nenhum prêmio real ou pagamento. Esta experiência é apenas uma demonstração.</p>
              <button className="primary-btn" data-testid="button-open-pix-claim" onClick={() => setDemo((current) => ({ ...current, wonAuction: { winningBidId: winningBidId ?? 0, prize: (auction?.prizeCents ?? 100_000) / 100, bonus: (auction?.bonusCents ?? 0) / 100, withdrawal: 'disponível', keyType: 'CPF', keyValue: '•••.456.789-••' } }))}>Receber via Pix</button>
              <button className="reset" data-testid="button-win-later" onClick={() => setSheet(null)}>Agora não</button>
            </div>}
          </div>}
        </section>
      </div>}
    </div>
  );
}

function validPix(type: PixType, value: string) {
  if (type === 'CPF') return value.replace(/\D/g, '').length === 11;
  if (type === 'Celular') return value.replace(/\D/g, '').length >= 10 && value.replace(/\D/g, '').length <= 13;
  if (type === 'E-mail') return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
  return value.trim().length >= 20;
}
function maskPix(type: PixType, value: string) {
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
