import './_group.css';

export function Current() {
  return (
    <main className="auction-preview">
      <section className="auction-preview-sheet" aria-label="Meus leilões, versão atual">
        <h3 className="account-section">Meus leilões</h3>
        <ul className="account-list">
          <li className="account-list-row">
            <span className="account-list-description">
              Prêmio R$ 1.000,00
              <small>hoje</small>
            </span>
            <span className="account-tag account-tag-live">Em andamento</span>
          </li>
          <li className="account-list-row">
            <span className="account-list-description">
              Prêmio R$ 500,00
              <small>12/10 - Ganhou</small>
            </span>
            <button className="account-pill account-pill-small">Resgatar</button>
          </li>
          <li className="account-list-row">
            <span className="account-list-description">
              Prêmio R$ 250,00
              <small>09/10 - Ganhou</small>
            </span>
            <button className="account-tag account-tag-paid auction-action-button">
              Pago
            </button>
          </li>
        </ul>
      </section>
    </main>
  );
}
