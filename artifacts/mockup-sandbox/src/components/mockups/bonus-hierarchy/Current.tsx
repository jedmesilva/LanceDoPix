import './_group.css';

const money = (value: number) =>
  value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

export function Current() {
  const bonusAmount = 10;

  return (
    <div className="bonus-preview">
      <main className="main-layout">
        <div className="auction-content">
          <section aria-labelledby="auction-title">
            <h1 className="hero-kicker" id="auction-title">Prêmio em disputa</h1>
            <p className="lead">O último lance leva</p>
            <p className="prize" data-testid="value-prize">
              <small>R$</small>
              <span>1.000,00</span>
            </p>
            <p className="bonus" data-testid="value-bonus">
              + {money(bonusAmount)} de bônus
            </p>
            <div className="timer-row" role="timer" aria-label="Tempo restante: 00:42">
              <span className="timer" aria-hidden="true">00:42</span>
              <span className="timer-label">para encerrar</span>
            </div>
            <div className="progress-track" aria-hidden="true">
              <div className="progress-fill" style={{ width: '70%' }} />
            </div>
          </section>
        </div>
      </main>
    </div>
  );
}
