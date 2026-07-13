import { Suspense, lazy } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Layout from '@/components/layout/Layout';
import AuthGuard from '@/components/AuthGuard';
import { useLanguage } from '@/i18n/LanguageContext';

// Route pages are code-split via React.lazy so each loads on demand instead of
// bundling into one initial chunk. Layout/AuthGuard stay eager (they wrap every
// route); the Suspense boundary sits inside Layout so the shell/nav stays put
// while a page chunk loads. Named exports are adapted to lazy's default shape.
const LoginPage = lazy(() => import('@/pages/Login'));
const PortfolioPage = lazy(() => import('@/pages/Portfolio'));
const AssetsPage = lazy(() => import('@/pages/Assets').then(m => ({ default: m.AssetsPage })));
const AssetDetailPage = lazy(() => import('@/pages/Assets').then(m => ({ default: m.AssetDetailPage })));
const AcquisitionPage = lazy(() => import('@/pages/Acquisition'));
const DealDashboard = lazy(() => import('@/pages/DealDashboard'));
const DevelopmentsPage = lazy(() => import('@/pages/Developments').then(m => ({ default: m.DevelopmentsPage })));
const DevelopmentDetailPage = lazy(() => import('@/pages/Developments').then(m => ({ default: m.DevelopmentDetailPage })));
const SalesPage = lazy(() => import('@/pages/Sales').then(m => ({ default: m.SalesPage })));
const SaleDetailPage = lazy(() => import('@/pages/Sales').then(m => ({ default: m.SaleDetailPage })));
const MarktPage = lazy(() => import('@/pages/Markt').then(m => ({ default: m.MarktPage })));
const DebtPage = lazy(() => import('@/pages/Debt').then(m => ({ default: m.DebtPage })));
const CashFlowPage = lazy(() => import('@/pages/CashFlow').then(m => ({ default: m.CashFlowPage })));
const DocumentsPage = lazy(() => import('@/pages/Documents').then(m => ({ default: m.DocumentsPage })));
const AICopilotPage = lazy(() => import('@/pages/AICopilot').then(m => ({ default: m.AICopilotPage })));
const DealRadarPage = lazy(() => import('@/pages/DealRadar').then(m => ({ default: m.DealRadarPage })));
const NewsPage = lazy(() => import('@/pages/News').then(m => ({ default: m.NewsPage })));
const SettingsPage = lazy(() => import('@/pages/Settings').then(m => ({ default: m.SettingsPage })));

const base = import.meta.env.BASE_URL.replace(/\/$/, '');

function PageFallback() {
  const de = useLanguage().lang === 'de';
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 240, color: 'rgba(60,60,67,0.35)', fontSize: 13 }}>
      {de ? 'Lädt…' : 'Loading…'}
    </div>
  );
}

export default function App() {
  return (
    <BrowserRouter basename={base}>
      <Suspense fallback={<PageFallback />}>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route
            path="/*"
            element={
              <AuthGuard>
                <Layout>
                  <Suspense fallback={<PageFallback />}>
                    <Routes>
                      <Route path="/" element={<PortfolioPage />} />
                      <Route path="/cashflow" element={<CashFlowPage />} />
                      <Route path="/assets" element={<AssetsPage />} />
                      <Route path="/assets/:id" element={<AssetDetailPage />} />
                      <Route path="/developments" element={<DevelopmentsPage />} />
                      <Route path="/developments/:id" element={<DevelopmentDetailPage />} />
                      <Route path="/debt" element={<DebtPage />} />
                      <Route path="/sales" element={<SalesPage />} />
                      <Route path="/sales/:id" element={<SaleDetailPage />} />
                      <Route path="/acquisition" element={<AcquisitionPage />} />
                      <Route path="/acquisition/:id" element={<DealDashboard />} />
                      <Route path="/radar" element={<DealRadarPage />} />
                      <Route path="/markt" element={<MarktPage />} />
                      {/* Legacy route — Market Intelligence is merged into /markt. */}
                      <Route path="/market-intelligence" element={<Navigate to="/markt" replace />} />
                      <Route path="/documents" element={<DocumentsPage />} />
                      <Route path="/ai" element={<AICopilotPage />} />
                      <Route path="/news" element={<NewsPage />} />
                      <Route path="/settings" element={<SettingsPage />} />
                    </Routes>
                  </Suspense>
                </Layout>
              </AuthGuard>
            }
          />
        </Routes>
      </Suspense>
    </BrowserRouter>
  );
}
