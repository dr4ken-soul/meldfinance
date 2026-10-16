import { useCallback, useEffect, useState } from 'react';
import { ArrowUpRight, FileText, LoaderCircle, RefreshCw } from 'lucide-react';
import { ApiError, apiRequest } from '../lib/api';

type Payment = {
  reference: string; category: string; serviceName: string; productName: string;
  recipient: string; amount: number; currency: string; status: string; statusMessage: string;
  createdAt: string; updatedAt: string;
};

const money = new Intl.NumberFormat('en-NG', { style: 'currency', currency: 'NGN', maximumFractionDigits: 2 });

function statusLabel(status: string) {
  const labels: Record<string, string> = {
    awaiting_payment: 'Awaiting payment', checkout_failed: 'Checkout not completed', payment_confirmed: 'Payment confirmed',
    fulfillment_processing: 'Sending to biller', fulfillment_pending: 'Biller status pending', fulfilled: 'Completed',
    failed: 'Biller payment failed', refund_processing: 'Refund requested', refund_pending: 'Refund processing',
    refund_required: 'Support review required', refunded: 'Refund confirmed',
  };
  return labels[status] ?? status.replaceAll('_', ' ');
}

export function ActivityPage() {
  const [payments, setPayments] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [checking, setChecking] = useState('');

  const refresh = useCallback(async () => {
    try {
      const result = await apiRequest<{ payments: Payment[] }>('/payments');
      setPayments(result.payments);
    } catch (reason) {
      setError(reason instanceof ApiError ? reason.message : 'Meld could not load payment records.');
    } finally { setLoading(false); }
  }, []);

  useEffect(() => {
    let active = true;
    void apiRequest<{ payments: Payment[] }>('/payments')
      .then((result) => { if (active) setPayments(result.payments); })
      .catch((reason: unknown) => {
        if (active) setError(reason instanceof ApiError ? reason.message : 'Meld could not load payment records.');
      })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  async function checkStatus(reference: string) {
    setChecking(reference);
    setError('');
    try {
      await apiRequest<{ payment: Payment }>(`/payments/${encodeURIComponent(reference)}`);
      await refresh();
    } catch (reason) {
      setError(reason instanceof ApiError ? reason.message : 'The payment status could not be refreshed.');
    } finally { setChecking(''); }
  }

  return (
    <>
      <div className="app-page-heading">
        <div><p className="eyebrow">YOUR RECORDS</p><h1>Activity</h1><p>Track the checkout and biller status for each sandbox payment.</p></div>
        <button className="button button--secondary activity-refresh" type="button" onClick={() => { setError(''); void refresh(); }} disabled={loading}><RefreshCw size={16} aria-hidden="true" />Refresh</button>
      </div>
      <div className="sandbox-banner" role="note"><FileText size={18} aria-hidden="true" /><div><strong>Sandbox records only</strong><span> These are test transactions and are not evidence of a real bill payment.</span></div></div>
      {error && <p className="payment-message" role="alert">{error}</p>}
      {loading ? <div className="activity-loading"><LoaderCircle className="spin" aria-hidden="true" />Loading activity…</div> : payments.length === 0 ? (
        <section className="app-empty-panel activity-empty" aria-labelledby="activity-empty-title">
          <span className="empty-icon"><FileText aria-hidden="true" /></span>
          <h2 id="activity-empty-title">No payment records yet</h2>
          <p>When a sandbox checkout is started, its provider-confirmed status and payment reference will appear here.</p>
        </section>
      ) : (
        <div className="activity-list">
          {payments.map((payment) => (
            <article className="activity-card" key={payment.reference}>
              <div className="activity-card-main">
                <span className={`payment-status payment-status--${payment.status}`}>{statusLabel(payment.status)}</span>
                <h2>{payment.serviceName} <span>·</span> {payment.productName}</h2>
                <p>{payment.recipient} <span>·</span> {new Date(payment.createdAt).toLocaleString('en-NG', { dateStyle: 'medium', timeStyle: 'short' })}</p>
                <small>{payment.statusMessage}</small>
              </div>
              <div className="activity-card-side">
                <strong>{money.format(payment.amount)}</strong>
                {['fulfillment_pending', 'payment_confirmed', 'fulfillment_processing'].includes(payment.status) && (
                  <button type="button" className="text-button" onClick={() => void checkStatus(payment.reference)} disabled={checking === payment.reference}>
                    {checking === payment.reference ? <LoaderCircle size={14} className="spin" aria-hidden="true" /> : <ArrowUpRight size={14} aria-hidden="true" />}
                    Check status
                  </button>
                )}
              </div>
            </article>
          ))}
        </div>
      )}
    </>
  );
}
