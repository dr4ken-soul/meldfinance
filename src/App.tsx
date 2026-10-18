import { lazy, Suspense } from 'react';
import { BrowserRouter, Navigate, Route, Routes, useLocation } from 'react-router';
import { AuthProvider } from './auth/AuthContext';
import { useAuth } from './auth/useAuth';

const PublicSite = lazy(() => import('./pages/PublicSite').then(({ PublicSite: page }) => ({ default: page })));
const AuthPage = lazy(() => import('./pages/AuthPage').then(({ AuthPage: page }) => ({ default: page })));
const AuthActionPage = lazy(() => import('./pages/AuthActionPage').then(({ AuthActionPage: page }) => ({ default: page })));
const ProductShell = lazy(() => import('./pages/ProductShell').then(({ ProductShell: page }) => ({ default: page })));

function PrivateRoute() {
  const { status } = useAuth();
  const location = useLocation();

  if (status === 'loading') return <div className="route-loading" role="status">Preparing your Meld space…</div>;

  if (status === 'unavailable') {
    return (
      <main className="setup-screen">
        <a className="skip-link" href="#setup-message">Skip to message</a>
        <section className="setup-card" id="setup-message" aria-labelledby="setup-title">
          <p className="eyebrow">LOCAL SETUP</p>
          <h1 id="setup-title">Your private space is not connected yet.</h1>
          <p>Connect Firebase Authentication and the Supabase Postgres database in the server environment, then restart Meld. Payments remain unavailable until their own integrations are configured.</p>
          <a className="button button--primary" href="/sign-in">Back to sign in</a>
        </section>
      </main>
    );
  }

  if (status !== 'signed-in') return <Navigate to="/sign-in" replace state={{ from: location.pathname }} />;
  return <ProductShell />;
}

function AppRoutes() {
  return (
    <Suspense fallback={<div className="route-loading" role="status">Loading Meld…</div>}>
      <Routes>
        <Route path="/" element={<PublicSite />} />
        <Route path="/register" element={<AuthPage mode="register" />} />
        <Route path="/sign-in" element={<AuthPage mode="sign-in" />} />
        <Route path="/auth/action" element={<AuthActionPage />} />
        <Route path="/app/*" element={<PrivateRoute />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Suspense>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider><AppRoutes /></AuthProvider>
    </BrowserRouter>
  );
}
