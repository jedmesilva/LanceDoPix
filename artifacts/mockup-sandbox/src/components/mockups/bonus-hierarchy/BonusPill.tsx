import './_group.css';

const money = (value: number) =>
  value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

export function BonusPill() {
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
              className="bonus"
              data-testid="value-bonus"
              aria-label={'Bônus: ' + money(bonusAmount)}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '10px',
                width: 'fit-content',
                maxWidth: '100%',
                padding: '8px 14px',
                border: '1px solid hsl(var(--primary) / 0.24)',
                borderRadius: '14px',
                background: 'hsl(var(--primary) / 0.09)',
                margin: '14px 0 0',
              }}
            >
              <span
                aria-hidden="true"
                style={{
                  display: 'grid',
                  placeItems: 'center',
                  width: '28px',
                  height: '28px',
                  flex: 'none',
                  borderRadius: '50%',
                  background: 'hsl(var(--primary) / 0.16)',
                  fontSize: '20px',
                  lineHeight: 1,
                }}
              >
                +
              </span>
              <span style={{ display: 'grid', gap: '2px' }}>
                <span style={{ fontSize: '10px', fontWeight: 800, letterSpacing: '.08em', lineHeight: 1.1 }}>
                  BÔNUS
                </span>
                <strong
                  style={{
                    color: 'hsl(var(--foreground))',
                    fontSize: '20px',
                    fontWeight: 800,
                    fontVariantNumeric: 'tabular-nums',
                    lineHeight: 1.1,
                  }}
                >
                  {money(bonusAmount)}
                </strong>
              </span>
            </div>
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
