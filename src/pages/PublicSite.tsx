import { ArrowDownRight, ArrowRight, Check, Clock3, FileText, ReceiptText, Smartphone, Tv, Wifi, Zap } from 'lucide-react';
import { Link } from 'react-router';
import { Brand } from '../components/Brand';
import { CapabilityRibbon } from '../components/CapabilityRibbon';
import { HeroProductPreview } from '../components/HeroProductPreview';
import { PublicNavigation } from '../components/PublicNavigation';
import { Reveal } from '../components/Reveal';

const services = [
  { id: '01', title: 'Electricity', description: 'Review your meter details before payment.', Icon: Zap, size: 'wide' },
  { id: '02', title: 'Airtime', description: 'Choose a network and the amount to top up.', Icon: Smartphone, size: 'narrow' },
  { id: '03', title: 'Mobile data', description: 'Choose a data option for the phone number.', Icon: Wifi, size: 'narrow' },
  { id: '04', title: 'Cable TV', description: 'Select a package and enter your subscriber details.', Icon: Tv, size: 'wide' },
];

const steps = [
  { title: 'Choose a service', description: 'Start with electricity, airtime, mobile data or cable TV.' },
  { title: 'Enter the details', description: 'Provide the information needed for the bill you selected.' },
  { title: 'Choose a method', description: 'Review the payment methods available for that payment.' },
  { title: 'Review the total', description: 'Check the bill, total and any applicable fee before confirming.' },
  { title: 'Follow its status', description: 'See the payment outcome and keep a record close by.' },
];

const currentYear = new Date().getFullYear();

export function PublicSite() {
  return (
    <div className="public-page">
      <a className="skip-link" href="#main-content">Skip to content</a>
      <PublicNavigation />
      <main id="main-content">
        <section className="hero container" aria-labelledby="hero-title">
          <div className="hero-copy">
            <p className="eyebrow">Everyday bill payments</p>
            <h1 id="hero-title">A clearer way to pay everyday bills.</h1>
            <p className="hero-description">Choose electricity, airtime, mobile data or cable TV, review the details before confirming, and follow each payment’s status in Meld.</p>
            <div className="hero-actions">
              <Link className="button button--primary" to="/register">Create account <ArrowRight size={17} aria-hidden="true" /></Link>
              <a className="button button--secondary" href="#how-meld-works">See how it works <ArrowDownRight size={16} aria-hidden="true" /></a>
            </div>
            <p className="hero-note"><Check aria-hidden="true" />Built around everyday bills and clear payment steps.</p>
          </div>
          <div className="hero-visual-group">
            <div className="hero-stage">
              <picture>
                <source media="(max-width: 767px)" srcSet="/images/meld-hero-mobile.webp" />
                <img src="/images/meld-hero-desktop.webp" width="2752" height="1536" alt="" fetchPriority="high" loading="eager" decoding="async" />
              </picture>
              <div className="stage-grain" aria-hidden="true" />
            </div>
            <HeroProductPreview />
          </div>
        </section>

        <Reveal>
          <section className="section services-section" id="services" aria-labelledby="services-title">
            <div className="container">
              <div className="section-heading-row">
                <div>
                  <p className="eyebrow">One place for the essentials</p>
                  <h2 className="section-heading" id="services-title">Everyday services, made easier to follow.</h2>
                </div>
                <p className="section-intro">Start with the bill you need to pay. Meld’s first service categories are designed around familiar, everyday tasks.</p>
              </div>
              <div className="service-grid">
                {services.map(({ id, title, description, Icon, size }) => (
                  <article className={`service-card service-card--${size}`} key={id}>
                    <div className="service-card-top">
                      <span className="service-index">SERVICE / {id}</span>
                      <span className="service-icon"><Icon aria-hidden="true" /></span>
                    </div>
                    <h3>{title}</h3>
                    <p>{description}</p>
                    <a className="service-link" href="#how-meld-works">See the payment steps <ArrowRight aria-hidden="true" /></a>
                  </article>
                ))}
              </div>
            </div>
          </section>
        </Reveal>

        <CapabilityRibbon />

        <Reveal>
          <section className="section how-section" id="how-meld-works" aria-labelledby="how-title">
            <div className="container">
              <p className="eyebrow">A simple path through</p>
              <div className="section-heading-row">
                <h2 className="section-heading" id="how-title">Every payment has a clear next step.</h2>
                <p className="section-intro">The exact details depend on the service and payment method. The goal is to make each step understandable before you continue.</p>
              </div>
              <div className="steps-grid">
                {steps.map((step, index) => (
                  <article className="step-card" key={step.title}>
                    <span className="step-number">0{index + 1}</span>
                    <h3>{step.title}</h3>
                    <p>{step.description}</p>
                  </article>
                ))}
              </div>
            </div>
          </section>
        </Reveal>

        <Reveal className="statement-section">
          <section className="container" aria-labelledby="statement-title">
            <div className="statement-panel">
              <div className="statement-copy">
                <p className="eyebrow">One clear flow</p>
                <h2 id="statement-title">Everyday bills. One clear flow.</h2>
                <p>Choose a service, review the details, and keep your payment record close in Meld.</p>
              </div>
            </div>
          </section>
        </Reveal>

        <Reveal>
          <section className="section trust-section" id="transparency" aria-labelledby="transparency-title">
            <div className="container">
              <p className="eyebrow">Clarity at the important moments</p>
              <h2 className="section-heading" id="transparency-title">Know what you’re confirming.</h2>
              <p className="section-intro">Meld is being built to make the important parts of a bill payment easier to review and understand.</p>
              <div className="trust-grid">
                <article className="trust-card">
                  <ReceiptText aria-hidden="true" />
                  <h3>See the total first</h3>
                  <p>Review the bill and any applicable fee before you confirm a payment.</p>
                </article>
                <article className="trust-card">
                  <Clock3 aria-hidden="true" />
                  <h3>Follow the status</h3>
                  <p>Know whether a payment is processing, complete, or still being checked.</p>
                </article>
                <article className="trust-card">
                  <FileText aria-hidden="true" />
                  <h3>Keep a clear record</h3>
                  <p>Find payment details and receipts together, without relying on memory.</p>
                </article>
              </div>
            </div>
          </section>
        </Reveal>

        <section className="final-section container" aria-labelledby="final-title">
          <div className="final-action">
            <div>
              <p className="eyebrow">Meld is in development</p>
              <h2 id="final-title">Make your next bill easier to follow.</h2>
            </div>
            <Link className="button button--primary" to="/register">Create account <ArrowRight size={17} aria-hidden="true" /></Link>
          </div>
        </section>
      </main>
      <footer className="site-footer">
        <div className="container footer-main">
          <div className="footer-brand-block">
            <Link to="/" aria-label="Meld home"><Brand /></Link>
            <p className="footer-description">Everyday bill payments, designed around clearer steps and easier-to-follow records.</p>
          </div>
          <div className="footer-group">
            <h2>Explore</h2>
            <div className="footer-links">
              <a href="#services">Services</a>
              <a href="#how-meld-works">How it works</a>
              <a href="#transparency">Transparency</a>
            </div>
          </div>
          <div className="footer-group">
            <h2>Your account</h2>
            <div className="footer-links">
              <Link to="/register">Create account</Link>
              <Link to="/sign-in">Sign in</Link>
            </div>
          </div>
        </div>
        <div className="container footer-bottom">
          <span>© {currentYear} Meld</span>
          <span>Meld is a project in development. Services and availability will be confirmed before launch.</span>
        </div>
      </footer>
    </div>
  );
}
