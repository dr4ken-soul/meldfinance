type BrandProps = { compact?: boolean; className?: string };

export function Brand({ compact = false, className = '' }: BrandProps) {
  return (
    <span className={`brand ${className}`.trim()} aria-label="Meld">
      <img className="brand-mark" src="/images/meld-logo-symbol.png" alt="" aria-hidden="true" />
      {!compact && <span>Meld</span>}
    </span>
  );
}
