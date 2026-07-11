import { Suspense } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Layout from './components/layout/Layout';
import AuthGuard from './components/AuthGuard';
import LoginPage from './pages/Login';
import PortfolioPage from './pages/Portfolio';
import { AssetsPage, AssetDetailPage } from './pages/Assets';
import AcquisitionPage from './pages/Acquisition';
import DealDashboard from './pages/DealDashboard';
import { DevelopmentsPage, DevelopmentDetailPage } from './pages/Developments';
import { SalesPage, SaleDetailPage } from './pages/Sales';
import { MarktPage, DebtPage, CashFlowPage, DocumentsPage, AICopilotPage, DealRadarPage, NewsPage, SettingsPage } from './pages/OtherPages';

const base = import.meta.env.BASE_URL.replace(/\/$/, '');

export default function App() {
  return (
    <BrowserRouter basename={base}>
      <Suspense fallback={null}>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route
            path="/*"
            element={
              <AuthGuard>
                <Layout>
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
                </Layout>
              </AuthGuard>
            }
          />
        </Routes>
      </Suspense>
    </BrowserRouter>
  );
}
