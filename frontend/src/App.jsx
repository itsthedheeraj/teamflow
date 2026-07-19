import { Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { UIProvider } from './context/UIContext';
import ProtectedRoute from './components/ProtectedRoute';
import LandingPage from './pages/LandingPage';
import SignupPage from './pages/SignupPage';
import LoginPage from './pages/LoginPage';
import DashboardPage from './pages/DashboardPage';
import AcceptInvitePage from './pages/AcceptInvitePage';
import TeamPage from './pages/TeamPage';
import ProjectsPage from './pages/ProjectsPage';
import TaskBoardPage from './pages/TaskBoardPage';
import BillingPage from './pages/BillingPage';
import MyInvitesPage from './pages/MyInvitesPage';
import SettingsPage from './pages/SettingsPage';
import TransferOrgPage from './pages/TransferOrgPage';

export default function App() {
  return (
    <UIProvider>
      <AuthProvider>
        <Routes>
          {/* Public marketing page — also handles the logged-in redirect
              to /projects internally, so no auth check needed here */}
          <Route path="/" element={<LandingPage />} />

          {/* Auth pages */}
          <Route path="/signup" element={<SignupPage />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/accept-invite" element={<AcceptInvitePage />} />
          {/* Transfer org — accessible without an active workspace */}
          <Route path="/transfer-org/:token" element={<TransferOrgPage />} />

          {/* Protected routes — ProtectedRoute redirects to /login if not authed */}
          <Route element={<ProtectedRoute />}>
            <Route path="/dashboard" element={<DashboardPage />} />
            <Route path="/projects" element={<ProjectsPage />} />
            <Route path="/projects/:projectId" element={<TaskBoardPage />} />
            <Route path="/invites" element={<MyInvitesPage />} />
            <Route path="/team" element={<TeamPage />} />
            <Route path="/billing" element={<BillingPage />} />
            <Route path="/settings" element={<SettingsPage />} />
          </Route>

          {/* Unknown routes go back to the front door, not login */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </AuthProvider>
    </UIProvider>
  );
}
