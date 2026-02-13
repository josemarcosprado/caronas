import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext.jsx';
import Dashboard from './components/Dashboard.jsx';
import MyGroups from './components/MyGroups.jsx';
import Login from './components/Login.jsx';
import Register from './components/Register.jsx';
import CreateGroup from './components/CreateGroup.jsx';
import AdminApproval from './components/AdminApproval.jsx';
import JoinGroup from './components/JoinGroup.jsx';
import ForgotPassword from './components/ForgotPassword.jsx';
import ProtectedRoute from './components/ProtectedRoute.jsx';
import LandingPage from './components/LandingPage.jsx';

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
            {/* Auth */}
            <Route path="/cadastro" element={<Register />} />
            <Route path="/login" element={<Login />} />
            <Route path="/recuperar-senha" element={<ForgotPassword />} />
            <Route path="/admin/login" element={<Navigate to="/login" replace />} />

            {/* User Dashboard — meus grupos, perfil, etc. */}
            <Route path="/meus-grupos" element={
                <ProtectedRoute>
                    <MyGroups />
                </ProtectedRoute>
            } />

            {/* Legacy /grupos redirect */}
            <Route path="/grupos" element={<Navigate to={user ? '/meus-grupos' : '/login'} replace />} />

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

            {/* Group Dashboard (member view) */}
            <Route path="/g/:grupoId" element={<Dashboard />} />

            {/* Group Dashboard (admin view) */}
            <Route path="/admin/:grupoId" element={
                <ProtectedRoute>
                    <Dashboard isAdmin />
                </ProtectedRoute>
            } />

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
