/**
 * Contexto de Autenticação
 * Gerencia estado global do usuário e persistência de sessão
 * Sessão agora baseada em `usuarios` (identidade) + `membros` (participações)
 */

import { createContext, useContext, useState, useEffect } from 'react';
import { supabase } from '../lib/supabase.js';

const AuthContext = createContext(null);

const STORAGE_KEY = 'cajurona_session';

// Super admin phones (comma-separated in env, e.g. "5579998223366,5511999998888")
const SUPER_ADMIN_PHONES = (import.meta.env.VITE_SUPER_ADMIN_PHONES || '').split(',').map(p => p.trim()).filter(Boolean);

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
     * @param {Object} usuario - Dados do usuário (tabela `usuarios`)
     * @param {Array} memberships - Lista de registros de `membros` com dados de `grupos`
     */
    const login = (usuario, memberships = []) => {
        // Encontrar grupo ativo (preferir aprovado, depois qualquer um)
        const aprovados = memberships.filter(m => m.status_aprovacao === 'aprovado');
        const activeMembership = aprovados[0] || memberships[0] || null;

        // Check super admin status
        const isSuperAdmin = SUPER_ADMIN_PHONES.length > 0 &&
            SUPER_ADMIN_PHONES.some(p => usuario.telefone?.includes(p));

        const session = {
            // Dados do usuário (identidade)
            id: usuario.id,
            nome: usuario.nome,
            telefone: usuario.telefone,
            matricula: usuario.matricula,
            matriculaStatus: usuario.matricula_status,
            bairro: usuario.bairro || '',
            cnhUrl: usuario.cnh_url,
            cnhStatus: usuario.cnh_status,
            podeSerMotorista: usuario.pode_ser_motorista,
            // Grupo ativo (se tiver)
            grupoId: activeMembership?.grupo_id || null,
            membroId: activeMembership?.id || null,
            role: activeMembership?.is_motorista ? 'motorista' : 'passageiro',
            isMotorista: activeMembership?.is_motorista || false,
            isSuperAdmin,
            statusAprovacao: activeMembership?.status_aprovacao || null,
            // Todos os grupos
            memberships: memberships
        };

        setUser(session);
        localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
    };

    /**
     * Trocar de grupo ativo
     * @param {string} targetGroupId
     */
    const switchGroup = async (targetGroupId) => {
        if (!user || !user.memberships) return false;

        const targetMembership = user.memberships.find(m => m.grupo_id === targetGroupId);

        if (!targetMembership) {
            console.error('Usuário não é membro do grupo alvo');
            return false;
        }

        const newSession = {
            ...user,
            grupoId: targetMembership.grupo_id,
            membroId: targetMembership.id,
            role: targetMembership.is_motorista ? 'motorista' : 'passageiro',
            isMotorista: targetMembership.is_motorista,
            statusAprovacao: targetMembership.status_aprovacao,
        };

        setUser(newSession);
        localStorage.setItem(STORAGE_KEY, JSON.stringify(newSession));
        return true;
    };

    /**
     * Atualizar dados da sessão (ex: após entrar num grupo)
     */
    const refreshSession = async () => {
        if (!user) return;

        try {
            // 1. Recarregar dados do usuário
            const { data: usuario, error: userError } = await supabase
                .from('usuarios')
                .select('*')
                .eq('id', user.id)
                .single();

            if (userError || !usuario) return;

            // 2. Recarregar memberships
            const { data: memberships } = await supabase
                .from('membros')
                .select('*, grupos(*)')
                .eq('usuario_id', user.id)
                .eq('ativo', true);

            // 3. Rebuild session mantendo grupo ativo se possível
            const currentMembership = (memberships || []).find(m => m.grupo_id === user.grupoId);
            const aprovados = (memberships || []).filter(m => m.status_aprovacao === 'aprovado');
            const activeMembership = currentMembership || aprovados[0] || (memberships || [])[0] || null;

            const isSuperAdmin = SUPER_ADMIN_PHONES.length > 0 &&
                SUPER_ADMIN_PHONES.some(p => usuario.telefone?.includes(p));

            const session = {
                id: usuario.id,
                nome: usuario.nome,
                telefone: usuario.telefone,
                matricula: usuario.matricula,
                matriculaStatus: usuario.matricula_status,
                bairro: usuario.bairro || '',
                cnhUrl: usuario.cnh_url,
                cnhStatus: usuario.cnh_status,
                podeSerMotorista: usuario.pode_ser_motorista,
                grupoId: activeMembership?.grupo_id || null,
                membroId: activeMembership?.id || null,
                role: activeMembership?.is_motorista ? 'motorista' : 'passageiro',
                isMotorista: activeMembership?.is_motorista || false,
                isSuperAdmin,
                statusAprovacao: activeMembership?.status_aprovacao || null,
                memberships: memberships || []
            };

            setUser(session);
            localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
        } catch (e) {
            console.error('Erro ao atualizar sessão:', e);
        }
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
        if (user.isSuperAdmin) return true;
        if (requiredRole === 'motorista') return user.role === 'motorista';
        return true;
    };

    const value = {
        user,
        loading,
        login,
        logout,
        switchGroup,
        refreshSession,
        isAuthenticated,
        hasRole,
        role: user?.role || null,
        isMotorista: user?.isMotorista || false,
        isSuperAdmin: user?.isSuperAdmin || false,
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
