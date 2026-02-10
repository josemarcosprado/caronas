/**
 * Contexto de Autenticação
 * Gerencia estado global do usuário e persistência de sessão
 */

import { createContext, useContext, useState, useEffect } from 'react';
import { supabase } from '../lib/supabase.js';

const AuthContext = createContext(null);

const STORAGE_KEY = 'cajurona_session';

/**
 * Provider de autenticação
 */
export function AuthProvider({ children }) {
    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true);

    // Restaurar sessão do localStorage ao iniciar
    useEffect(() => {
        const stored = localStorage.getItem(STORAGE_KEY);
        if (stored) {
            try {
                const session = JSON.parse(stored);
                setUser(session);
            } catch (e) {
                localStorage.removeItem(STORAGE_KEY);
            }
        }
        setLoading(false);
    }, []);

    /**
     * Fazer login
     * @param {Object} userData - Dados do usuário
     * @param {'motorista' | 'passageiro'} role - Role do usuário
     */
    const login = (userData, role) => {
        const session = {
            id: userData.id,
            nome: userData.nome,
            telefone: userData.telefone,
            grupoId: userData.grupo_id,
            role: role,
            isMotorista: role === 'motorista'
        };
        
        setUser(session);
        localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
    };

    /**
     * Fazer logout
     */
    const logout = () => {
        setUser(null);
        localStorage.removeItem(STORAGE_KEY);
    };

    /**
     * Verificar se está autenticado
     */
    const isAuthenticated = () => {
        return user !== null;
    };

    /**
     * Verificar se tem role específico
     * @param {'motorista' | 'passageiro'} requiredRole 
     */
    const hasRole = (requiredRole) => {
        if (!user) return false;
        if (requiredRole === 'motorista') return user.role === 'motorista';
        // Passageiro pode acessar tudo que não requer motorista
        return true;
    };

    const value = {
        user,
        loading,
        login,
        logout,
        isAuthenticated,
        hasRole,
        role: user?.role || null,
        isMotorista: user?.isMotorista || false,
        grupoId: user?.grupoId || null
    };

    return (
        <AuthContext.Provider value={value}>
            {children}
        </AuthContext.Provider>
    );
}

/**
 * Hook para usar o contexto de autenticação
 */
export function useAuth() {
    const context = useContext(AuthContext);
    if (!context) {
        throw new Error('useAuth deve ser usado dentro de um AuthProvider');
    }
    return context;
}

export default AuthContext;
