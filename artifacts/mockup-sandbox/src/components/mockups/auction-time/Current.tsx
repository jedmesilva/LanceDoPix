import './_group.css';

export function Current() {
  return (
    <main className="auction-preview min-h-screen">
      <section className="auction-live-status" aria-label="Resumo da disputa">
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

        <div
          className="current-bid-panel"
          aria-live="polite"
          data-testid="row-bid-0"
        >
          <div className="current-bid-copy">
            <span className="current-bid-label" data-testid="status-current-bid">
              Último lance
            </span>
            <strong className="current-bid-value" data-testid="value-bid-0">
              R$ 100,00
            </strong>
            <time
              dateTime="2026-10-20T13:09:00-03:00"
              data-testid="time-bid-0"
            >
              13:09
            </time>
          </div>
        </div>
      </section>
    </main>
  );
}
