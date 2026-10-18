import './_group.css';

const money = (value: number) =>
  value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

export function BonusRibbon() {
  const bonusAmount = 10;

  return (
    <div className="bonus-preview">
      <style>{`
        .bonus-ribbon-band {
          width: 100%;
          margin-top: 15px;
          padding: 15px 20px 17px;
          border-radius: 10px;
          background: hsl(157 79% 29%);
          color: #f5fff9;
          box-shadow: inset 0 1px 0 hsl(0 0% 100% / 18%);
        }
        .bonus-ribbon-label {
          display: block;
          margin: 0 0 3px;
          color: hsl(150 75% 88%);
          font-size: 11px;
          font-weight: 800;
          letter-spacing: .13em;
          line-height: 1.2;
          text-transform: uppercase;
        }
        .bonus-ribbon-value {
          margin: 0;
          color: inherit;
          font-size: clamp(22px, 3.1vw, 29px);
          font-weight: 800;
          letter-spacing: -.045em;
          line-height: 1.16;
          font-variant-numeric: tabular-nums;
        }
        .bonus-ribbon-value small {
          font-size: inherit;
          font-weight: inherit;
          letter-spacing: inherit;
        }
        @media (max-width: 767px) {
          .bonus-ribbon-band {
            margin-top: 14px;
            padding: 14px 16px 15px;
            border-radius: 8px;
          }
          .bonus-ribbon-value {
            font-size: clamp(22px, 6.1vw, 27px);
          }
        }
      `}</style>
      <main className="main-layout">
        <div className="auction-content">
          <section aria-labelledby="auction-title">
            <h1 className="hero-kicker" id="auction-title">Prêmio em disputa</h1>
            <p className="lead">O último lance leva</p>
            <p className="prize" data-testid="value-prize">
              <small>R$</small>
              <span>1.000,00</span>
            </p>
            {bonusAmount > 0 && (
              <div className="bonus-ribbon-band" data-testid="value-bonus">
                <span className="bonus-ribbon-label">Bônus</span>
                <p className="bonus-ribbon-value">
                  + {money(bonusAmount)} de bônus
                </p>
              </div>
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
