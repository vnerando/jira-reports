import { Navigate } from 'react-router-dom';

/**
 * Redireciona para /login se não houver token válido no localStorage.
 */
const ProtectedRoute = ({ children }) => {
  const token = localStorage.getItem('noc_token');
  if (!token) return <Navigate to="/login" replace />;
  return children;
};

export default ProtectedRoute;
