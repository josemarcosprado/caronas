import { useState, useEffect, useCallback, useMemo } from 'react';
import { useParams, Link, useNavigate, useSearchParams } from 'react-router-dom';
import { supabase } from '../lib/supabase.js';
import { useAuth } from '../contexts/AuthContext.jsx';

// Removed self-import
import AvailableGroups from './AvailableGroups.jsx';

export default function Dashboard({ isAdmin = false }) {
    const { grupoId } = useParams();
    const navigate = useNavigate();
    const { user, logout, isMotorista, refreshSession, switchGroup, isSuperAdmin } = useAuth();
    const [showGroupSwitcher, setShowGroupSwitcher] = useState(false);

    // Determinar se é admin: prop OU usuário logado como motorista OU super admin
    const canEdit = isAdmin || isMotorista || isSuperAdmin;

    const [grupo, setGrupo] = useState(null);
    const [membros, setMembros] = useState([]);
    const [pendentes, setPendentes] = useState([]);
    const [viagens, setViagens] = useState([]);
    const [saldoPorMembro, setSaldoPorMembro] = useState({});
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [imagemExpandida, setImagemExpandida] = useState(null);
    const [searchParams, setSearchParams] = useSearchParams();
    const activeTab = useMemo(() => {
        const tab = searchParams.get('tab');
        const validTabs = ['inicio', 'viagens', 'membros', 'config', 'grupos', 'perfil'];
        return validTabs.includes(tab) ? tab : 'inicio';
    }, [searchParams]);
    const changeTab = useCallback((tab) => {
        setSearchParams({ tab }, { replace: false });
    }, [setSearchParams]);
    const [editando, setEditando] = useState(false);
    const [formConfig, setFormConfig] = useState({});
    const [inviteLink, setInviteLink] = useState(null);
    const [inviteLinkLoading, setInviteLinkLoading] = useState(false);

    // Estado para edição de perfil
    const [perfilEdit, setPerfilEdit] = useState({
        nome: user?.nome || '',
        telefone: user?.telefone || '',
        matricula: user?.matricula || ''
    });
    const [savingProfile, setSavingProfile] = useState(false);

    // Atualizar estado de perfil quando user mudar
    useEffect(() => {
        if (user) {
            setPerfilEdit({
                nome: user.nome || '',
                telefone: user.telefone || '',
                matricula: user.matricula || ''
            });
        }
    }, [user]);

    // Carregar dados
    const loadData = useCallback(async () => {
        try {
            if (!grupoId || grupoId === 'undefined' || grupoId === 'null') {
                navigate('/grupos');
                return;
            }

            setError(null);

            // Buscar grupo
            const { data: grupoData, error: grupoError } = await supabase
                .from('grupos')
                .select('*')
                .eq('id', grupoId)
                .single();

            if (grupoError) throw grupoError;
            setGrupo(grupoData);
            setFormConfig({
                nome: grupoData.nome,
                horario_ida: grupoData.horario_ida?.slice(0, 5) || '07:00',
                horario_volta: grupoData.horario_volta?.slice(0, 5) || '18:00',
                modelo_precificacao: grupoData.modelo_precificacao || 'semanal',
                valor_semanal: grupoData.valor_semanal || 0,
                valor_trajeto: grupoData.valor_trajeto || 0,
                tempo_limite_cancelamento: grupoData.tempo_limite_cancelamento || 30
            });

            // Buscar membros aprovados (JOIN com usuarios para nome/telefone)
            const { data: membrosData, error: membrosError } = await supabase
                .from('membros')
                .select('*, usuarios(nome, telefone, matricula, cnh_url)')
                .eq('grupo_id', grupoId)
                .eq('ativo', true)
                .eq('status_aprovacao', 'aprovado')
                .order('is_motorista', { ascending: false });

            if (membrosError) {
                console.error('Erro ao buscar membros:', membrosError);
            }

            // Achatar dados de identidade do usuarios no membro
            const membrosFlat = (membrosData || []).map(m => ({
                ...m,
                nome: m.usuarios?.nome || m.nome || 'Sem nome',
                telefone: m.usuarios?.telefone || m.telefone,
                matricula: m.usuarios?.matricula,
                cnh_url: m.usuarios?.cnh_url
            }));
            setMembros(membrosFlat);

            // Buscar membros pendentes de aprovação (apenas para motoristas)
            if (canEdit) {
                const { data: pendentesData } = await supabase
                    .from('membros')
                    .select('*, usuarios(nome, telefone, matricula, cnh_url)')
                    .eq('grupo_id', grupoId)
                    .eq('status_aprovacao', 'pendente')
                    .order('created_at', { ascending: true });

                const pendentesFlat = (pendentesData || []).map(m => ({
                    ...m,
                    nome: m.usuarios?.nome || m.nome || 'Sem nome',
                    telefone: m.usuarios?.telefone || m.telefone,
                    matricula: m.usuarios?.matricula,
                    cnh_url: m.usuarios?.cnh_url
                }));
                setPendentes(pendentesFlat);
            }

            // Buscar viagens da semana
            const hoje = new Date().toISOString().split('T')[0];
            const { data: viagensData } = await supabase
                .from('viagens')
                .select(`
                    *,
                    presencas (
                        id,
                        membro_id,
                        status,
                        horario_atraso
                    )
                `)
                .eq('grupo_id', grupoId)
                .gte('data', hoje)
                .order('data', { ascending: true })
                .order('tipo', { ascending: true });

            setViagens(viagensData || []);
            setSaldoPorMembro({}); // Inicializa vazio para evitar erros de renderização

        } catch (err) {
            console.error('Erro ao carregar dados:', err);
            setError(`Não foi possível carregar os dados: ${err.message || 'Erro desconhecido'}`);
        } finally {
            setLoading(false);
        }
    }, [grupoId, canEdit]);

    useEffect(() => {
        loadData();
    }, [loadData]);

    // Carregar invite link atualizado do bot
    useEffect(() => {
        if (!grupoId || !grupo?.whatsapp_group_id) return;

        const fetchInviteLink = async () => {
            setInviteLinkLoading(true);
            try {
                const response = await fetch(`/api/invite-link/${grupoId}`);
                if (response.ok) {
                    const data = await response.json();
                    setInviteLink(data.inviteLink);
                }
            } catch (err) {
                console.warn('Não foi possível buscar invite link:', err.message);
            } finally {
                setInviteLinkLoading(false);
            }
        };

        fetchInviteLink();
    }, [grupoId, grupo?.whatsapp_group_id]);

    // Salvar configurações (apenas motoristas)
    const salvarConfig = async () => {
        if (!canEdit) return;

        try {
            const { error } = await supabase
                .from('grupos')
                .update({
                    nome: formConfig.nome,
                    horario_ida: formConfig.horario_ida,
                    horario_volta: formConfig.horario_volta,
                    modelo_precificacao: formConfig.modelo_precificacao,
                    valor_semanal: parseFloat(formConfig.valor_semanal) || 0,
                    valor_trajeto: parseFloat(formConfig.valor_trajeto) || 0,
                    tempo_limite_cancelamento: parseInt(formConfig.tempo_limite_cancelamento) || 30
                })
                .eq('id', grupoId);

            if (error) throw error;
            setEditando(false);
            loadData();
        } catch (err) {
            alert('Erro ao salvar: ' + err.message);
        }
    };

    // Aprovar ou rejeitar membro pendente
    const atualizarStatusMembro = async (membroId, novoStatus) => {
        const acao = novoStatus === 'aprovado' ? 'aprovar' : 'rejeitar';
        if (!confirm(`Tem certeza que deseja ${acao} este membro?`)) return;

        try {
            const { error } = await supabase
                .from('membros')
                .update({ status_aprovacao: novoStatus })
                .eq('id', membroId);

            if (error) throw error;
            // Recarregar dados para atualizar listas
            loadData();
        } catch (err) {
            alert('Erro ao atualizar status: ' + err.message);
        }
    };

    // Sair do grupo (passageiros) - TODO: implementar
    const sairDoGrupo = async () => {
        if (confirm('Tem certeza que deseja sair do grupo?')) {
            // Implementar lógica de sair
            alert('Funcionalidade em desenvolvimento');
        }
    };

    // Excluir grupo (motoristas)
    const excluirGrupo = () => {
        if (confirm('Tem certeza que deseja EXCLUIR o grupo? Esta ação é irreversível!')) {
            alert('Funcionalidade em desenvolvimento');
        }
    };

    // Fazer logout
    const handleLogout = () => {
        logout();
        navigate('/');
    };

    // Salvar perfil do usuário
    const handleSaveProfile = async (e) => {
        e.preventDefault();
        setSavingProfile(true);
        try {
            const { error } = await supabase
                .from('usuarios')
                .update({
                    nome: perfilEdit.nome,
                    telefone: perfilEdit.telefone,
                    matricula: perfilEdit.matricula
                })
                .eq('id', user.id);

            if (error) throw error;

            // Recarregar sessão para atualizar dados no contexto
            await refreshSession();



            alert('Perfil atualizado com sucesso!');
        } catch (err) {
            console.error('Erro ao atualizar perfil:', err);
            alert('Erro ao atualizar perfil: ' + err.message);
        } finally {
            setSavingProfile(false);
        }
    };

    // Aprovar ou rejeitar membro
    const handleApproveMember = async (membroId, novoStatus) => {
        try {
            setLoading(true);
            const { error: updateError } = await supabase
                .from('membros')
                .update({ status_aprovacao: novoStatus })
                .eq('id', membroId);

            if (updateError) throw updateError;

            // Recarregar dados
            loadData();
            alert(novoStatus === 'aprovado' ? 'Membro aprovado com sucesso!' : 'Solicitação rejeitada.');
        } catch (err) {
            console.error('Erro ao atualizar status:', err);
            alert('Erro ao atualizar status do membro.');
        } finally {
            setLoading(false);
        }
    };

    // Formatar telefone para display
    const formatPhone = (phone) => {
        if (!phone) return '';
        return phone.replace(/(\d{2})(\d{5})(\d{4})/, '($1) $2-$3');
    };

    // Adicionar membro (apenas motoristas)
    const formatData = (dataStr) => {
        const date = new Date(dataStr + 'T12:00:00');
        const dias = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
        return `${dias[date.getDay()]} ${date.getDate()}/${date.getMonth() + 1}`;
    };

    if (loading) {
        return (
            <div className="container">
                <div style={{ padding: 'var(--space-8)', textAlign: 'center' }}>
                    <div style={{ fontSize: '2rem', marginBottom: 'var(--space-4)' }}>🚗</div>
                    <p style={{ color: 'var(--text-muted)' }}>Carregando...</p>
                </div>
            </div>
        );
    }

    if (error || !grupo) {
        return (
            <div className="container">
                <div className="empty-state">
                    <div className="icon">⚠️</div>
                    <p>{error || 'Grupo não encontrado.'}</p>
                    <button className="btn btn-primary" onClick={loadData}>Tentar novamente</button>
                </div>
            </div>
        );
    }

    const motorista = membros.find(m => m.is_motorista);
    const shareLink = `${window.location.origin}/g/${grupoId}`;

    // Tabs disponíveis baseado no role
    const availableTabs = canEdit
        ? ['inicio', 'viagens', 'membros', 'config', 'perfil', 'grupos']
        : ['inicio', 'viagens', 'membros', 'perfil', 'grupos'];

    return (
        <div className="container">
            {/* Header */}
            <header className="header">
                <div style={{ position: 'relative' }}>
                    <h1 className="header-title"
                        onClick={() => setShowGroupSwitcher(!showGroupSwitcher)}
                        style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}
                    >
                        <span className="icon">🚗</span>
                        {grupo.nome}
                        <span style={{ fontSize: '0.6em', opacity: 0.7 }}>▼</span>
                    </h1>

                    {showGroupSwitcher && (
                        <div style={{
                            position: 'absolute',
                            top: '100%',
                            left: 0,
                            background: 'var(--bg-card)',
                            border: '1px solid var(--border-color)',
                            borderRadius: 'var(--radius-md)',
                            boxShadow: 'var(--shadow-lg)',
                            zIndex: 100,
                            minWidth: '200px',
                            overflow: 'hidden'
                        }}>
                            {user?.grupos?.map(g => (
                                <button
                                    key={g.id}
                                    onClick={() => {
                                        switchGroup(g.id);
                                        setShowGroupSwitcher(false);
                                    }}
                                    style={{
                                        display: 'block',
                                        width: '100%',
                                        textAlign: 'left',
                                        padding: 'var(--space-2) var(--space-3)',
                                        background: g.id === grupoId ? 'var(--bg-primary)' : 'transparent',
                                        border: 'none',
                                        cursor: 'pointer',
                                        color: 'var(--text-primary)'
                                    }}
                                >
                                    {g.nome}
                                </button>
                            ))}
                            <div style={{ borderTop: '1px solid var(--border-color)', margin: 'var(--space-1) 0' }}></div>
                            <button
                                onClick={() => {
                                    navigate('/grupos');
                                    setShowGroupSwitcher(false);
                                }}
                                style={{
                                    display: 'block',
                                    width: '100%',
                                    textAlign: 'left',
                                    padding: 'var(--space-2) var(--space-3)',
                                    background: 'transparent',
                                    border: 'none',
                                    cursor: 'pointer',
                                    color: 'var(--primary)',
                                    fontWeight: 500
                                }}
                            >
                                + Gerenciar Grupos
                            </button>
                        </div>
                    )}
                    <p className="header-subtitle">
                        {membros.length} membro{membros.length !== 1 ? 's' : ''} •
                        {grupo.modelo_precificacao === 'por_trajeto'
                            ? ` R$${parseFloat(grupo.valor_trajeto).toFixed(2)}/trajeto`
                            : ` R$${parseFloat(grupo.valor_semanal).toFixed(2)}/semana`
                        }
                    </p>
                </div>

                {/* User info & logout */}
                {user && (
                    <div style={{ textAlign: 'right' }}>
                        <div style={{ fontSize: 'var(--font-size-sm)', color: 'var(--text-secondary)' }}>
                            {user.nome}
                        </div>
                        <button
                            onClick={handleLogout}
                            style={{
                                background: 'none',
                                border: 'none',
                                color: 'var(--text-muted)',
                                fontSize: 'var(--font-size-xs)',
                                cursor: 'pointer',
                                textDecoration: 'underline'
                            }}
                        >
                            Sair
                        </button>
                    </div>
                )}
                {/* Botão para entrar no grupo (visitantes não logados) */}
                {!user && !isAdmin && (
                    <Link
                        to={`/entrar/${grupoId}`}
                        className="btn btn-primary"
                        style={{ fontSize: 'var(--font-size-sm)', whiteSpace: 'nowrap' }}
                    >
                        📋 Entrar no Grupo
                    </Link>
                )}
            </header>

            {/* Warning banner para verificação pendente (CNH ou matrícula) */}
            {user && (user.cnhStatus === 'pendente' || user.matriculaStatus === 'pendente') && (
                <div style={{
                    background: 'var(--warning-bg, #fff3cd)',
                    color: 'var(--warning, #856404)',
                    padding: 'var(--space-3) var(--space-4)',
                    borderRadius: 'var(--radius-md)',
                    marginBottom: 'var(--space-4)',
                    fontSize: 'var(--font-size-sm)',
                    border: '1px solid var(--warning, #ffc107)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 'var(--space-2)'
                }}>
                    <span style={{ fontSize: '1.2rem' }}>⚠️</span>
                    <div>
                        <strong>Verificação pendente</strong> —{' '}
                        {user.cnhStatus === 'pendente' && user.matriculaStatus === 'pendente'
                            ? 'Sua CNH e matrícula ainda estão sendo verificadas pelo administrador do sistema.'
                            : user.cnhStatus === 'pendente'
                                ? 'Sua CNH ainda está sendo verificada pelo administrador do sistema.'
                                : 'Sua matrícula ainda está sendo verificada pelo administrador do sistema.'
                        }
                        {' '}Você pode usar o painel normalmente enquanto isso.
                    </div>
                </div>
            )}

            {/* Tabs */}
            <div style={{
                display: 'flex',
                gap: 'var(--space-2)',
                marginBottom: 'var(--space-4)',
                borderBottom: '1px solid var(--border-color)',
                paddingBottom: 'var(--space-2)'
            }}>
                {availableTabs.map(tab => (
                    <button
                        key={tab}
                        onClick={() => changeTab(tab)}
                        style={{
                            padding: 'var(--space-2) var(--space-3)',
                            background: activeTab === tab ? 'var(--primary)' : 'transparent',
                            color: activeTab === tab ? 'white' : 'var(--text-secondary)',
                            border: 'none',
                            borderRadius: 'var(--radius-md)',
                            cursor: 'pointer',
                            fontSize: 'var(--font-size-sm)',
                            fontWeight: 500
                        }}
                    >
                        {tab === 'inicio' && '🏠 Início'}
                        {tab === 'viagens' && '📅 Viagens'}
                        {tab === 'membros' && '👥 Membros'}
                        {tab === 'config' && '⚙️ Config'}
                        {tab === 'perfil' && '👤 Meu Perfil'}
                        {tab === 'grupos' && '📋 Meus Grupos'}
                    </button>
                ))}
            </div>

            {/* Tab: Início */}
            {activeTab === 'inicio' && (
                <div>
                    {/* Solicitações Pendentes — apenas motoristas */}
                    {canEdit && pendentes.length > 0 && (
                        <div style={{
                            background: 'var(--warning-bg, #fff3cd)',
                            border: '1px solid var(--warning, #ffc107)',
                            borderRadius: 'var(--radius-md)',
                            padding: 'var(--space-4)',
                            marginBottom: 'var(--space-4)'
                        }}>
                            <h3 style={{ margin: '0 0 var(--space-3) 0', fontSize: 'var(--font-size-lg)' }}>
                                🔔 Solicitações Pendentes ({pendentes.length})
                            </h3>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
                                {pendentes.map(membro => (
                                    <div key={membro.id} style={{
                                        background: 'var(--bg-primary)',
                                        borderRadius: 'var(--radius-md)',
                                        padding: 'var(--space-3)',
                                        border: '1px solid var(--border-color)'
                                    }}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 'var(--space-2)' }}>
                                            <div>
                                                <strong>{membro.nome}</strong>
                                                <span style={{
                                                    marginLeft: 'var(--space-2)',
                                                    padding: '2px 8px',
                                                    borderRadius: 'var(--radius-sm)',
                                                    fontSize: 'var(--font-size-xs)',
                                                    fontWeight: 600,
                                                    background: membro.is_motorista ? 'var(--info-bg, #cce5ff)' : 'var(--success-bg, #d4edda)',
                                                    color: membro.is_motorista ? 'var(--info, #004085)' : 'var(--success, #155724)'
                                                }}>
                                                    {membro.is_motorista ? '🚗 Motorista' : '👤 Passageiro'}
                                                </span>
                                                <p style={{ fontSize: 'var(--font-size-sm)', color: 'var(--text-secondary)', margin: 'var(--space-1) 0 0 0' }}>
                                                    📱 {membro.telefone || 'Telefone não disponível'}
                                                </p>
                                            </div>
                                        </div>

                                        {/* Documentos */}
                                        <div style={{ display: 'flex', gap: 'var(--space-3)', flexWrap: 'wrap', marginBottom: 'var(--space-2)' }}>
                                            {membro.is_motorista && membro.cnh_url && (
                                                <div>
                                                    <p style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)', marginBottom: 'var(--space-1)' }}>🪪 CNH:</p>
                                                    <img
                                                        src={membro.cnh_url}
                                                        alt={`CNH de ${membro.nome}`}
                                                        onClick={() => setImagemExpandida(membro.cnh_url)}
                                                        style={{ maxWidth: '150px', maxHeight: '100px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)', cursor: 'pointer', objectFit: 'contain' }}
                                                    />
                                                </div>
                                            )}
                                            {membro.carteirinha_url && (
                                                <div>
                                                    <p style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)', marginBottom: 'var(--space-1)' }}>🎓 Carteirinha:</p>
                                                    <img
                                                        src={membro.carteirinha_url}
                                                        alt={`Carteirinha de ${membro.nome}`}
                                                        onClick={() => setImagemExpandida(membro.carteirinha_url)}
                                                        style={{ maxWidth: '150px', maxHeight: '100px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)', cursor: 'pointer', objectFit: 'contain' }}
                                                    />
                                                </div>
                                            )}
                                        </div>

                                        {/* Botões de ação */}
                                        <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
                                            <button
                                                className="btn btn-primary"
                                                style={{ flex: 1, fontSize: 'var(--font-size-sm)' }}
                                                onClick={() => atualizarStatusMembro(membro.id, 'aprovado')}
                                            >
                                                ✅ Aprovar
                                            </button>
                                            <button
                                                className="btn"
                                                style={{ flex: 1, background: 'var(--error)', color: 'white', fontSize: 'var(--font-size-sm)' }}
                                                onClick={() => atualizarStatusMembro(membro.id, 'rejeitado')}
                                            >
                                                ❌ Rejeitar
                                            </button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                    {/* Quick Stats */}
                    <div style={{
                        display: 'grid',
                        gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
                        gap: 'var(--space-3)',
                        marginBottom: 'var(--space-4)'
                    }}>
                        <div className="summary-card">
                            <div className="summary-title">👥 Membros</div>
                            <div className="summary-value">{membros.length}</div>
                        </div>
                        <div className="summary-card">
                            <div className="summary-title">📅 Viagens</div>
                            <div className="summary-value">{viagens.length}</div>
                        </div>
                        <div className="summary-card">
                            <div className="summary-title">
                                {grupo.modelo_precificacao === 'por_trajeto' ? '💰 Por Trajeto' : '💰 Semanal'}
                            </div>
                            <div className="summary-value">
                                R$ {grupo.modelo_precificacao === 'por_trajeto'
                                    ? parseFloat(grupo.valor_trajeto).toFixed(2)
                                    : parseFloat(grupo.valor_semanal).toFixed(2)
                                }
                            </div>
                        </div>
                    </div>

                    {/* Actions */}
                    <div className="day-detail" style={{ marginBottom: 'var(--space-4)' }}>
                        <h3 style={{ marginBottom: 'var(--space-3)', fontSize: 'var(--font-size-lg)' }}>
                            🚀 Ações Rápidas
                        </h3>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
                            <button
                                className="btn btn-secondary"
                                onClick={() => {
                                    navigator.clipboard.writeText(shareLink);
                                    alert('Link copiado!');
                                }}
                            >
                                📋 Copiar link do grupo
                            </button>

                            {/* Apenas motoristas veem esses botões */}
                            {canEdit && (
                                <>
                                    <button
                                        className="btn btn-secondary"
                                        onClick={() => changeTab('config')}
                                    >
                                        ⚙️ Configurar grupo
                                    </button>
                                    <button
                                        className="btn btn-secondary"
                                        onClick={() => changeTab('membros')}
                                    >
                                        👥 Gerenciar membros
                                    </button>
                                </>
                            )}

                            {/* Passageiros veem apenas ver membros */}
                            {!canEdit && (
                                <button
                                    className="btn btn-secondary"
                                    onClick={() => changeTab('membros')}
                                >
                                    👥 Ver membros
                                </button>
                            )}
                        </div>
                    </div>

                    {/* WhatsApp Invite Link */}
                    {grupo.whatsapp_group_id && (
                        <div className="day-detail" style={{ marginBottom: 'var(--space-4)' }}>
                            <h3 style={{ marginBottom: 'var(--space-3)', fontSize: 'var(--font-size-lg)' }}>
                                📱 Grupo WhatsApp
                            </h3>
                            {inviteLinkLoading ? (
                                <p style={{ color: 'var(--text-muted)', fontSize: 'var(--font-size-sm)' }}>Carregando link...</p>
                            ) : inviteLink ? (
                                <div>
                                    <p style={{ color: 'var(--text-secondary)', fontSize: 'var(--font-size-sm)', marginBottom: 'var(--space-2)' }}>
                                        Compartilhe o link abaixo para novos membros entrarem no grupo:
                                    </p>
                                    <div style={{
                                        background: 'var(--bg-secondary)',
                                        padding: 'var(--space-2) var(--space-3)',
                                        borderRadius: 'var(--radius-sm)',
                                        wordBreak: 'break-all',
                                        fontSize: 'var(--font-size-xs)',
                                        marginBottom: 'var(--space-2)',
                                        color: 'var(--text-secondary)'
                                    }}>
                                        {inviteLink}
                                    </div>
                                    <button
                                        className="btn btn-primary"
                                        style={{ width: '100%' }}
                                        onClick={() => {
                                            navigator.clipboard.writeText(inviteLink);
                                            alert('Link de convite copiado!');
                                        }}
                                    >
                                        📋 Copiar Link de Convite WhatsApp
                                    </button>
                                </div>
                            ) : (
                                <p style={{ color: 'var(--text-muted)', fontSize: 'var(--font-size-sm)' }}>
                                    Link de convite não disponível no momento.
                                </p>
                            )}
                        </div>
                    )}

                    {/* Bot Info - apenas para motoristas */}
                    {canEdit && (
                        <div className="day-detail">
                            <h3 style={{ marginBottom: 'var(--space-3)', fontSize: 'var(--font-size-lg)' }}>
                                🤖 Configurar Bot WhatsApp
                            </h3>
                            <p style={{ color: 'var(--text-secondary)', marginBottom: 'var(--space-3)', fontSize: 'var(--font-size-sm)' }}>
                                Para usar o bot de confirmação via WhatsApp, configure a API:
                            </p>
                            <div style={{
                                background: 'var(--bg-secondary)',
                                padding: 'var(--space-3)',
                                borderRadius: 'var(--radius-md)',
                                fontSize: 'var(--font-size-sm)',
                                marginBottom: 'var(--space-3)'
                            }}>
                                <strong>Webhook URL:</strong><br />
                                <code style={{ wordBreak: 'break-all' }}>
                                    {window.location.origin}/api/webhook
                                </code>
                            </div>
                            <div style={{
                                background: 'var(--bg-secondary)',
                                padding: 'var(--space-3)',
                                borderRadius: 'var(--radius-md)',
                                fontSize: 'var(--font-size-sm)'
                            }}>
                                <strong>Group ID (WhatsApp):</strong><br />
                                <code>{grupo.whatsapp_group_id || 'Não configurado'}</code>
                            </div>
                        </div>
                    )}
                </div>
            )}

            {/* Tab: Perfil */}
            {activeTab === 'perfil' && (
                <div>
                    <h3 style={{ marginBottom: 'var(--space-3)' }}>👤 Meu Perfil</h3>
                    <div className="card">
                        <form onSubmit={handleSaveProfile}>
                            <div className="form-group">
                                <label className="form-label">Nome Completo</label>
                                <input
                                    type="text"
                                    className="form-input"
                                    value={perfilEdit.nome}
                                    readOnly
                                    style={{ backgroundColor: 'var(--bg-secondary)', cursor: 'not-allowed', color: 'var(--text-muted)' }}
                                />
                                <small style={{ color: 'var(--text-muted)' }}>
                                    O nome não pode ser alterado pelo painel.
                                </small>
                            </div>

                            <div className="form-group">
                                <label className="form-label">Telefone (WhatsApp)</label>
                                <input
                                    type="tel"
                                    className="form-input"
                                    value={perfilEdit.telefone}
                                    onChange={e => setPerfilEdit({ ...perfilEdit, telefone: e.target.value })}
                                    required
                                />
                                <small style={{ color: 'var(--text-muted)' }}>
                                    Usado para contato e identificação no grupo do WhatsApp.
                                </small>
                            </div>

                            <div className="form-group">
                                <label className="form-label">Matrícula</label>
                                <input
                                    type="text"
                                    className="form-input"
                                    value={perfilEdit.matricula}
                                    onChange={e => setPerfilEdit({ ...perfilEdit, matricula: e.target.value })}
                                    readOnly={!!user?.matricula}
                                    style={user?.matricula ? { backgroundColor: 'var(--bg-secondary)', cursor: 'not-allowed', color: 'var(--text-muted)' } : {}}
                                />
                                {user?.matricula && (
                                    <small style={{ color: 'var(--text-muted)' }}>
                                        A matrícula só pode ser alterada se estiver vazia.
                                    </small>
                                )}
                            </div>

                            <button
                                type="submit"
                                className="btn btn-primary"
                                disabled={savingProfile}
                            >
                                {savingProfile ? 'Salvando...' : '💾 Salvar Alterações'}
                            </button>
                        </form>
                    </div>
                </div>
            )}

            {/* Tab: Viagens */}
            {activeTab === 'viagens' && (
                <div>
                    <h3 style={{ marginBottom: 'var(--space-3)' }}>📅 Próximas Viagens</h3>
                    {viagens.length === 0 ? (
                        <div className="empty-state">
                            <div className="icon">📭</div>
                            <p>Nenhuma viagem agendada</p>
                        </div>
                    ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
                            {viagens.map(viagem => {
                                const confirmados = viagem.presencas?.filter(p => p.status === 'confirmado').length || 0;
                                return (
                                    <div key={viagem.id} className="day-detail">
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                            <div>
                                                <strong>{formatData(viagem.data)}</strong>
                                                <span style={{
                                                    marginLeft: 'var(--space-2)',
                                                    padding: 'var(--space-1) var(--space-2)',
                                                    background: viagem.tipo === 'ida' ? 'var(--success-bg)' : 'var(--info-bg)',
                                                    borderRadius: 'var(--radius-sm)',
                                                    fontSize: 'var(--font-size-xs)'
                                                }}>
                                                    {viagem.tipo === 'ida' ? '→ Ida' : '← Volta'}
                                                </span>
                                            </div>
                                            <div style={{ color: 'var(--text-muted)', fontSize: 'var(--font-size-sm)' }}>
                                                🕐 {viagem.horario_partida?.slice(0, 5)}
                                            </div>
                                        </div>
                                        <div style={{ marginTop: 'var(--space-2)', color: 'var(--text-secondary)', fontSize: 'var(--font-size-sm)' }}>
                                            ✅ {confirmados} confirmado{confirmados !== 1 ? 's' : ''}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>
            )}

            {/* Tab: Membros */}
            {activeTab === 'membros' && (
                <div>
                    <h3 style={{ marginBottom: 'var(--space-3)' }}>👥 Membros do Grupo</h3>

                    {/* Seção de Aprovação (Apenas para quem pode editar/motorista) */}
                    {canEdit && (
                        <div className="card" style={{ marginBottom: '1rem', borderLeft: '4px solid var(--warning)' }}>
                            <h3 style={{ marginTop: 0, display: 'flex', alignItems: 'center', gap: '8px', fontSize: '1rem' }}>
                                ⚠️ Solicitações Pendentes
                            </h3>
                            {pendentes.length === 0 ? (
                                <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>Nenhuma solicitação pendente.</p>
                            ) : (
                                <div style={{ display: 'grid', gap: '1rem' }}>
                                    {pendentes.map(membro => (
                                        <div key={membro.id} style={{
                                            display: 'flex',
                                            justifyContent: 'space-between',
                                            alignItems: 'center',
                                            padding: '10px',
                                            background: 'var(--bg-app)',
                                            borderRadius: 'var(--radius-sm)'
                                        }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                                {membro.carteirinha_url ? (
                                                    <a href={membro.carteirinha_url} target="_blank" rel="noopener noreferrer">
                                                        <img
                                                            src={membro.carteirinha_url}
                                                            alt="Carteirinha"
                                                            style={{ width: '50px', height: '50px', objectFit: 'cover', borderRadius: '4px', border: '1px solid var(--border-color)' }}
                                                        />
                                                    </a>
                                                ) : (
                                                    <div style={{ width: '50px', height: '50px', background: '#ccc', borderRadius: '4px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                                        📷
                                                    </div>
                                                )}
                                                <div>
                                                    <strong>{membro.nome}</strong>
                                                    <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>{formatPhone(membro.telefone)}</div>
                                                </div>
                                            </div>
                                            <div style={{ display: 'flex', gap: '8px' }}>
                                                <button
                                                    onClick={() => handleApproveMember(membro.id, 'aprovado')}
                                                    className="btn btn-primary"
                                                    style={{ padding: '4px 8px', fontSize: '0.9rem' }}
                                                    title="Aprovar"
                                                >
                                                    ✅
                                                </button>
                                                <button
                                                    onClick={() => handleApproveMember(membro.id, 'rejeitado')}
                                                    className="btn btn-secondary"
                                                    style={{ padding: '4px 8px', fontSize: '0.9rem', color: 'var(--error)' }}
                                                    title="Rejeitar"
                                                >
                                                    ❌
                                                </button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    )}

                    {membros.length === 0 ? (
                        <div className="empty-state">
                            <div className="icon">👥</div>
                            <p>Nenhum membro aprovado neste grupo ainda.</p>
                        </div>
                    ) : (
                        <div className="member-list">
                            {membros.map(membro => {
                                const membroSaldo = saldoPorMembro[membro.id] || 0;
                                const iniciais = membro.nome?.split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase() || '??';
                                return (
                                    <div key={membro.id} className="member-item">
                                        <div className={`member-avatar ${membro.is_motorista ? 'driver' : 'confirmed'}`}
                                            style={!membro.is_motorista ? { background: 'var(--accent-primary)', color: 'white', opacity: 0.8 } : { background: 'var(--accent-secondary)', color: 'white' }}
                                        >
                                            {iniciais}
                                        </div>
                                        <div className="member-info">
                                            <div className="member-name">{membro.nome}</div>
                                            <div className="member-status">
                                                {canEdit ? (
                                                    /* Motorista vê telefone + saldo */
                                                    <>
                                                        📱 {membro.telefone || 'Sem telefone'}
                                                        {!membro.is_motorista && membroSaldo > 0 && (
                                                            <span style={{ marginLeft: 'var(--space-2)', color: 'var(--error, #dc3545)', fontWeight: 600, fontSize: 'var(--font-size-xs)' }}>
                                                                • Deve R$ {membroSaldo.toFixed(2)}
                                                            </span>
                                                        )}
                                                    </>
                                                ) : (
                                                    /* Passageiro vê só telefone */
                                                    <>📱 {membro.telefone || 'Sem telefone'}</>
                                                )}
                                            </div>
                                        </div>
                                        {membro.is_motorista && (
                                            <span className="member-badge driver">Motorista</span>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>
            )}

            {/* Tab: Configurações - apenas para motoristas */}
            {activeTab === 'config' && canEdit && (
                <div>
                    <h3 style={{ marginBottom: 'var(--space-3)' }}>⚙️ Configurações do Grupo</h3>

                    <div className="day-detail">
                        {editando ? (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
                                <div className="form-group">
                                    <label className="form-label">Nome do Grupo</label>
                                    <input
                                        type="text"
                                        className="form-input"
                                        value={formConfig.nome}
                                        onChange={e => setFormConfig({ ...formConfig, nome: e.target.value })}
                                    />
                                </div>

                                <div style={{ display: 'flex', gap: 'var(--space-3)' }}>
                                    <div className="form-group" style={{ flex: 1 }}>
                                        <label className="form-label">Horário Ida</label>
                                        <input
                                            type="time"
                                            className="form-input"
                                            value={formConfig.horario_ida}
                                            onChange={e => setFormConfig({ ...formConfig, horario_ida: e.target.value })}
                                        />
                                    </div>
                                    <div className="form-group" style={{ flex: 1 }}>
                                        <label className="form-label">Horário Volta</label>
                                        <input
                                            type="time"
                                            className="form-input"
                                            value={formConfig.horario_volta}
                                            onChange={e => setFormConfig({ ...formConfig, horario_volta: e.target.value })}
                                        />
                                    </div>
                                </div>

                                <div className="form-group">
                                    <label className="form-label">Modelo de Cobrança</label>
                                    <select
                                        className="form-input"
                                        value={formConfig.modelo_precificacao}
                                        onChange={e => setFormConfig({ ...formConfig, modelo_precificacao: e.target.value })}
                                    >
                                        <option value="semanal">Semanal</option>
                                        <option value="por_trajeto">Por Trajeto</option>
                                    </select>
                                </div>

                                {formConfig.modelo_precificacao === 'por_trajeto' ? (
                                    <>
                                        <div className="form-group">
                                            <label className="form-label">Valor por Trajeto (R$)</label>
                                            <input
                                                type="number"
                                                className="form-input"
                                                step="0.01"
                                                value={formConfig.valor_trajeto}
                                                onChange={e => setFormConfig({ ...formConfig, valor_trajeto: e.target.value })}
                                            />
                                        </div>
                                        <div className="form-group">
                                            <label className="form-label">Limite para cancelar (minutos)</label>
                                            <input
                                                type="number"
                                                className="form-input"
                                                value={formConfig.tempo_limite_cancelamento}
                                                onChange={e => setFormConfig({ ...formConfig, tempo_limite_cancelamento: e.target.value })}
                                            />
                                        </div>
                                    </>
                                ) : (
                                    <div className="form-group">
                                        <label className="form-label">Valor Semanal (R$)</label>
                                        <input
                                            type="number"
                                            className="form-input"
                                            step="0.01"
                                            value={formConfig.valor_semanal}
                                            onChange={e => setFormConfig({ ...formConfig, valor_semanal: e.target.value })}
                                        />
                                    </div>
                                )}

                                <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
                                    <button className="btn btn-primary" onClick={salvarConfig}>
                                        💾 Salvar
                                    </button>
                                    <button className="btn btn-secondary" onClick={() => setEditando(false)}>
                                        Cancelar
                                    </button>
                                </div>
                            </div>
                        ) : (
                            <div>
                                <div style={{ display: 'grid', gap: 'var(--space-3)' }}>
                                    <div>
                                        <strong>Nome:</strong> {grupo.nome}
                                    </div>
                                    <div>
                                        <strong>Horários:</strong> Ida {grupo.horario_ida?.slice(0, 5)} • Volta {grupo.horario_volta?.slice(0, 5)}
                                    </div>
                                    <div>
                                        <strong>Modelo:</strong> {grupo.modelo_precificacao === 'por_trajeto' ? 'Por Trajeto' : 'Semanal'}
                                    </div>
                                    <div>
                                        <strong>Valor:</strong> R$ {
                                            grupo.modelo_precificacao === 'por_trajeto'
                                                ? parseFloat(grupo.valor_trajeto).toFixed(2) + '/trajeto'
                                                : parseFloat(grupo.valor_semanal).toFixed(2) + '/semana'
                                        }
                                    </div>
                                    {grupo.modelo_precificacao === 'por_trajeto' && (
                                        <div>
                                            <strong>Limite cancelamento:</strong> {grupo.tempo_limite_cancelamento} min antes
                                        </div>
                                    )}
                                </div>
                                <button
                                    className="btn btn-secondary"
                                    style={{ marginTop: 'var(--space-4)' }}
                                    onClick={() => setEditando(true)}
                                >
                                    ✏️ Editar configurações
                                </button>
                            </div>
                        )}
                    </div>

                    {/* Danger Zone - diferente para motorista vs passageiro */}
                    <div className="day-detail" style={{ marginTop: 'var(--space-4)', borderColor: 'var(--error)' }}>
                        <h4 style={{ color: 'var(--error)', marginBottom: 'var(--space-2)' }}>⚠️ Zona de Perigo</h4>
                        <p style={{ fontSize: 'var(--font-size-sm)', color: 'var(--text-muted)', marginBottom: 'var(--space-3)' }}>
                            Ações irreversíveis. Tenha cuidado.
                        </p>
                        <button
                            className="btn"
                            style={{
                                background: 'var(--error)',
                                color: 'white',
                                opacity: 0.8
                            }}
                            onClick={excluirGrupo}
                        >
                            🗑️ Excluir Grupo
                        </button>
                    </div>
                </div>
            )}

            {/* Para passageiros que de alguma forma acessam a config tab */}
            {activeTab === 'config' && !canEdit && (
                <div className="empty-state">
                    <div className="icon">🔒</div>
                    <p>Apenas motoristas podem acessar as configurações.</p>
                    <button className="btn btn-primary" onClick={() => changeTab('inicio')}>
                        Voltar ao início
                    </button>
                </div>
            )}
            {/* Tab: Grupos Disponíveis */}
            {activeTab === 'grupos' && (
                <div>
                    <h3 style={{ marginBottom: 'var(--space-3)' }}>🔍 Grupos Disponíveis</h3>
                    <p style={{ marginBottom: 'var(--space-4)', color: 'var(--text-secondary)' }}>
                        Você pode participar de vários grupos como passageiro, mas apenas um como motorista.
                    </p>
                    <AvailableGroups />
                </div>
            )}

            {/* Modal de imagem expandida */}
            {imagemExpandida && (
                <div
                    onClick={() => setImagemExpandida(null)}
                    style={{
                        position: 'fixed',
                        top: 0,
                        left: 0,
                        right: 0,
                        bottom: 0,
                        background: 'rgba(0, 0, 0, 0.9)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        zIndex: 1000,
                        cursor: 'pointer',
                        padding: 'var(--space-4)'
                    }}
                >
                    <img
                        src={imagemExpandida}
                        alt="Documento ampliado"
                        style={{
                            maxWidth: '100%',
                            maxHeight: '100%',
                            objectFit: 'contain',
                            borderRadius: 'var(--radius-md)'
                        }}
                    />
                    <div style={{
                        position: 'absolute',
                        top: 'var(--space-4)',
                        right: 'var(--space-4)',
                        color: 'white',
                        fontSize: '2rem',
                        cursor: 'pointer'
                    }}>
                        ✕
                    </div>
                </div>
            )}
        </div>
    );
}