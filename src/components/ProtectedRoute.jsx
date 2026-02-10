/**
 * Componente de Rota Protegida
 * Verifica autenticação e role antes de renderizar
 */

import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext.jsx';

/**
 * Wrapper para rotas que requerem autenticação
 * @param {Object} props
 * @param {React.ReactNode} props.children - Componente a renderizar
 * @param {'motorista' | 'passageiro' | null} props.requiredRole - Role necessário (null = qualquer autenticado)
 * @param {string} props.redirectTo - Para onde redirecionar se não autorizado
 */
export default function ProtectedRoute({ 
    children, 
    requiredRole = null, 
    redirectTo = '/login' 
}) {
    const { user, loading, hasRole } = useAuth();
    const location = useLocation();

    // Ainda carregando sessão
    if (loading) {
        return (
            <div className="login-container">
                <div className="skeleton" style={{ width: 200, height: 40 }} />
            </div>
        );
    }

    // Não autenticado
    if (!user) {
        return <Navigate to={redirectTo} state={{ from: location }} replace />;
    }

    // Verificar role se necessário
    if (requiredRole && !hasRole(requiredRole)) {
        // Passageiro tentando acessar área de motorista
        if (requiredRole === 'motorista' && user.role === 'passageiro') {
            // Redirecionar para dashboard público do grupo dele
            return <Navigate to={`/g/${user.grupoId}`} replace />;
        }
        return <Navigate to="/" replace />;
    }

    return children;
}
