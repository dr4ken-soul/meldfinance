import { Cable, Smartphone, Tv, Zap } from 'lucide-react';
import { Brand } from './Brand';

const services = [
  { label: 'Electricity', Icon: Zap },
  { label: 'Airtime', Icon: Smartphone },
  { label: 'Mobile data', Icon: Cable },
  { label: 'Cable TV', Icon: Tv },
];

export function HeroProductPreview() {
  return (
    <div className="product-preview" aria-label="Illustrative preview of Meld's service selection screen">
      <div className="preview-topline">
        <Brand />
        <span className="preview-label">Illustrative preview</span>
      </div>
      <div className="preview-heading-row">
        <div>
          <h2>Pay a bill</h2>
          <p>Choose a service</p>
        </div>
      </div>
      <div className="preview-services">
        {services.map(({ label, Icon }) => (
          <div className="preview-service" key={label}><Icon aria-hidden="true" /><span>{label}</span></div>
        ))}
      </div>
      <div className="preview-footer" aria-label="Service, details, review">
        <span className="preview-step-current">Service</span><span>Details</span><span>Review</span>
      </div>
    </div>
  );
}
