import './_group.css';

export function Current() {
  return (
    <main className="auction-preview min-h-screen">
      <div className="auction-live-status" aria-label="Resumo da disputa">
        <div className="auction-timer-panel">
          <div
            className="timer-row"
            role="timer"
            aria-label="Tempo restante: 01:00"
          >
            <span className="timer" aria-hidden="true">
              01:00
            </span>
            <span className="timer-label">para encerrar a disputa</span>
          </div>
          <div className="progress-track" aria-hidden="true">
            <div className="progress-fill" style={{ width: '100%' }} />
          </div>
        </div>
      </div>

      <section aria-labelledby="current-bid-title">
        <h2 id="current-bid-title" className="section-head section-head-current" data-testid="status-current-bid">
          Último lance
        </h2>
        <ol className="bid-list" aria-live="polite">
          <li className="bid-row current" aria-current="true" data-testid="row-bid-0">
            <div className="bid-history-info">
              <strong data-testid="value-bid-0">R$ 100,00</strong>
            </div>
            <time dateTime="2026-10-20T13:09:00-03:00" data-testid="time-bid-0">
              13:09
            </time>
          </li>
        </ol>
      </section>

      <section aria-labelledby="bids-title">
        <h2 id="bids-title" className="section-head">Lances anteriores</h2>
        <ol className="bid-list">
          <li className="bid-row">
            <div className="bid-history-info">
              <strong>R$ 95,00</strong>
            </div>
            <time dateTime="2026-10-20T13:07:00-03:00">13:07</time>
          </li>
          <li className="bid-row">
            <div className="bid-history-info">
              <strong>R$ 90,00</strong>
            </div>
            <time dateTime="2026-10-20T13:05:00-03:00">13:05</time>
          </li>
        </ol>
      </section>
    </main>
  );
}
