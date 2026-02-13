import { BrowserRouter, Routes, Route, Navigate, Link } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext.jsx';
import Dashboard from './components/Dashboard.jsx';
import Login from './components/Login.jsx';
import Register from './components/Register.jsx';
import CreateGroup from './components/CreateGroup.jsx';
import AdminApproval from './components/AdminApproval.jsx';
import JoinGroup from './components/JoinGroup.jsx';
import ForgotPassword from './components/ForgotPassword.jsx';
import ProtectedRoute from './components/ProtectedRoute.jsx';
import AvailableGroups from './components/AvailableGroups.jsx';
import LandingPage from './components/LandingPage.jsx';

function AppRoutes() {
    const { user, loading, logout } = useAuth();

    if (loading) {
        return (
            <div className="login-container">
                <div className="skeleton" style={{ width: 200, height: 40 }} />
            </div>
        );
    }

    return (
        <Routes>
            {/* Cadastro */}
            <Route path="/cadastro" element={<Register />} />

            {/* Login */}
            <Route path="/login" element={<Login />} />
            <Route path="/recuperar-senha" element={<ForgotPassword />} />
            <Route path="/admin/login" element={<Navigate to="/login" replace />} />

            {/* Criar novo grupo (requer login) */}
            <Route path="/criar" element={
                <ProtectedRoute>
                    <CreateGroup />
                </ProtectedRoute>
            } />

            {/* Painel de aprovações (super-admin) */}
            <Route path="/aprovacoes" element={<AdminApproval />} />

            {/* Entrar em um grupo (requer login) */}
            <Route path="/entrar/:grupoId" element={
                <ProtectedRoute>
                    <JoinGroup />
                </ProtectedRoute>
            } />

            {/* Dashboard público (read-only) */}
            <Route path="/g/:grupoId" element={<Dashboard />} />

            {/* Lista de grupos disponíveis */}
            <Route path="/grupos" element={
                <div className="container">
                    {user && (
                        <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: 'var(--space-2)', marginBottom: 'var(--space-3)' }}>
                            <span style={{ fontSize: 'var(--font-size-sm)', color: 'var(--text-secondary)' }}>
                                👤 {user.nome}
                            </span>
                            <button
                                className="btn btn-secondary"
                                style={{ padding: '4px 12px', fontSize: 'var(--font-size-xs)' }}
                                onClick={() => { logout(); window.location.href = '/'; }}
                            >
                                Sair
                            </button>
                        </div>
                    )}
                    <h1 style={{ marginBottom: 'var(--space-4)', textAlign: 'center' }}>🚗 Grupos Disponíveis</h1>
                    <AvailableGroups />
                    <div style={{ textAlign: 'center', marginTop: 'var(--space-4)' }}>
                        <Link to="/" className="btn btn-secondary">🏠 Voltar ao Início</Link>
                    </div>
                </div>
            } />

            {/* Dashboard admin (protegido - motoristas) */}
            <Route
                path="/admin/:grupoId"
                element={
                    <ProtectedRoute requiredRole="motorista">
                        <Dashboard isAdmin />
                    </ProtectedRoute>
                }
            />

            {/* Landing page */}
            <Route path="/" element={<LandingPage />} />
        </Routes>
    );
}

function App() {
    return (
        <AuthProvider>
            <BrowserRouter>
                <AppRoutes />
            </BrowserRouter>
        </AuthProvider>
    );
}

export default App;
