import { Navigate } from 'react-router-dom';

// Dashboard is just the projects list — redirect immediately.
export default function DashboardPage() {
  return <Navigate to="/projects" replace />;
}
