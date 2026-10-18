import './_group.css';

const money = (value: number) =>
  value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

export function BonusStatus() {
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

            <div
              className="bonus-status-grid"
              style={{
                display: 'grid',
                gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr)',
                marginTop: 30,
                border: '1px solid hsl(var(--border))',
                borderRadius: 16,
                overflow: 'hidden',
                background: 'hsl(var(--card))',
              }}
            >
              {bonusAmount > 0 && (
                <div
                  style={{
                    minWidth: 0,
                    padding: '13px 16px 14px',
                    background: 'hsl(156 38% 91%)',
                    borderRight: '1px solid hsl(var(--border))',
                  }}
                >
                  <p
                    data-testid="value-bonus"
                    style={{
                      margin: 0,
                      color: 'hsl(163 36% 17%)',
                      fontSize: 24,
                      fontWeight: 800,
                      letterSpacing: '-.055em',
                      lineHeight: 1.05,
                      fontVariantNumeric: 'tabular-nums',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    + {money(bonusAmount)}
                  </p>
                  <span
                    style={{
                      display: 'block',
                      marginTop: 5,
                      color: 'hsl(var(--muted-foreground))',
                      fontSize: 13,
                      fontWeight: 600,
                    }}
                  >
                    de bônus
                  </span>
                </div>
              )}

              <div
                style={{
                  minWidth: 0,
                  padding: '13px 16px 14px',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'center',
                }}
              >
                <div
                  className="timer-row"
                  role="timer"
                  aria-label="Tempo restante: 00:42"
                  style={{ marginTop: 0, flexDirection: 'column', alignItems: 'flex-start', gap: 4 }}
                >
                  <span
                    className="timer"
                    aria-hidden="true"
                    style={{ fontSize: 25, lineHeight: 1.05 }}
                  >
                    00:42
                  </span>
                  <span className="timer-label" style={{ fontSize: 13 }}>
                    para encerrar
                  </span>
                </div>
              </div>
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
