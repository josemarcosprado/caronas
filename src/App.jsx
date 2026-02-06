import { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate, Link } from 'react-router-dom';
import Dashboard from './components/Dashboard.jsx';
import Login from './components/Login.jsx';
import CreateGroup from './components/CreateGroup.jsx';
import { supabase } from './lib/supabase.js';

function App() {
    const [session, setSession] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        // Checar sessão existente
        supabase.auth.getSession().then(({ data: { session } }) => {
            setSession(session);
            setLoading(false);
        });

        // Escutar mudanças de auth
        const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
            setSession(session);
        });

        return () => subscription.unsubscribe();
    }, []);

    if (loading) {
        return (
            <div className="login-container">
                <div className="skeleton" style={{ width: 200, height: 40 }} />
            </div>
        );
    }

    return (
        <BrowserRouter>
            <Routes>
                {/* Criar novo grupo */}
                <Route path="/criar" element={<CreateGroup />} />

                {/* Dashboard público (read-only) */}
                <Route path="/g/:grupoId" element={<Dashboard />} />

                {/* Login admin */}
                <Route path="/admin/login" element={<Login />} />

                {/* Dashboard admin (protegido) */}
                <Route
                    path="/admin/:grupoId"
                    element={session ? <Dashboard isAdmin /> : <Navigate to="/admin/login" />}
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

                            <Link to="/criar" className="btn btn-primary" style={{ marginBottom: 'var(--space-4)' }}>
                                ✨ Criar Novo Grupo
                            </Link>

                            <p style={{
                                fontSize: 'var(--font-size-sm)',
                                color: 'var(--text-muted)',
                                marginTop: 'var(--space-4)'
                            }}>
                                Já tem um grupo? Acesse pelo link que você recebeu.
                            </p>
                        </div>
                    </div>
                } />
            </Routes>
        </BrowserRouter>
    );
}

export default App;

