const terms = [
  'Electricity', 'Airtime', 'Mobile data', 'Cable TV', 'Scheduled payments',
  'Receipts & history', 'Saved billers', 'Payment status', 'Naira + stablecoin payments',
];

export function CapabilityRibbon() {
  const list = (duplicate = false) => (
    <ul className="ribbon-list" aria-hidden={duplicate || undefined}>
      {terms.map((term) => <li key={term}>{term}</li>)}
    </ul>
  );

  return (
    <section className="capability-ribbon" aria-label="Meld capabilities">
      <div className="container ribbon-inner">
        <div className="ribbon-viewport">
          <div className="ribbon-track">
            {list()}{list(true)}
          </div>
        </div>
      </div>
    </section>
  );
}
