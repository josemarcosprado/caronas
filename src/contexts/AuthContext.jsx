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
     * @param {Object} userData - Dados do usuário (membro)
     * @param {'motorista' | 'passageiro'} role - Role do usuário
     * @param {Array} allMemberships - Lista de todos os registros de mebro deste usuário (opcional)
     */
    const login = (userData, role, allMemberships = []) => {
        // Se não vier memberships explícitos, assumimos o atual como único inicial
        const memberships = allMemberships.length > 0 ? allMemberships : [userData];

        const session = {
            id: userData.id,
            nome: userData.nome,
            telefone: userData.telefone,
            grupoId: userData.grupo_id, // Grupo ativo
            role: role,
            isMotorista: role === 'motorista',
            memberships: memberships // Todos os grupos
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

        // Atualizar sessão com todos os dados do novo contexto
        const newSession = {
            ...user,
            id: targetMembership.id, // ID do membro pode mudar por grupo
            grupoId: targetMembership.grupo_id,
            role: targetMembership.is_motorista ? 'motorista' : 'passageiro',
            isMotorista: targetMembership.is_motorista,
            // Mantemos nome/telefone/memberships globais
        };

        setUser(newSession);
        localStorage.setItem(STORAGE_KEY, JSON.stringify(newSession));
        return true;
    };

    /**
     * Atualizar dados da sessão (ex: após aceitar convite)
     */
    const refreshSession = async () => {
        if (!user) return;

        try {
            // Recarregar memberships (Passo 1: buscar membros)
            const { data: membrosData, error: membrosError } = await supabase
                .from('membros')
                .select('*')
                .eq('telefone', user.telefone);

            if (membrosError || !membrosData) return;

            // Passo 2: Buscar grupos
            const grupoIds = [...new Set(membrosData.map(m => m.grupo_id).filter(id => id))];
            let gruposData = [];

            if (grupoIds.length > 0) {
                const { data: gData } = await supabase
                    .from('grupos')
                    .select('*')
                    .in('id', grupoIds);
                gruposData = gData || [];
            }

            // Combinar dados
            const memberships = membrosData.map(m => {
                const g = gruposData.find(grp => grp.id === m.grupo_id);
                return { ...m, grupos: g };
            });

            // Encontrar o membro ativo atual para atualizar dados
            const currentMem = memberships.find(m => m.grupo_id === user.grupoId) || memberships[0];

            login(currentMem, currentMem.is_motorista ? 'motorista' : 'passageiro', memberships);
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
        if (requiredRole === 'motorista') return user.role === 'motorista';
        // Passageiro pode acessar tudo que não requer motorista
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
