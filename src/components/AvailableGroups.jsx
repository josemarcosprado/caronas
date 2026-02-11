import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase.js';
import { useAuth } from '../contexts/AuthContext.jsx';
import { useNavigate } from 'react-router-dom';

export default function AvailableGroups() {
    const [groups, setGroups] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const { user, switchGroup } = useAuth();
    const navigate = useNavigate();

    useEffect(() => {
        loadGroups();
    }, []);

    const loadGroups = async () => {
        try {
            setLoading(true);
            setError(null);
            // Buscar apenas grupos por enquanto para debug
            const { data, error: fetchError } = await supabase
                .from('grupos')
                .select('*');

            if (fetchError) throw fetchError;
            setGroups(data || []);
        } catch (err) {
            console.error('Erro ao carregar grupos:', err);
            setError('Não foi possível carregar os grupos disponíveis.');
        } finally {
            setLoading(false);
        }
    };

    const handleJoin = (groupId) => {
        // Redirecionar para a tela de entrar
        navigate(`/entrar/${groupId}`);
    };

    const handleSwitch = async (groupId) => {
        const success = await switchGroup(groupId);
        if (success) {
            // Recarregar a página ou navegar para o dashboard do grupo
            window.location.href = `/g/${groupId}`;
        } else {
            alert('Erro ao trocar de grupo.');
        }
    };

    const isMember = (groupId) => {
        return user?.memberships?.some(m => m.grupo_id === groupId);
    };

    const getMembershipStatus = (groupId) => {
        const member = user?.memberships?.find(m => m.grupo_id === groupId);
        return member ? member.status_aprovacao : null;
    };

    if (loading) return <div style={{ padding: '20px', textAlign: 'center' }}>Carregando grupos...</div>;

    return (
        <div style={{ display: 'grid', gap: '1rem', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))' }}>
            {groups.map(group => {
                const memberStatus = getMembershipStatus(group.id);
                const isCurrentGroup = user?.grupoId === group.id;

                return (
                    <div key={group.id} className="card" style={{
                        padding: '1.5rem',
                        border: isCurrentGroup ? '2px solid var(--primary)' : '1px solid var(--border-color)',
                        borderRadius: 'var(--radius-md)',
                        background: 'var(--bg-card)'
                    }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1rem' }}>
                            <h3 style={{ margin: 0, fontSize: '1.1rem' }}>{group.nome}</h3>
                            {isCurrentGroup && <span className="badge" style={{ background: 'var(--primary)', color: 'white', fontSize: '0.7rem', padding: '2px 6px', borderRadius: '4px' }}>ATUAL</span>}
                        </div>

                        <div style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', marginBottom: '1rem' }}>
                            <div style={{ marginBottom: '4px' }}>
                                🛣️ {group.modelo_precificacao === 'por_trajeto'
                                    ? `R$ ${parseFloat(group.valor_trajeto).toFixed(2)} / trajeto`
                                    : `R$ ${parseFloat(group.valor_semanal).toFixed(2)} / semana`}
                            </div>
                            <div style={{ marginBottom: '4px' }}>
                                👥 {group.membros?.[0]?.count || 0} membros
                            </div>
                            <div>
                                🕐 {group.horario_ida?.slice(0, 5)} - {group.horario_volta?.slice(0, 5)}
                            </div>
                        </div>

                        <div style={{ marginTop: 'auto' }}>
                            {memberStatus === 'aprovado' ? (
                                isCurrentGroup ? (
                                    <button disabled className="btn btn-secondary" style={{ width: '100%', opacity: 0.7 }}>
                                        Selecionado
                                    </button>
                                ) : (
                                    <button
                                        className="btn btn-secondary"
                                        style={{ width: '100%' }}
                                        onClick={() => handleSwitch(group.id)}
                                    >
                                        Alternar para este grupo
                                    </button>
                                )
                            ) : memberStatus === 'pendente' ? (
                                <button disabled className="btn btn-secondary" style={{ width: '100%', background: 'var(--warning-bg)', color: 'var(--warning)' }}>
                                    Aguardando aprovação
                                </button>
                            ) : (
                                <button
                                    className="btn btn-primary"
                                    style={{ width: '100%' }}
                                    onClick={() => handleJoin(group.id)}
                                >
                                    Solicitar Entrada
                                </button>
                            )}
                        </div>
                    </div>
                );
            })}
        </div>
    );
}
