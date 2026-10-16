import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { ArrowRight, CircleCheck, LoaderCircle, ShieldCheck, Zap } from 'lucide-react';
import { useNavigate, useSearchParams } from 'react-router';
import { ApiError, apiRequest } from '../lib/api';

type ServiceCategory = 'airtime' | 'data' | 'electricity' | 'tv';
type ServiceOption = { id: string; name: string };
type Variation = { code: string; name: string; amount: number; fixedPrice: boolean };
type Catalog = {
  categories: Record<ServiceCategory, ServiceOption[]>;
  readiness: { vtpass: boolean; checkout: boolean; secureStorage: boolean; payments: boolean };
};
type Payment = {
  reference: string; category: ServiceCategory; serviceName: string; productName: string;
  recipient: string; amount: number; currency: 'NGN'; status: string; statusMessage: string;
  createdAt: string; updatedAt: string;
};

const categories: { id: ServiceCategory; label: string; explanation: string }[] = [
  { id: 'airtime', label: 'Airtime', explanation: 'Top up a mobile number.' },
  { id: 'data', label: 'Mobile data', explanation: 'Choose an available data bundle.' },
  { id: 'electricity', label: 'Electricity', explanation: 'Verify a meter before payment.' },
  { id: 'tv', label: 'Cable TV', explanation: 'Verify a smart card and choose a package.' },
];

const money = new Intl.NumberFormat('en-NG', { style: 'currency', currency: 'NGN', maximumFractionDigits: 2 });
const noServices: ServiceOption[] = [];
const noVariations: Variation[] = [];

function errorMessage(error: unknown) {
  return error instanceof ApiError ? error.message : 'Meld could not complete that step. Try again.';
}

function paymentStatusLabel(status: string) {
  const labels: Record<string, string> = {
    checkout_pending: 'Preparing checkout', awaiting_payment: 'Awaiting payment', checkout_failed: 'Checkout not completed',
    payment_confirmed: 'Payment confirmed', fulfillment_processing: 'Sending to biller', fulfillment_pending: 'Biller status pending',
    fulfilled: 'Completed', failed: 'Biller payment failed', refund_processing: 'Refund requested',
    refund_pending: 'Refund processing', refund_required: 'Support review required', refunded: 'Refund confirmed',
  };
  return labels[status] ?? 'Status unavailable';
}

export function PayPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [catalog, setCatalog] = useState<Catalog | null>(null);
  const [category, setCategory] = useState<ServiceCategory>('airtime');
  const [serviceId, setServiceId] = useState('');
  const [loadedVariations, setLoadedVariations] = useState<Variation[]>([]);
  const [variationsForService, setVariationsForService] = useState('');
  const [variationCode, setVariationCode] = useState('');
  const [billerCode, setBillerCode] = useState('');
  const [phone, setPhone] = useState('');
  const [meterType, setMeterType] = useState<'prepaid' | 'postpaid'>('prepaid');
  const [amount, setAmount] = useState('');
  const [verifiedName, setVerifiedName] = useState('');
  const [busy, setBusy] = useState<'catalog' | 'verify' | 'checkout' | 'return' | ''>(() => new URLSearchParams(window.location.search).get('checkout') === 'return' ? 'return' : 'catalog');
  const [message, setMessage] = useState('');
  const [returnPayment, setReturnPayment] = useState<Payment | null>(null);

  const serviceOptions = catalog?.categories[category] ?? noServices;
  const variations = variationsForService === serviceId ? loadedVariations : noVariations;
  const needsPlan = category === 'data' || category === 'tv';
  const needsVerification = category === 'electricity' || category === 'tv';
  const readiness = catalog?.readiness;
  const isLoadingPlans = Boolean(serviceId && needsPlan && readiness?.vtpass && variationsForService !== serviceId);
  const selectedService = serviceOptions.find((service) => service.id === serviceId) ?? serviceOptions[0];
  const selectedVariation = variations.find((variation) => variation.code === variationCode);
  const total = needsPlan ? selectedVariation?.amount ?? 0 : Number(amount) || 0;
  const contactPhone = category === 'airtime' ? billerCode : phone;
  const providerReady = Boolean(readiness?.payments);

  useEffect(() => {
    let active = true;
    void apiRequest<Catalog>('/payments/catalog').then((result) => {
      if (!active) return;
      setCatalog(result);
      const initial = result.categories.airtime[0]?.id ?? '';
      setServiceId(initial);
    }).catch((error: unknown) => {
      if (active) setMessage(errorMessage(error));
    }).finally(() => { if (active) setBusy((current) => current === 'catalog' ? '' : current); });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (!serviceId || !needsPlan || !readiness?.vtpass) return;
    let active = true;
    void apiRequest<{ variations: Variation[] }>(`/payments/variations?serviceId=${encodeURIComponent(serviceId)}`)
      .then((result) => {
        if (!active) return;
        setLoadedVariations(result.variations);
        setVariationsForService(serviceId);
        setVariationCode(result.variations[0]?.code ?? '');
      })
      .catch((error: unknown) => { if (active) { setMessage(errorMessage(error)); setVariationsForService(serviceId); setLoadedVariations([]); } });
    return () => { active = false; };
  }, [serviceId, needsPlan, readiness?.vtpass]);

  useEffect(() => {
    const checkout = searchParams.get('checkout');
    const reference = searchParams.get('tx_ref');
    const transactionId = searchParams.get('transaction_id');
    if (checkout !== 'return') return;
    if (!reference || !transactionId) {
      navigate('/app/pay', { replace: true });
      return;
    }
    let active = true;
    void apiRequest<{ payment: Payment }>('/payments/confirm', {
      method: 'POST', body: JSON.stringify({ reference, transactionId }),
    }).then((result) => {
      if (active) {
        setReturnPayment(result.payment);
        setMessage(result.payment.statusMessage);
      }
    }).catch((error: unknown) => {
      if (active) setMessage(`${errorMessage(error)} Check Activity before attempting another payment.`);
    }).finally(() => {
      if (active) setBusy('');
      navigate('/app/pay', { replace: true });
    });
    return () => { active = false; };
  }, [searchParams, navigate]);

  const categoryCopy = useMemo(() => categories.find((item) => item.id === category)!, [category]);

  async function verifyAccount() {
    if (!selectedService) return;
    setBusy('verify');
    setMessage('');
    setVerifiedName('');
    try {
      const result = await apiRequest<{ verified: boolean; customerName: string }>('/payments/verify-biller', {
        method: 'POST',
        body: JSON.stringify({ serviceId, billersCode: billerCode, ...(category === 'electricity' ? { type: meterType } : {}) }),
      });
      setVerifiedName(result.customerName);
      setMessage(`Verified for ${result.customerName}. Check the account number before continuing.`);
    } catch (error) {
      setMessage(errorMessage(error));
    } finally { setBusy(''); }
  }

  function chooseCategory(nextCategory: ServiceCategory) {
    setCategory(nextCategory);
    setServiceId(catalog?.categories[nextCategory][0]?.id ?? '');
    setVerifiedName('');
    setMessage('');
    setBillerCode('');
    setAmount('');
  }

  async function startCheckout(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedService || !providerReady) return;
    if (needsVerification && !verifiedName) {
      setMessage('Verify the biller account before continuing to checkout.');
      return;
    }
    setBusy('checkout');
    setMessage('');
    try {
      const result = await apiRequest<{ checkoutUrl: string }>('/payments', {
        method: 'POST',
        body: JSON.stringify({
          serviceId, billersCode: billerCode, phone: contactPhone,
          ...(category === 'electricity' ? { type: meterType } : {}),
          ...(needsPlan ? { variationCode } : { amount: Number(amount) }),
        }),
      });
      window.location.assign(result.checkoutUrl);
    } catch (error) {
      setMessage(errorMessage(error));
      setBusy('');
    }
  }

  const formReady = Boolean(
    billerCode.trim() && contactPhone.trim() && providerReady && selectedService &&
    (!needsPlan || selectedVariation) && (!needsVerification || verifiedName) &&
    (needsPlan || Number(amount) >= 100),
  );

  return (
    <>
      <div className="app-page-heading">
        <div><p className="eyebrow">PAY A BILL</p><h1>One clear step at a time.</h1><p>Choose a service, confirm the biller details and review the NGN amount before the secure sandbox checkout.</p></div>
      </div>

      <div className="sandbox-banner" role="note">
        <ShieldCheck size={19} aria-hidden="true" />
        <div><strong>Sandbox demonstration</strong><span> This flow uses test checkout and biller systems. It does not charge real funds or deliver a real bill payment.</span></div>
      </div>

      {!providerReady && (
        <div className="app-setup-banner" role="status">
          <strong>Payment credentials still need to be added.</strong>
          <span> The payment screens are ready, but sandbox checkout stays disabled until the provider keys and secure-storage key are configured.</span>
        </div>
      )}

      <form className="payment-form" onSubmit={(event) => void startCheckout(event)}>
        <div className="payment-form-header"><span className="payment-step">01</span><div><h2>Choose your bill</h2><p>Start with the service you want to pay.</p></div></div>
        <div className="payment-category-grid" role="group" aria-label="Bill category">
          {categories.map((item) => (
              <button key={item.id} className={`payment-category${category === item.id ? ' is-selected' : ''}`} type="button" onClick={() => chooseCategory(item.id)} aria-pressed={category === item.id}>
              <Zap size={17} aria-hidden="true" /><strong>{item.label}</strong><span>{item.explanation}</span>
            </button>
          ))}
        </div>

        <div className="payment-form-grid">
          <label className="field"><span>{category === 'electricity' ? 'Distribution company' : category === 'tv' ? 'TV provider' : 'Network'}</span>
            <select value={serviceId} onChange={(event) => { setServiceId(event.target.value); setVerifiedName(''); setMessage(''); }} required disabled={!serviceOptions.length}>
              {serviceOptions.map((service) => <option key={service.id} value={service.id}>{service.name}</option>)}
            </select>
          </label>

          {category === 'electricity' && (
            <label className="field"><span>Meter type</span><select value={meterType} onChange={(event) => { setMeterType(event.target.value as 'prepaid' | 'postpaid'); setVerifiedName(''); }}><option value="prepaid">Prepaid</option><option value="postpaid">Postpaid</option></select></label>
          )}

          {needsPlan && (
            <label className="field field--wide"><span>{category === 'data' ? 'Data bundle' : 'TV package'}</span>
              <select value={variationCode} onChange={(event) => setVariationCode(event.target.value)} required disabled={!variations.length || isLoadingPlans}>
                {variations.map((variation) => <option key={variation.code} value={variation.code}>{variation.name} · {money.format(variation.amount)}</option>)}
              </select>
              {isLoadingPlans && <small>Loading current plans…</small>}
              {!isLoadingPlans && needsPlan && readiness?.vtpass && !variations.length && <small>No plan options were returned for this provider. Try another provider.</small>}
            </label>
          )}

          <label className="field"><span>{category === 'electricity' ? 'Meter number' : category === 'tv' ? 'Smart-card number' : 'Recipient phone number'}</span>
            <input inputMode={category === 'electricity' || category === 'tv' ? 'numeric' : 'tel'} autoComplete="off" value={billerCode} onChange={(event) => { setBillerCode(event.target.value); setVerifiedName(''); }} placeholder={category === 'electricity' ? 'Enter meter number' : category === 'tv' ? 'Enter smart-card number' : '080…'} required />
          </label>

          {category !== 'airtime' && <label className="field"><span>Contact phone number</span><input type="tel" autoComplete="tel" value={phone} onChange={(event) => setPhone(event.target.value)} placeholder="080…" required /></label>}

          {!needsPlan && <label className="field"><span>Amount (NGN)</span><input type="number" min="100" max="500000" step="1" inputMode="decimal" value={amount} onChange={(event) => setAmount(event.target.value)} placeholder="For example, 1,000" required /></label>}
        </div>

        {category === 'airtime' && <p className="field-hint">For airtime, Meld uses the recipient number as the contact number for the sandbox biller.</p>}

        {needsVerification && (
          <div className="verification-row">
            {verifiedName ? <span className="verified-biller"><CircleCheck size={18} aria-hidden="true" /> Verified account: <strong>{verifiedName}</strong></span> : <span>Verify this account before checkout to reduce wrong-recipient payments.</span>}
            <button className="button button--secondary" type="button" onClick={() => void verifyAccount()} disabled={!billerCode.trim() || !readiness?.vtpass || busy !== ''}>
              {busy === 'verify' ? <LoaderCircle size={16} className="spin" aria-hidden="true" /> : null}{busy === 'verify' ? 'Checking…' : 'Verify account'}
            </button>
          </div>
        )}

        <div className="payment-review">
          <div><p className="eyebrow">REVIEW BEFORE YOU CONTINUE</p><strong>{selectedService?.name ?? categoryCopy.label}</strong><span>{needsPlan ? selectedVariation?.name ?? 'Choose a plan' : categoryCopy.label}</span></div>
          <strong className="payment-total">{total ? money.format(total) : 'Enter amount'}</strong>
        </div>

        {busy === 'return' && !message && <p className="payment-message" role="status">Confirming the test checkout and checking the biller result…</p>}
        {message && <p className="payment-message" role="status">{message}</p>}
        {returnPayment && <div className={`payment-result payment-result--${returnPayment.status}`}><strong>{paymentStatusLabel(returnPayment.status)}</strong><span>{returnPayment.statusMessage}</span><span>Reference {returnPayment.reference}</span></div>}

        <button className="button button--primary payment-submit" type="submit" disabled={!formReady || busy !== ''}>
          {busy === 'checkout' || busy === 'return' ? <LoaderCircle size={17} className="spin" aria-hidden="true" /> : <ArrowRight size={17} aria-hidden="true" />}
          {busy === 'checkout' ? 'Preparing checkout…' : busy === 'return' ? 'Confirming payment…' : 'Continue to secure test checkout'}
        </button>
      </form>
    </>
  );
}
