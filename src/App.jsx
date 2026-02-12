import { BrowserRouter, Routes, Route, Navigate, Link } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext.jsx';
import Dashboard from './components/Dashboard.jsx';
import Login from './components/Login.jsx';
import Register from './components/Register.jsx';
import CreateGroup from './components/CreateGroup.jsx';
import AdminApproval from './components/AdminApproval.jsx';
import JoinGroup from './components/JoinGroup.jsx';
import ProtectedRoute from './components/ProtectedRoute.jsx';
import AvailableGroups from './components/AvailableGroups.jsx';

function AppRoutes() {
    const { user, loading } = useAuth();

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
            <Route path="/" element={
                <div className="login-container">
                    <div className="login-card" style={{ textAlign: 'center' }}>
                        <div style={{ fontSize: '4rem', marginBottom: 'var(--space-4)' }}>🚗</div>
                        <h1 style={{ fontSize: 'var(--font-size-2xl)', marginBottom: 'var(--space-2)' }}>
                            Cajurona
                        </h1>
                        <p style={{ color: 'var(--text-secondary)', marginBottom: 'var(--space-6)' }}>
                            Gerenciamento de caronas recorrentes
                        </p>

                        {user ? (
                            <>
                                <p style={{ marginBottom: 'var(--space-4)', color: 'var(--text-primary)' }}>
                                    Olá, <strong>{user.nome}</strong>! 👋
                                </p>
                                {user.grupoId ? (
                                    <Link
                                        to={user.isMotorista ? `/admin/${user.grupoId}` : `/g/${user.grupoId}`}
                                        className="btn btn-primary"
                                        style={{ marginBottom: 'var(--space-3)' }}
                                    >
                                        📊 Ir para o Dashboard
                                    </Link>
                                ) : (
                                    <Link
                                        to="/grupos"
                                        className="btn btn-primary"
                                        style={{ marginBottom: 'var(--space-3)' }}
                                    >
                                        🔍 Ver Grupos Disponíveis
                                    </Link>
                                )}
                                <Link to="/criar" className="btn btn-secondary" style={{ marginBottom: 'var(--space-3)' }}>
                                    ✨ Criar Novo Grupo
                                </Link>
                            </>
                        ) : (
                            <>
                                <Link to="/login" className="btn btn-primary" style={{ marginBottom: 'var(--space-3)' }}>
                                    🔑 Entrar
                                </Link>
                                <Link to="/cadastro" className="btn btn-secondary" style={{ marginBottom: 'var(--space-3)' }}>
                                    📋 Cadastre-se
                                </Link>
                            </>
                        )}

                        <p style={{
                            fontSize: 'var(--font-size-sm)',
                            color: 'var(--text-muted)',
                            marginTop: 'var(--space-4)'
                        }}>
                            {user
                                ? 'Crie um grupo ou entre em um existente.'
                                : 'Crie sua conta para começar.'
                            }
                        </p>
                    </div>
                </div>
            } />
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
