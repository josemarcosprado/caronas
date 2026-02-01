import { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Dashboard from './components/Dashboard.jsx';
import Login from './components/Login.jsx';
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
                {/* Dashboard público (read-only) */}
                <Route path="/:grupoId" element={<Dashboard />} />

                {/* Login admin */}
                <Route path="/admin/login" element={<Login />} />

                {/* Dashboard admin (protegido) */}
                <Route
                    path="/admin/:grupoId"
                    element={session ? <Dashboard isAdmin /> : <Navigate to="/admin/login" />}
                />

                {/* Redirect raiz */}
                <Route path="/" element={
                    <div className="login-container">
                        <div className="empty-state">
                            <div className="icon">🚗</div>
                            <h2>Cajurona</h2>
                            <p>Acesse o link do seu grupo para ver o status das caronas.</p>
                        </div>
                    </div>
                } />
            </Routes>
        </BrowserRouter>
    );
}

export default App;
