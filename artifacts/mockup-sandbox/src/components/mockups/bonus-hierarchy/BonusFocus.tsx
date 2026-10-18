import './_group.css';

const money = (value: number) =>
  value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

export function BonusFocus() {
  const bonusAmount = 10;

  return (
    <div className="bonus-preview bonus-focus">
      <style>{`
        .bonus-focus .main-layout {
          grid-template-columns: minmax(0, 1fr);
          max-width: 1120px;
          padding-top: clamp(36px, 8vh, 88px);
        }

        .bonus-focus .auction-content {
          max-width: 760px;
        }

        .bonus-focus .hero-kicker {
          font-size: clamp(20px, 2vw, 24px);
        }

        .bonus-focus .prize {
          margin-top: 22px;
          font-size: clamp(64px, 10vw, 104px);
          white-space: nowrap;
        }

        .bonus-focus .bonus-focus-value {
          margin: 18px 0 0;
          display: flex;
          flex-direction: column;
          align-items: flex-start;
          gap: 2px;
          color: hsl(var(--primary));
        }

        .bonus-focus .bonus-focus-label {
          font-size: 11px;
          line-height: 1.2;
          font-weight: 800;
          letter-spacing: .14em;
          text-transform: uppercase;
        }

        .bonus-focus .bonus-focus-amount {
          font-size: clamp(28px, 4vw, 34px);
          line-height: 1.08;
          font-weight: 800;
          letter-spacing: -.045em;
          font-variant-numeric: tabular-nums;
        }

        .bonus-focus .timer-row {
          margin-top: 30px;
        }

        @media (max-width: 767px) {
          .bonus-focus .main-layout {
            padding: 44px 18px 36px;
          }

          .bonus-focus .prize {
            font-size: clamp(62px, 17vw, 76px);
            letter-spacing: -.075em;
          }

          .bonus-focus .bonus-focus-value {
            margin-top: 17px;
          }

          .bonus-focus .bonus-focus-amount {
            font-size: 30px;
          }
        }

        @media (max-width: 360px) {
          .bonus-focus .prize {
            font-size: 58px;
          }
        }
      `}</style>
      <main className="main-layout">
        <div className="auction-content">
          <section aria-labelledby="bonus-focus-auction-title">
            <h1 className="hero-kicker" id="bonus-focus-auction-title">Prêmio em disputa</h1>
            <p className="lead">O último lance leva</p>
            <p className="prize" data-testid="value-prize">
              <small>R$</small>
              <span>1.000,00</span>
            </p>
            {bonusAmount > 0 && (
              <p
                className="bonus-focus-value"
                data-testid="value-bonus"
                aria-label={`+ ${money(bonusAmount)} de bônus`}
              >
                <span className="bonus-focus-label">Bônus</span>
                <span className="bonus-focus-amount">+ {money(bonusAmount)}</span>
              </p>
            )}
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
