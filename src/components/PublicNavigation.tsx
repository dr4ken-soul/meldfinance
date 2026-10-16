import { useEffect, useState } from 'react';
import { Link } from 'react-router';
import { Menu, X } from 'lucide-react';
import { Brand } from './Brand';

const links = [
  { label: 'Services', href: '#services' },
  { label: 'How it works', href: '#how-meld-works' },
  { label: 'Transparency', href: '#transparency' },
];

export function PublicNavigation() {
  const [compact, setCompact] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    const update = () => setCompact(window.scrollY > 56);
    update();
    window.addEventListener('scroll', update, { passive: true });
    return () => window.removeEventListener('scroll', update);
  }, []);

  const closeMenu = () => setMenuOpen(false);

  return (
    <div className="public-nav-wrap">
      <nav className={`public-nav${compact ? ' is-compact' : ''}`} aria-label="Main navigation">
        <Link to="/" aria-label="Meld home" onClick={closeMenu}><Brand /></Link>
        <div className="public-nav-links">
          {links.map((link) => <a key={link.href} href={link.href}>{link.label}</a>)}
        </div>
        <div className="public-nav-actions">
          <Link className="public-nav-signin" to="/sign-in">Sign in</Link>
          <Link className="button button--primary" to="/register">Create account</Link>
          <button
            className="nav-menu-toggle"
            type="button"
            aria-label={menuOpen ? 'Close navigation menu' : 'Open navigation menu'}
            aria-expanded={menuOpen}
            aria-controls="mobile-public-menu"
            onClick={() => setMenuOpen((open) => !open)}
          >
            {menuOpen ? <X aria-hidden="true" /> : <Menu aria-hidden="true" />}
          </button>
        </div>
      </nav>
      {menuOpen && (
        <div className="mobile-nav-panel" id="mobile-public-menu">
          {links.map((link) => <a key={link.href} href={link.href} onClick={closeMenu}>{link.label}</a>)}
          <Link to="/sign-in" onClick={closeMenu}>Sign in</Link>
        </div>
      )}
    </div>
  );
}
