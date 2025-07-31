// ui/src/App.jsx

import React, { useContext, useState } from 'react';
import LoginForm from './components/LoginForm';
import SignUpForm from './components/SignUpForm';
import InviteAcceptForm from './components/InviteAcceptForm';
import { AuthContext } from './lib/authContext';
import { Routes, Route } from 'react-router-dom';
import Dashboard from './pages/Dashboard.jsx';
import LandAcquisitionPage from './pages/LandAcquisitionPage.jsx';
import MarketAnalysisPage from './pages/MarketAnalysisPage.jsx';
import SettingsPage from './pages/SettingsPage.jsx';
import EmployeeDashboard from './pages/EmployeeDashboard.jsx';
import Features from './pages/Features.jsx';
import LoanDashboard from './pages/LoanDashboard.jsx';
import Overview from './pages/Overview.jsx';
import Exposure from './pages/Exposure.jsx';
import Events from './pages/Events.jsx';
import LoanNotes from './pages/LoanNotes.jsx';
import AnalyticsOverview from './pages/AnalyticsOverview.jsx';
import LoanMaster from './pages/LoanMaster.jsx';
import ConsolidatedNotes from './pages/ConsolidatedNotes.jsx';
import Installments from './pages/Installments.jsx';
import PaymentAnalysis from './pages/PaymentAnalysis.jsx';
import AmortizationSchedule from './pages/AmortizationSchedule.jsx';
import Servicing from './pages/Servicing.jsx';
import DrawRequests from './pages/DrawRequests.jsx';
import NewApplication from './pages/NewApplication.jsx';
import ApplicationList from './pages/ApplicationList.jsx';
import RiskMonitoring from './pages/RiskMonitoring.jsx';
import TroubledAssets from './pages/TroubledAssets.jsx';
import RevivedSales from './pages/RevivedSales.jsx';
import Reports from './pages/Reports.jsx';
import InvestorReports from './pages/InvestorReports.jsx';
import LiveAnalytics from './pages/LiveAnalytics.jsx';
import Alerts from './pages/Alerts.jsx';
import DevTools from './pages/DevTools.jsx';
import GenerateLoans from './pages/GenerateLoans.jsx';
import GuestCRMPage from './pages/GuestCRMPage.jsx';
import GuestChatPage from './pages/GuestChatPage.jsx';
import GuestReservationsPage from './pages/GuestReservationsPage.jsx';
import BookingCalendarPage from './pages/BookingCalendarPage.jsx';
import RestaurantMenuPage from './pages/RestaurantMenuPage.jsx';
import RestaurantDashboardPage from './pages/RestaurantDashboardPage.jsx';

export default function App() {
    const { session } = useContext(AuthContext);
  const [signUp, setSignUp] = useState(false);
  const params = new URLSearchParams(window.location.search);
  const inviteToken = params.get('invite');
  if (!session) {
    if (inviteToken) {
      return <InviteAcceptForm token={inviteToken} />;
    }
    return signUp ? (
      <SignUpForm onSwitch={() => setSignUp(false)} />
    ) : (
      <LoginForm onSwitch={() => setSignUp(true)} />
      );
  }

  return (
    <Routes>
      <Route path="/" element={<Dashboard />} />
      <Route path="/land-acquisition" element={<LandAcquisitionPage />} />
      <Route path="/market-analysis" element={<MarketAnalysisPage />} />
      <Route path="/settings" element={<SettingsPage />} />
             <Route path="/employee-dashboard" element={<EmployeeDashboard />} />
      <Route path="/features" element={<Features />} />
      <Route path="/loan-dashboard" element={<LoanDashboard />} />
      <Route path="/overview" element={<Overview />} />
      <Route path="/exposure" element={<Exposure />} />
      <Route path="/events" element={<Events />} />
      <Route path="/loan-notes" element={<LoanNotes />} />
      <Route path="/analytics-overview" element={<AnalyticsOverview />} />
      <Route path="/loan-master" element={<LoanMaster />} />
      <Route path="/consolidated-notes" element={<ConsolidatedNotes />} />
      <Route path="/installments-due/paid" element={<Installments />} />
      <Route path="/payment-analysis" element={<PaymentAnalysis />} />
      <Route path="/amortization-schedule" element={<AmortizationSchedule />} />
      <Route path="/servicing" element={<Servicing />} />
      <Route path="/draw-requests" element={<DrawRequests />} />
      <Route path="/new-application" element={<NewApplication />} />
      <Route path="/application-list" element={<ApplicationList />} />
      <Route path="/risk-monitoring" element={<RiskMonitoring />} />
      <Route path="/troubled-assets" element={<TroubledAssets />} />
      <Route path="/revived-sales" element={<RevivedSales />} />
      <Route path="/investor-reporting" element={<Reports />} />
      <Route path="/reports" element={<Reports />} />
      <Route path="/investor-reports" element={<InvestorReports />} />
      <Route path="/live-analytics" element={<LiveAnalytics />} />
      <Route path="/alerts" element={<Alerts />} />
      <Route path="/dev-tools" element={<DevTools />} />
      <Route path="/generate-loans" element={<GenerateLoans />} />
      <Route path="/guest-crm" element={<GuestCRMPage />} />
      <Route path="/guest-chat" element={<GuestChatPage />} />
      <Route path="/guest-reservations" element={<GuestReservationsPage />} />
      <Route path="/booking-calendar" element={<BookingCalendarPage />} />
      <Route path="/restaurant-menu" element={<RestaurantMenuPage />} />
      <Route path="/restaurant-dashboard" element={<RestaurantDashboardPage />} />
    </Routes>
  );
}
