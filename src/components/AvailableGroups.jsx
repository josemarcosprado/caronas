import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase.js';
import { useAuth } from '../contexts/AuthContext.jsx';
import { useNavigate } from 'react-router-dom';

export default function AvailableGroups() {
    const [groups, setGroups] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const { user, switchGroup, refreshSession } = useAuth();
    const navigate = useNavigate();

    // Estado do modal de criação
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [createStep, setCreateStep] = useState('role'); // 'role' | 'form'
    const [selectedRole, setSelectedRole] = useState(null); // 'motorista' | 'passageiro'
    const [creating, setCreating] = useState(false);
    const [createError, setCreateError] = useState('');
    const [createSuccess, setCreateSuccess] = useState(null);
    const [cnhFile, setCnhFile] = useState(null);
    const [cnhPreview, setCnhPreview] = useState(null);
    const [formData, setFormData] = useState({
        nome: '',
        horarioIda: '07:00',
        horarioVolta: '18:00',
        modeloPrecificacao: 'semanal',
        valorSemanal: '',
        valorTrajeto: '',
        tempoLimiteCancelamento: '30'
    });

    useEffect(() => {
        loadGroups();
    }, []);

    const loadGroups = async () => {
        try {
            setLoading(true);
            setError(null);

            const { data: gruposData, error: fetchError } = await supabase
                .from('grupos')
                .select('*');

            if (fetchError) throw fetchError;

            // Fetch members with their neighborhoods
            const { data: membrosData } = await supabase
                .from('membros')
                .select('grupo_id, usuarios(bairro)')
                .eq('ativo', true)
                .eq('status_aprovacao', 'aprovado');

            const contagem = {};
            const bairrosPorGrupo = {};

            (membrosData || []).forEach(m => {
                // Count members
                contagem[m.grupo_id] = (contagem[m.grupo_id] || 0) + 1;

                // Collect neighborhoods
                if (m.usuarios?.bairro) {
                    if (!bairrosPorGrupo[m.grupo_id]) {
                        bairrosPorGrupo[m.grupo_id] = new Set();
                    }
                    // Normalize to title case for cleaner display? For now just trim/lower to dedupe
                    const bairroNormalizado = m.usuarios.bairro.trim();
                    if (bairroNormalizado) {
                        bairrosPorGrupo[m.grupo_id].add(bairroNormalizado);
                    }
                }
            });

            const gruposComInfo = (gruposData || []).map(g => {
                const bairrosSet = bairrosPorGrupo[g.id] || new Set();
                const bairrosList = Array.from(bairrosSet).sort().join(', ');

                return {
                    ...g,
                    membrosCount: contagem[g.id] || 0,
                    bairros: bairrosList
                };
            });

            setGroups(gruposComInfo);
        } catch (err) {
            console.error('Erro ao carregar grupos:', err);
            setError('Não foi possível carregar os grupos disponíveis.');
        } finally {
            setLoading(false);
        }
    };

    const handleJoin = (groupId) => {
        navigate(`/entrar/${groupId}`);
    };

    const handleSwitch = async (groupId) => {
        const success = await switchGroup(groupId);
        if (success) {
            window.location.href = `/g/${groupId}`;
        } else {
            alert('Erro ao trocar de grupo.');
        }
    };

    // --- Search & Sort State ---
    const [searchTerm, setSearchTerm] = useState('');
    const [sortBy, setSortBy] = useState('relevance'); // 'relevance' | 'price_asc' | 'time_asc'

    const isMember = (groupId) => {
        return user?.memberships?.some(m => m.grupo_id === groupId);
    };

    const getMembershipStatus = (groupId) => {
        const member = user?.memberships?.find(m => m.grupo_id === groupId);
        return member ? member.status_aprovacao : null;
    };

    // --- Filter & Sort Logic ---
    const filteredGroups = groups.filter(group => {
        if (!searchTerm) return true;
        const term = searchTerm.toLowerCase();
        const nomeMatch = group.nome?.toLowerCase().includes(term);
        const bairroMatch = group.bairros?.toLowerCase().includes(term);
        return nomeMatch || bairroMatch;
    }).sort((a, b) => {
        // Always prioritize "My Groups" regardless of sort? 
        // Or respect the sort strictly? 
        // Let's keep "My Groups" at top ONLY for relevance, otherwise follow the sort.

        if (sortBy === 'relevance') {
            const aMember = isMember(a.id) ? 0 : 1;
            const bMember = isMember(b.id) ? 0 : 1;
            if (aMember !== bMember) return aMember - bMember;
            // Secondary sort by name
            return (a.nome || '').localeCompare(b.nome || '');
        }

        if (sortBy === 'price_asc') {
            // Normalize price for comparison
            const getPrice = (g) => {
                if (g.modelo_precificacao === 'por_trajeto') return (parseFloat(g.valor_trajeto) || 0) * 10; // Approx weekly cost? or just compare unit price? 
                // Let's compare raw values but treat them separately? 
                // Actually, let's just compare the numeric value fields directly.
                // A better approach might be to sort cheapest to most expensive regardless of model?
                // For simplicity, let's use the visible value.
                return g.modelo_precificacao === 'por_trajeto'
                    ? parseFloat(g.valor_trajeto)
                    : parseFloat(g.valor_semanal);
            };
            return getPrice(a) - getPrice(b);
        }

        if (sortBy === 'time_asc') {
            return (a.horario_ida || '').localeCompare(b.horario_ida || '');
        }

        return 0;
    });
    // --- Funções do modal de criação ---

    const openCreateModal = () => {
        setShowCreateModal(true);
        setCreateStep('role');
        setSelectedRole(null);
        setCreateError('');
        setCreateSuccess(null);
        setCnhFile(null);
        setCnhPreview(null);
        setFormData({
            nome: '',
            horarioIda: '07:00',
            horarioVolta: '18:00',
            modeloPrecificacao: 'semanal',
            valorSemanal: '',
            valorTrajeto: '',
            tempoLimiteCancelamento: '30'
        });
    };

    const closeCreateModal = () => {
        setShowCreateModal(false);
        setCreateStep('role');
        setSelectedRole(null);
        setCreateError('');
    };

    const handleSelectRole = (role) => {
        setSelectedRole(role);
        setCreateStep('form');
        setCreateError('');
    };

    const handleFormChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const handleCnhChange = (e) => {
        const file = e.target.files[0];
        if (file) {
            if (file.size > 5 * 1024 * 1024) {
                setCreateError('A imagem da CNH deve ter no máximo 5MB.');
                return;
            }
            if (!file.type.startsWith('image/')) {
                setCreateError('O arquivo deve ser uma imagem (JPG, PNG, etc).');
                return;
            }
            setCnhFile(file);
            setCnhPreview(URL.createObjectURL(file));
            setCreateError('');
        }
    };

    const temCnh = user?.cnhUrl || user?.cnhStatus !== 'nao_enviada';

    const criarViagensSemana = async (grupoId, horarioIda, horarioVolta) => {
        const hoje = new Date();
        const diaSemana = hoje.getDay();
        const viagens = [];

        for (let dow = 1; dow <= 5; dow++) {
            let diff = dow - diaSemana;
            if (diff < 0) diff += 7;

            const data = new Date(hoje);
            data.setDate(hoje.getDate() + diff);
            const dataStr = data.toISOString().split('T')[0];

            viagens.push({
                grupo_id: grupoId,
                data: dataStr,
                tipo: 'ida',
                horario_partida: horarioIda,
                status: 'agendada'
            });

            viagens.push({
                grupo_id: grupoId,
                data: dataStr,
                tipo: 'volta',
                horario_partida: horarioVolta,
                status: 'agendada'
            });
        }

        const { error } = await supabase.from('viagens').insert(viagens);
        if (error) console.error('Erro ao criar viagens:', error);
    };

    const handleCreateSubmit = async (e) => {
        e.preventDefault();
        setCreating(true);
        setCreateError('');

        // Validação: motorista sem CNH
        if (selectedRole === 'motorista' && !temCnh && !cnhFile) {
            setCreateError('É obrigatório enviar uma foto da CNH para criar um grupo como motorista.');
            setCreating(false);
            return;
        }

        try {
            // Upload da CNH se motorista e forneceu arquivo
            let cnhUrl = user?.cnhUrl || null;
            if (selectedRole === 'motorista' && cnhFile) {
                const cnhFileName = `user_${user.telefone}_${Date.now()}.${cnhFile.name.split('.').pop()}`;
                const { error: uploadError } = await supabase.storage
                    .from('cnh-uploads')
                    .upload(cnhFileName, cnhFile, {
                        cacheControl: '3600',
                        upsert: false
                    });

                if (uploadError) throw new Error('Erro ao enviar foto da CNH: ' + uploadError.message);

                const { data: urlData } = supabase.storage
                    .from('cnh-uploads')
                    .getPublicUrl(cnhFileName);
                cnhUrl = urlData.publicUrl;

                await supabase
                    .from('usuarios')
                    .update({ cnh_url: cnhUrl, cnh_status: 'pendente' })
                    .eq('id', user.id);
            }

            // 1. Criar o grupo
            const { data: grupo, error: grupoError } = await supabase
                .from('grupos')
                .insert({
                    nome: formData.nome,
                    motorista_id: selectedRole === 'motorista' ? user.id : null,
                    horario_ida: formData.horarioIda,
                    horario_volta: formData.horarioVolta,
                    modelo_precificacao: formData.modeloPrecificacao,
                    valor_semanal: formData.modeloPrecificacao === 'semanal'
                        ? parseFloat(formData.valorSemanal) || 0
                        : 0,
                    valor_trajeto: formData.modeloPrecificacao === 'por_trajeto'
                        ? parseFloat(formData.valorTrajeto) || 0
                        : 0,
                    tempo_limite_cancelamento: parseInt(formData.tempoLimiteCancelamento) || 30
                })
                .select()
                .single();

            if (grupoError) throw grupoError;

            // 2. Criar membro (associação grupo ↔ usuário)
            const { error: membroError } = await supabase
                .from('membros')
                .insert({
                    grupo_id: grupo.id,
                    usuario_id: user.id,
                    is_motorista: selectedRole === 'motorista',
                    ativo: true,
                    dias_padrao: ['seg', 'ter', 'qua', 'qui', 'sex'],
                    status_aprovacao: 'aprovado'
                });

            if (membroError) {
                if (membroError.message.includes('idx_single_driver_per_user')) {
                    throw new Error('Você já é motorista em outro grupo. Cada usuário só pode ser motorista de um grupo.');
                }
                throw membroError;
            }

            // 3. Criar viagens da semana
            await criarViagensSemana(grupo.id, formData.horarioIda, formData.horarioVolta);

            // 4. Atualizar sessão
            await refreshSession();

            // 5. Redirecionar para o dashboard do grupo criado
            const dashPath = selectedRole === 'motorista'
                ? `/admin/${grupo.id}`
                : `/g/${grupo.id}`;
            navigate(dashPath);
        } catch (err) {
            console.error('Erro ao criar grupo:', err);
            setCreateError(err.message || 'Erro ao criar grupo. Verifique os dados.');
        } finally {
            setCreating(false);
        }
    };

    const isPorTrajeto = formData.modeloPrecificacao === 'por_trajeto';

    if (loading) return <div style={{ padding: '20px', textAlign: 'center' }}>Carregando grupos...</div>;

    return (
        <div>
            {/* Botão Criar Grupo */}
            <div style={{ marginBottom: '1rem' }}>
                <button
                    className="btn btn-primary"
                    style={{ width: '100%', padding: '12px', fontSize: '1rem', fontWeight: 600 }}
                    onClick={openCreateModal}
                >
                    ➕ Criar Novo Grupo
                </button>
            </div>

            {/* Search & Sort Controls */}
            <div style={{
                marginBottom: '1rem',
                display: 'flex',
                gap: '0.5rem',
                flexWrap: 'wrap'
            }}>
                <input
                    type="text"
                    placeholder="🔍 Buscar por nome ou bairro..."
                    className="form-input"
                    style={{ flex: 1, minWidth: '200px' }}
                    value={searchTerm}
                    onChange={e => setSearchTerm(e.target.value)}
                />

                <select
                    className="form-input"
                    style={{ width: 'auto' }}
                    value={sortBy}
                    onChange={e => setSortBy(e.target.value)}
                >
                    <option value="relevance">Meus Grupos</option>
                    <option value="price_asc">💲 Preço (Menor)</option>
                    <option value="time_asc">🕐 Horário (Cedo)</option>
                </select>
            </div>

            {/* Lista de Grupos */}
            <div style={{ display: 'grid', gap: '1rem', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))' }}>
                {filteredGroups.map(group => {
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
                                    👥 {group.membrosCount} membro{group.membrosCount !== 1 ? 's' : ''}
                                </div>
                                <div>
                                    🕐 {group.horario_ida?.slice(0, 5)} - {group.horario_volta?.slice(0, 5)}
                                </div>
                                {group.bairros && (
                                    <div style={{ marginTop: '4px', color: 'var(--text-primary)', fontSize: '0.85rem' }}>
                                        📍 <strong>Bairros:</strong> {group.bairros}
                                    </div>
                                )}
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

            {/* Modal de Criação de Grupo */}
            {showCreateModal && (
                <div
                    style={{
                        position: 'fixed',
                        top: 0,
                        left: 0,
                        right: 0,
                        bottom: 0,
                        background: 'rgba(0, 0, 0, 0.6)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        zIndex: 1000,
                        padding: '1rem',
                        backdropFilter: 'blur(4px)'
                    }}
                    onClick={(e) => { if (e.target === e.currentTarget) closeCreateModal(); }}
                >
                    <div style={{
                        background: 'var(--bg-primary, #fff)',
                        borderRadius: 'var(--radius-lg, 12px)',
                        padding: '1.5rem',
                        width: '100%',
                        maxWidth: '480px',
                        maxHeight: '85vh',
                        overflowY: 'auto',
                        boxShadow: '0 20px 60px rgba(0,0,0,0.3)',
                        position: 'relative'
                    }}>
                        {/* Botão fechar */}
                        <button
                            onClick={closeCreateModal}
                            style={{
                                position: 'absolute',
                                top: '12px',
                                right: '12px',
                                background: 'none',
                                border: 'none',
                                fontSize: '1.4rem',
                                cursor: 'pointer',
                                color: 'var(--text-muted)',
                                padding: '4px'
                            }}
                        >
                            ✕
                        </button>

                        {/* Tela de Sucesso */}
                        {createSuccess && (
                            <div style={{ textAlign: 'center', padding: '1rem 0' }}>
                                <div style={{ fontSize: '3.5rem', marginBottom: '1rem' }}>✅</div>
                                <h2 style={{ fontSize: '1.3rem', marginBottom: '0.5rem' }}>Grupo Criado!</h2>
                                <p style={{ color: 'var(--text-secondary)', marginBottom: '1.5rem' }}>
                                    <strong>{createSuccess}</strong> foi criado com sucesso.
                                </p>
                                <button
                                    className="btn btn-primary"
                                    style={{ width: '100%' }}
                                    onClick={closeCreateModal}
                                >
                                    Fechar
                                </button>
                            </div>
                        )}

                        {/* Passo 1: Seleção de Papel */}
                        {!createSuccess && createStep === 'role' && (
                            <div>
                                <h2 style={{ fontSize: '1.3rem', marginBottom: '0.5rem', textAlign: 'center' }}>
                                    ➕ Criar Novo Grupo
                                </h2>
                                <p style={{ color: 'var(--text-secondary)', textAlign: 'center', marginBottom: '1.5rem', fontSize: '0.9rem' }}>
                                    Como você deseja participar deste grupo?
                                </p>

                                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                                    {/* Card Motorista */}
                                    <button
                                        onClick={() => handleSelectRole('motorista')}
                                        style={{
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: '1rem',
                                            padding: '1.25rem',
                                            border: '2px solid var(--border-color)',
                                            borderRadius: 'var(--radius-md, 8px)',
                                            background: 'var(--bg-secondary, #f8f9fa)',
                                            cursor: 'pointer',
                                            textAlign: 'left',
                                            transition: 'all 0.2s ease',
                                            width: '100%'
                                        }}
                                        onMouseEnter={e => {
                                            e.currentTarget.style.borderColor = 'var(--primary, #4f46e5)';
                                            e.currentTarget.style.background = 'var(--bg-card, #eef2ff)';
                                        }}
                                        onMouseLeave={e => {
                                            e.currentTarget.style.borderColor = 'var(--border-color)';
                                            e.currentTarget.style.background = 'var(--bg-secondary, #f8f9fa)';
                                        }}
                                    >
                                        <div style={{
                                            fontSize: '2.2rem',
                                            width: '50px',
                                            height: '50px',
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            background: 'rgba(79, 70, 229, 0.1)',
                                            borderRadius: 'var(--radius-md, 8px)',
                                            flexShrink: 0
                                        }}>🚗</div>
                                        <div>
                                            <div style={{ fontWeight: 700, fontSize: '1.05rem', marginBottom: '4px', color: 'var(--text-primary)' }}>
                                                Motorista
                                            </div>
                                            <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                                                Você será o motorista e administrador do grupo. Requer CNH.
                                            </div>
                                        </div>
                                    </button>

                                    {/* Card Passageiro */}
                                    <button
                                        onClick={() => handleSelectRole('passageiro')}
                                        style={{
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: '1rem',
                                            padding: '1.25rem',
                                            border: '2px solid var(--border-color)',
                                            borderRadius: 'var(--radius-md, 8px)',
                                            background: 'var(--bg-secondary, #f8f9fa)',
                                            cursor: 'pointer',
                                            textAlign: 'left',
                                            transition: 'all 0.2s ease',
                                            width: '100%'
                                        }}
                                        onMouseEnter={e => {
                                            e.currentTarget.style.borderColor = 'var(--success, #10b981)';
                                            e.currentTarget.style.background = 'var(--bg-card, #ecfdf5)';
                                        }}
                                        onMouseLeave={e => {
                                            e.currentTarget.style.borderColor = 'var(--border-color)';
                                            e.currentTarget.style.background = 'var(--bg-secondary, #f8f9fa)';
                                        }}
                                    >
                                        <div style={{
                                            fontSize: '2.2rem',
                                            width: '50px',
                                            height: '50px',
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            background: 'rgba(16, 185, 129, 0.1)',
                                            borderRadius: 'var(--radius-md, 8px)',
                                            flexShrink: 0
                                        }}>👤</div>
                                        <div>
                                            <div style={{ fontWeight: 700, fontSize: '1.05rem', marginBottom: '4px', color: 'var(--text-primary)' }}>
                                                Passageiro
                                            </div>
                                            <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                                                Você criará o grupo e entrará como passageiro. Sem necessidade de CNH.
                                            </div>
                                        </div>
                                    </button>
                                </div>
                            </div>
                        )}

                        {/* Passo 2: Formulário */}
                        {!createSuccess && createStep === 'form' && (
                            <div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem' }}>
                                    <button
                                        onClick={() => { setCreateStep('role'); setCreateError(''); }}
                                        style={{
                                            background: 'none',
                                            border: 'none',
                                            cursor: 'pointer',
                                            fontSize: '1.1rem',
                                            color: 'var(--text-muted)',
                                            padding: '4px'
                                        }}
                                    >
                                        ←
                                    </button>
                                    <h2 style={{ fontSize: '1.2rem', margin: 0 }}>
                                        {selectedRole === 'motorista' ? '🚗' : '👤'} Criar Grupo como {selectedRole === 'motorista' ? 'Motorista' : 'Passageiro'}
                                    </h2>
                                </div>

                                {/* Info do papel selecionado */}
                                <div style={{
                                    padding: '0.75rem 1rem',
                                    borderRadius: 'var(--radius-md, 8px)',
                                    marginBottom: '1rem',
                                    fontSize: '0.85rem',
                                    background: selectedRole === 'motorista'
                                        ? 'rgba(79, 70, 229, 0.08)'
                                        : 'rgba(16, 185, 129, 0.08)',
                                    color: 'var(--text-secondary)',
                                    border: `1px solid ${selectedRole === 'motorista' ? 'rgba(79, 70, 229, 0.2)' : 'rgba(16, 185, 129, 0.2)'}`
                                }}>
                                    {selectedRole === 'motorista'
                                        ? '🔑 Você será o motorista e administrador deste grupo.'
                                        : '📋 Você criará o grupo e entrará como passageiro. O grupo ficará sem motorista definido até que um motorista seja atribuído.'}
                                </div>

                                <form onSubmit={handleCreateSubmit}>
                                    <div className="form-group" style={{ marginBottom: '0.75rem' }}>
                                        <label className="form-label">Nome do Grupo</label>
                                        <input
                                            type="text"
                                            name="nome"
                                            className="form-input"
                                            placeholder="Ex: Carona UFS Computação"
                                            value={formData.nome}
                                            onChange={handleFormChange}
                                            required
                                        />
                                    </div>

                                    {/* CNH upload — só para motorista sem CNH */}
                                    {selectedRole === 'motorista' && !temCnh && (
                                        <div className="form-group" style={{ marginBottom: '0.75rem' }}>
                                            <label className="form-label">Foto da CNH (obrigatório)</label>
                                            <input
                                                type="file"
                                                accept="image/*"
                                                onChange={handleCnhChange}
                                                style={{
                                                    width: '100%',
                                                    padding: '8px',
                                                    border: '1px solid var(--border-color)',
                                                    borderRadius: 'var(--radius-md)',
                                                    background: 'var(--bg-secondary)',
                                                    color: 'var(--text-primary)',
                                                    fontSize: '0.85rem'
                                                }}
                                            />
                                            <small style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>
                                                Envie uma foto legível da sua CNH (máx. 5MB)
                                            </small>
                                            {cnhPreview && (
                                                <div style={{ marginTop: '8px' }}>
                                                    <img
                                                        src={cnhPreview}
                                                        alt="Preview da CNH"
                                                        style={{
                                                            maxWidth: '100%',
                                                            maxHeight: '150px',
                                                            borderRadius: 'var(--radius-md)',
                                                            border: '1px solid var(--border-color)',
                                                            objectFit: 'contain'
                                                        }}
                                                    />
                                                </div>
                                            )}
                                        </div>
                                    )}

                                    <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '0.75rem' }}>
                                        <div className="form-group" style={{ flex: 1, marginBottom: 0 }}>
                                            <label className="form-label">Horário Ida</label>
                                            <input
                                                type="time"
                                                name="horarioIda"
                                                className="form-input"
                                                value={formData.horarioIda}
                                                onChange={handleFormChange}
                                            />
                                        </div>
                                        <div className="form-group" style={{ flex: 1, marginBottom: 0 }}>
                                            <label className="form-label">Horário Volta</label>
                                            <input
                                                type="time"
                                                name="horarioVolta"
                                                className="form-input"
                                                value={formData.horarioVolta}
                                                onChange={handleFormChange}
                                            />
                                        </div>
                                    </div>

                                    <div className="form-group" style={{ marginBottom: '0.75rem' }}>
                                        <label className="form-label">Modelo de Cobrança</label>
                                        <select
                                            name="modeloPrecificacao"
                                            className="form-input"
                                            value={formData.modeloPrecificacao}
                                            onChange={handleFormChange}
                                        >
                                            <option value="semanal">Valor Semanal (rateado)</option>
                                            <option value="por_trajeto">Por Trajeto (débito automático)</option>
                                        </select>
                                    </div>

                                    {isPorTrajeto ? (
                                        <>
                                            <div className="form-group" style={{ marginBottom: '0.75rem' }}>
                                                <label className="form-label">Valor por Trajeto (R$)</label>
                                                <input
                                                    type="number"
                                                    name="valorTrajeto"
                                                    className="form-input"
                                                    placeholder="Ex: 5"
                                                    step="0.01"
                                                    min="0"
                                                    value={formData.valorTrajeto}
                                                    onChange={handleFormChange}
                                                />
                                                <small style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>
                                                    Débito gerado ao confirmar presença (ida e volta separados)
                                                </small>
                                            </div>
                                            <div className="form-group" style={{ marginBottom: '0.75rem' }}>
                                                <label className="form-label">Tempo limite para cancelar (min)</label>
                                                <input
                                                    type="number"
                                                    name="tempoLimiteCancelamento"
                                                    className="form-input"
                                                    placeholder="30"
                                                    min="0"
                                                    max="180"
                                                    value={formData.tempoLimiteCancelamento}
                                                    onChange={handleFormChange}
                                                />
                                                <small style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>
                                                    Minutos antes do horário. Após, só motorista pode cancelar.
                                                </small>
                                            </div>
                                        </>
                                    ) : (
                                        <div className="form-group" style={{ marginBottom: '0.75rem' }}>
                                            <label className="form-label">Valor Semanal (R$)</label>
                                            <input
                                                type="number"
                                                name="valorSemanal"
                                                className="form-input"
                                                placeholder="Ex: 50"
                                                step="0.01"
                                                min="0"
                                                value={formData.valorSemanal}
                                                onChange={handleFormChange}
                                            />
                                            <small style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>
                                                Dividido entre os confirmados no fim da semana
                                            </small>
                                        </div>
                                    )}

                                    {createError && (
                                        <div style={{
                                            color: 'var(--error)',
                                            fontSize: '0.85rem',
                                            marginBottom: '0.75rem',
                                            padding: '0.75rem',
                                            background: 'var(--error-bg)',
                                            borderRadius: 'var(--radius-md)'
                                        }}>
                                            {createError}
                                        </div>
                                    )}

                                    <button
                                        type="submit"
                                        className="btn btn-primary"
                                        disabled={creating}
                                        style={{ width: '100%' }}
                                    >
                                        {creating ? 'Criando...' : '✨ Criar Grupo'}
                                    </button>
                                </form>
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}
