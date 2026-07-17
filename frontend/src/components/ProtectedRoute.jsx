import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

/**
 * Wraps routes that require authentication.
 * Redirects to /login if no auth state exists.
 * Preserves the intended destination in `state` so login can redirect back.
 */
export default function ProtectedRoute() {
  const { auth } = useAuth();
  const location = useLocation();
  return auth
    ? <Outlet />
    : <Navigate to="/login" state={{ from: location }} replace />;
}
