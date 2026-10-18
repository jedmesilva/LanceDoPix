import { useState } from 'react';
import './_group.css';

type AuctionRow = {
  id: number;
  label: string;
  prize: string;
  detail: string;
  status: string;
  action?: 'redeem';
  statusTone?: 'live' | 'paid';
};

const initialRows: AuctionRow[] = [
  {
    id: 1,
    label: 'Prêmio em disputa',
    prize: 'R$ 1.000,00',
    detail: 'Seu lance R$ 3,00',
    status: 'Você está ganhando',
    statusTone: 'live',
  },
  {
    id: 2,
    label: 'Prêmio',
    prize: 'R$ 500,00',
    detail: 'Seu lance R$ 12,00',
    status: 'Cobriram seu lance',
  },
  {
    id: 3,
    label: 'Prêmio',
    prize: 'R$ 100,00',
    detail: 'Você ganhou com lance de R$ 4,50',
    status: '',
    action: 'redeem',
  },
  {
    id: 4,
    label: 'Prêmio',
    prize: 'R$ 250,00',
    detail: 'Você ganhou com lance de R$ 8,20',
    status: 'Resgatado',
    statusTone: 'paid',
  },
];

export function AuctionList() {
  const [rows, setRows] = useState(initialRows);

  function requestRedeem(id: number) {
    setRows((currentRows) =>
      currentRows.map((row) =>
        row.id === id
          ? { ...row, action: undefined, status: 'Solicitado', statusTone: undefined }
          : row,
      ),
    );
  }

  return (
    <main className="auction-preview">
      <section className="auction-preview-sheet" aria-label="Meus leilões">
        <h3 className="account-section">Meus leilões</h3>
        <ul className="account-list">
          {rows.map((row) => (
            <li className="account-list-row" key={row.id}>
              <span className="account-list-description">
                <span className="account-list-label">{row.label}</span>
                <strong className="account-prize">{row.prize}</strong>
                <small className="account-list-detail">{row.detail}</small>
              </span>
              <span className="auction-action">
                {row.action === 'redeem' ? (
                  <button
                    className="account-pill account-pill-small"
                    onClick={() => requestRedeem(row.id)}
                  >
                    Resgatar
                  </button>
                ) : (
                  <button
                    className={`account-tag auction-action-button ${row.statusTone === 'live' ? 'account-tag-live' : ''} ${row.statusTone === 'paid' ? 'account-tag-paid' : ''}`}
                    aria-label={`Status do prêmio: ${row.status}`}
                  >
                    {row.status}
                  </button>
                )}
              </span>
            </li>
          ))}
        </ul>
      </section>
    </main>
  );
}
