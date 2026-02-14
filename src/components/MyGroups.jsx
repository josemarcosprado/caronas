import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase.js';
import { useAuth } from '../contexts/AuthContext.jsx';
import AvailableGroups from './AvailableGroups.jsx';

/**
 * MyGroups — User-focused Dashboard
 * Shows: user's groups, available groups, profile, delete account
 * This is the main landing page for logged-in users
 */
export default function MyGroups() {
    const { user, logout, refreshSession, isSuperAdmin } = useAuth();
    const navigate = useNavigate();

    const [meusGrupos, setMeusGrupos] = useState([]);
    const [loading, setLoading] = useState(true);
    const [activeSection, setActiveSection] = useState('grupos'); // 'grupos' | 'perfil'

    // Profile edit state
    const [perfilEdit, setPerfilEdit] = useState({
        nome: user?.nome || '',
        telefone: user?.telefone || '',
        matricula: user?.matricula || '',
        bairro: user?.bairro || '',
        avatarPreview: user?.avatar_url || null,
        avatarFile: null
    });
    const [savingProfile, setSavingProfile] = useState(false);

    useEffect(() => {
        if (user) {
            setPerfilEdit({
                nome: user.nome || '',
                telefone: user.telefone || '',
                matricula: user.matricula || '',
                bairro: user.bairro || '',
                avatarPreview: user.avatar_url || null,
                avatarFile: null
            });
        }
    }, [user]);

    // Load user's groups
    useEffect(() => {
        if (!user) return;

        const loadGroups = async () => {
            try {
                const { data: memberships, error } = await supabase
                    .from('membros')
                    .select('*, grupos(id, nome, modelo_precificacao, valor_semanal, valor_trajeto, horario_ida, horario_volta)')
                    .eq('usuario_id', user.id)
                    .eq('ativo', true)
                    .order('created_at', { ascending: false });

                if (error) throw error;

                // Filter out memberships where the group was deleted (null join)
                const valid = (memberships || []).filter(m => m.grupos != null);
                setMeusGrupos(valid);
            } catch (err) {
                console.error('Erro ao carregar grupos:', err);
            } finally {
                setLoading(false);
            }
        };
        loadGroups();
    }, [user]);

    // Save profile
    const handleSaveProfile = async (e) => {
        e.preventDefault();
        setSavingProfile(true);
        try {
            let avatarUrl = perfilEdit.avatarPreview;

            // Upload new avatar if selected
            if (perfilEdit.avatarFile) {
                const fileExt = perfilEdit.avatarFile.name.split('.').pop();
                const fileName = `${user.id}-${Date.now()}.${fileExt}`;
                const filePath = `${fileName}`;

                console.log('[PERFIL] Uploading avatar...', { filePath, fileSize: perfilEdit.avatarFile.size, fileType: perfilEdit.avatarFile.type });

                const { data: uploadData, error: uploadError } = await supabase.storage
                    .from('avatars')
                    .upload(filePath, perfilEdit.avatarFile, { upsert: true });

                console.log('[PERFIL] Upload result:', { uploadData, uploadError });

                if (uploadError) {
                    console.error('[PERFIL] Upload FAILED:', uploadError);
                    throw uploadError;
                }

                const { data: urlData } = supabase.storage
                    .from('avatars')
                    .getPublicUrl(filePath);

                avatarUrl = urlData.publicUrl;
                console.log('[PERFIL] Avatar URL:', avatarUrl);
            }

            const updateData = {
                nome: perfilEdit.nome,
                telefone: perfilEdit.telefone,
                matricula: perfilEdit.matricula,
                bairro: perfilEdit.bairro.trim()
            };

            if (perfilEdit.avatarFile) {
                updateData.avatar_url = avatarUrl;
            }

            console.log('[PERFIL] Updating usuarios table...', { userId: user.id, updateData });

            const { data: updateResult, error } = await supabase
                .from('usuarios')
                .update(updateData)
                .eq('id', user.id)
                .select();

            console.log('[PERFIL] Update result:', { updateResult, error });

            if (error) throw error;
            await refreshSession();
            alert('Perfil atualizado com sucesso!');
        } catch (err) {
            console.error('[PERFIL] ERROR:', err);
            alert('Erro ao salvar perfil: ' + err.message);
        } finally {
            setSavingProfile(false);
        }
    };

    // Delete account
    const deletarConta = async () => {
        if (!confirm('Tem certeza que deseja EXCLUIR sua conta? Você será removido de todos os grupos. Esta ação é irreversível!')) return;
        if (!confirm('ÚLTIMA CONFIRMAÇÃO: Excluir permanentemente sua conta (' + user?.nome + ')?')) return;

        try {
            await supabase.from('membros').delete().eq('usuario_id', user.id);
            const { error } = await supabase.from('usuarios').delete().eq('id', user.id);
            if (error) throw error;
            logout();
            navigate('/');
        } catch (err) {
            alert('Erro ao deletar conta: ' + err.message);
        }
    };

    const handleLogout = () => {
        logout();
        navigate('/');
    };

    if (!user) {
        navigate('/login');
        return null;
    }

    const aprovados = meusGrupos.filter(m => m.status_aprovacao === 'aprovado');
    const pendentes = meusGrupos.filter(m => m.status_aprovacao === 'pendente');

    return (
        <div className="container" style={{ maxWidth: 800, paddingTop: 'var(--space-4)', paddingBottom: 'var(--space-6)' }}>
            {/* Header */}
            <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: 'var(--space-5)'
            }}>
                <div>
                    <h1 style={{ margin: 0, fontSize: 'var(--font-size-xl)' }}>
                        🚗 Cajurona
                    </h1>
                    <p style={{ margin: 0, color: 'var(--text-secondary)', fontSize: 'var(--font-size-sm)' }}>
                        Olá, <strong>{user.nome}</strong>
                    </p>
                </div>
                <div style={{ display: 'flex', gap: 'var(--space-2)', alignItems: 'center' }}>
                    {isSuperAdmin && (
                        <Link
                            to="/aprovacoes"
                            className="btn btn-secondary"
                            style={{ padding: '6px 12px', fontSize: 'var(--font-size-xs)' }}
                        >
                            🛡️ Admin
                        </Link>
                    )}
                    <button
                        className="btn btn-secondary"
                        style={{ padding: '6px 12px', fontSize: 'var(--font-size-xs)' }}
                        onClick={handleLogout}
                    >
                        Sair
                    </button>
                </div>
            </div>

            {/* Tab navigation */}
            <div style={{
                display: 'flex',
                gap: 'var(--space-1)',
                marginBottom: 'var(--space-4)',
                borderBottom: '1px solid var(--border-color)',
                paddingBottom: 'var(--space-1)'
            }}>
                <button
                    className={`btn ${activeSection === 'grupos' ? 'btn-primary' : 'btn-secondary'}`}
                    style={{ fontSize: 'var(--font-size-sm)', padding: '8px 16px' }}
                    onClick={() => setActiveSection('grupos')}
                >
                    📋 Meus Grupos
                </button>
                <button
                    className={`btn ${activeSection === 'perfil' ? 'btn-primary' : 'btn-secondary'}`}
                    style={{ fontSize: 'var(--font-size-sm)', padding: '8px 16px' }}
                    onClick={() => setActiveSection('perfil')}
                >
                    👤 Meu Perfil
                </button>
                <button
                    className={`btn ${activeSection === 'agenda' ? 'btn-primary' : 'btn-secondary'}`}
                    style={{ fontSize: 'var(--font-size-sm)', padding: '8px 16px' }}
                    onClick={() => setActiveSection('agenda')}
                >
                    📅 Minha Agenda
                </button>
            </div>

            {/* ===== MINHA AGENDA SECTION ===== */}
            {activeSection === 'agenda' && (
                <MinhaAgenda user={user} meusGrupos={meusGrupos} />
            )}

            {/* ===== GRUPOS SECTION ===== */}
            {activeSection === 'grupos' && (
                <div>
                    {loading ? (
                        <div style={{ textAlign: 'center', padding: 'var(--space-6)', color: 'var(--text-muted)' }}>
                            Carregando...
                        </div>
                    ) : (
                        <>
                            {/* My approved groups */}
                            {aprovados.length > 0 && (
                                <div style={{ marginBottom: 'var(--space-5)' }}>
                                    <h3 style={{ marginBottom: 'var(--space-3)', color: 'var(--text-primary)' }}>
                                        Meus Grupos
                                    </h3>
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
                                        {aprovados.map(m => (
                                            <Link
                                                key={m.id}
                                                to={m.is_motorista ? `/admin/${m.grupo_id}` : `/g/${m.grupo_id}`}
                                                className="card"
                                                style={{
                                                    textDecoration: 'none',
                                                    color: 'inherit',
                                                    display: 'flex',
                                                    justifyContent: 'space-between',
                                                    alignItems: 'center',
                                                    padding: 'var(--space-4)',
                                                    transition: 'transform 0.15s ease, box-shadow 0.15s ease',
                                                    cursor: 'pointer',
                                                    borderLeft: m.is_motorista
                                                        ? '4px solid #3b82f6'
                                                        : '4px solid #22c55e',
                                                    background: m.is_motorista
                                                        ? 'linear-gradient(135deg, rgba(59,130,246,0.08), transparent)'
                                                        : 'linear-gradient(135deg, rgba(34,197,94,0.08), transparent)'
                                                }}
                                                onMouseOver={e => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.2)'; }}
                                                onMouseOut={e => { e.currentTarget.style.transform = ''; e.currentTarget.style.boxShadow = ''; }}
                                            >
                                                <div>
                                                    <div style={{ fontWeight: 600, fontSize: 'var(--font-size-md)' }}>
                                                        {m.is_motorista ? '🚗' : '👤'} {m.grupos.nome}
                                                    </div>
                                                    <div style={{ fontSize: 'var(--font-size-sm)', color: 'var(--text-secondary)', marginTop: 2 }}>
                                                        {m.is_motorista ? 'Motorista' : 'Passageiro'}
                                                        {' · '}
                                                        {m.grupos.modelo_precificacao === 'semanal'
                                                            ? `R$ ${Number(m.grupos.valor_semanal || 0).toFixed(2)}/semana`
                                                            : `R$ ${Number(m.grupos.valor_trajeto || 0).toFixed(2)}/trajeto`
                                                        }
                                                    </div>
                                                    <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)', marginTop: 2 }}>
                                                        🕐 {m.grupos.horario_ida?.slice(0, 5)} → {m.grupos.horario_volta?.slice(0, 5)}
                                                    </div>
                                                </div>
                                                <div style={{ fontSize: '1.2rem', color: 'var(--text-muted)' }}>→</div>
                                            </Link>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* Pending approvals */}
                            {pendentes.length > 0 && (
                                <div style={{ marginBottom: 'var(--space-5)' }}>
                                    <h3 style={{ marginBottom: 'var(--space-3)', color: 'var(--text-secondary)' }}>
                                        ⏳ Aprovação Pendente
                                    </h3>
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
                                        {pendentes.map(m => (
                                            <div
                                                key={m.id}
                                                className="card"
                                                style={{
                                                    padding: 'var(--space-3)',
                                                    opacity: 0.7,
                                                    borderLeft: '3px solid var(--warning, #f59e0b)'
                                                }}
                                            >
                                                <div style={{ fontWeight: 600 }}>{m.grupos?.nome || 'Grupo removido'}</div>
                                                <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)' }}>
                                                    Aguardando aprovação do motorista
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* No groups */}
                            {meusGrupos.length === 0 && (
                                <div className="card" style={{ textAlign: 'center', padding: 'var(--space-6)' }}>
                                    <div style={{ fontSize: '3rem', marginBottom: 'var(--space-3)' }}>🔍</div>
                                    <h3>Você ainda não participa de nenhum grupo</h3>
                                    <p style={{ color: 'var(--text-muted)', marginBottom: 'var(--space-4)' }}>
                                        Entre em um grupo existente ou crie o seu próprio!
                                    </p>
                                </div>
                            )}

                            {/* Quick actions */}
                            <div style={{
                                display: 'flex',
                                gap: 'var(--space-2)',
                                marginBottom: 'var(--space-5)'
                            }}>
                                <Link
                                    to="/criar"
                                    className="btn btn-primary"
                                    style={{ flex: 1, textAlign: 'center' }}
                                >
                                    ➕ Criar Grupo
                                </Link>
                            </div>

                            {/* Available groups */}
                            <div>
                                <h3 style={{ marginBottom: 'var(--space-3)', color: 'var(--text-primary)' }}>
                                    🌐 Grupos Disponíveis
                                </h3>
                                <AvailableGroups />
                            </div>
                        </>
                    )}
                </div>
            )}

            {/* ===== PERFIL SECTION ===== */}
            {activeSection === 'perfil' && (
                <div>
                    <div className="card" style={{ padding: 'var(--space-4)' }}>
                        <h3 style={{ marginBottom: 'var(--space-3)' }}>👤 Meu Perfil</h3>

                        {/* Avatar Upload */}
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: 'var(--space-4)' }}>
                            <div style={{
                                width: '100px',
                                height: '100px',
                                borderRadius: '50%',
                                background: '#e2e8f0',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                overflow: 'hidden',
                                border: '3px solid var(--border-color)',
                                position: 'relative',
                                marginBottom: 'var(--space-2)'
                            }}>
                                {perfilEdit.avatarPreview ? (
                                    <img
                                        src={perfilEdit.avatarPreview}
                                        alt="Avatar"
                                        style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                                    />
                                ) : (
                                    <span style={{ fontSize: '3rem' }}>👤</span>
                                )}
                            </div>

                            <label
                                className="btn btn-secondary"
                                style={{ fontSize: '0.8rem', padding: '4px 12px', cursor: 'pointer' }}
                            >
                                📷 Alterar Foto
                                <input
                                    type="file"
                                    accept="image/*"
                                    style={{ display: 'none' }}
                                    onChange={e => {
                                        const file = e.target.files[0];
                                        if (file) {
                                            if (file.size > 2 * 1024 * 1024) {
                                                alert('A imagem deve ter no máximo 2MB.');
                                                return;
                                            }
                                            setPerfilEdit(prev => ({
                                                ...prev,
                                                avatarFile: file,
                                                avatarPreview: URL.createObjectURL(file)
                                            }));
                                        }
                                    }}
                                />
                            </label>
                        </div>

                        <form onSubmit={handleSaveProfile}>
                            <div className="form-group">
                                <label className="form-label">Nome</label>
                                <input
                                    type="text"
                                    className="form-input"
                                    value={perfilEdit.nome}
                                    onChange={e => setPerfilEdit({ ...perfilEdit, nome: e.target.value })}
                                />
                            </div>
                            <div className="form-group">
                                <label className="form-label">Telefone</label>
                                <input
                                    type="tel"
                                    className="form-input"
                                    value={perfilEdit.telefone}
                                    onChange={e => setPerfilEdit({ ...perfilEdit, telefone: e.target.value })}
                                />
                            </div>
                            <div className="form-group">
                                <label className="form-label">Matrícula</label>
                                <input
                                    type="text"
                                    className="form-input"
                                    value={perfilEdit.matricula}
                                    onChange={e => setPerfilEdit({ ...perfilEdit, matricula: e.target.value })}
                                />
                            </div>
                            <div className="form-group">
                                <label className="form-label">Bairro</label>
                                <input
                                    type="text"
                                    className="form-input"
                                    value={perfilEdit.bairro}
                                    onChange={e => setPerfilEdit({ ...perfilEdit, bairro: e.target.value })}
                                    placeholder="Ex: Centro, Jabotiana, Luzia"
                                />
                                <small style={{ color: 'var(--text-muted)' }}>
                                    Bairro onde você mora ou deseja ser pego na carona.
                                </small>
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

                    {/* Danger Zone */}
                    <div className="card" style={{
                        marginTop: 'var(--space-4)',
                        borderLeft: '4px solid var(--error, #dc3545)',
                        padding: 'var(--space-4)'
                    }}>
                        <h4 style={{ color: 'var(--error, #dc3545)', marginBottom: 'var(--space-2)' }}>
                            ⚠️ Zona de Perigo
                        </h4>
                        <p style={{ fontSize: 'var(--font-size-sm)', color: 'var(--text-muted)', marginBottom: 'var(--space-3)' }}>
                            Esta ação é irreversível.
                        </p>
                        <button
                            className="btn"
                            style={{
                                background: 'transparent',
                                color: 'var(--error)',
                                border: '1px solid var(--error)',
                                opacity: 0.8,
                                fontSize: 'var(--font-size-sm)'
                            }}
                            onClick={deletarConta}
                        >
                            🗑️ Excluir Minha Conta
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}

function MinhaAgenda({ user, meusGrupos }) {
    const [agenda, setAgenda] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const loadAgenda = async () => {
            if (!meusGrupos.length) {
                setLoading(false);
                return;
            }

            const grupoIds = meusGrupos.map(m => m.grupo_id);
            const hoje = new Date().toISOString().split('T')[0];
            const nextWeek = new Date();
            nextWeek.setDate(nextWeek.getDate() + 7);
            const nextWeekStr = nextWeek.toISOString().split('T')[0];

            const { data, error } = await supabase
                .from('viagens')
                .select(`
                    *,
                    grupos (id, nome)
                `)
                .in('grupo_id', grupoIds)
                .gte('data', hoje)
                .lte('data', nextWeekStr)
                .order('data', { ascending: true })
                .order('horario_partida', { ascending: true });

            if (error) {
                console.error('Erro ao carregar agenda:', error);
            } else {
                setAgenda(data || []);
            }
            setLoading(false);
        };

        loadAgenda();
    }, [meusGrupos]);

    if (loading) return <div style={{ padding: '20px', textAlign: 'center' }}>Carregando agenda...</div>;

    if (agenda.length === 0) {
        return (
            <div className="card" style={{ padding: 'var(--space-6)', textAlign: 'center' }}>
                <h3>📅 Nenhuma viagem agendada</h3>
                <p style={{ color: 'var(--text-muted)' }}>
                    Você não tem caronas agendadas para os próximos 7 dias.
                </p>
            </div>
        );
    }

    // Group by date
    const grouped = agenda.reduce((acc, viagem) => {
        const data = viagem.data;
        if (!acc[data]) acc[data] = [];
        acc[data].push(viagem);
        return acc;
    }, {});

    const diasSemana = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
            {Object.entries(grouped).map(([data, viagens]) => {
                const dateObj = new Date(data + 'T12:00:00'); // Force noon to avoid timezone issues
                const diaNome = diasSemana[dateObj.getDay()];
                const dataFormatada = dateObj.toLocaleDateString('pt-BR');

                return (
                    <div key={data} className="card">
                        <div style={{
                            padding: 'var(--space-3)',
                            borderBottom: '1px solid var(--border-color)',
                            fontWeight: 'bold',
                            background: 'var(--surface-hover)'
                        }}>
                            {diaNome}, {dataFormatada}
                        </div>
                        <div>
                            {viagens.map(v => (
                                <div key={v.id} style={{
                                    padding: 'var(--space-3)',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: 'var(--space-3)',
                                    borderBottom: '1px solid var(--border-color)'
                                }}>
                                    <div style={{
                                        fontSize: '1.2rem',
                                        background: v.tipo === 'ida' ? '#e0f2fe' : '#f0fdf4',
                                        padding: '8px',
                                        borderRadius: '8px'
                                    }}>
                                        {v.tipo === 'ida' ? '🌅' : '🌙'}
                                    </div>
                                    <div style={{ flex: 1 }}>
                                        <div style={{ fontWeight: 600 }}>
                                            {v.horario_partida?.slice(0, 5)} - {v.grupos?.nome}
                                        </div>
                                        <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                                            {v.tipo === 'ida' ? 'Ida para UFS' : 'Volta da UFS'}
                                            Build Status: {v.status}
                                        </div>
                                    </div>
                                    <div>
                                        <Link
                                            to={`/g/${v.grupo_id}`}
                                            className="btn btn-secondary"
                                            style={{ fontSize: '0.8rem', padding: '4px 10px' }}
                                        >
                                            Ver
                                        </Link>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                );
            })}
        </div>
    );
}
