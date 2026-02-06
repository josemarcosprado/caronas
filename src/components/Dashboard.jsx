import { useState, useEffect, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import { supabase } from '../lib/supabase.js';

export default function Dashboard({ isAdmin = false }) {
    const { grupoId } = useParams();
    const [grupo, setGrupo] = useState(null);
    const [membros, setMembros] = useState([]);
    const [viagens, setViagens] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [activeTab, setActiveTab] = useState('inicio');
    const [editando, setEditando] = useState(false);
    const [formConfig, setFormConfig] = useState({});

    // Carregar dados
    const loadData = useCallback(async () => {
        try {
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

            // Buscar membros
            const { data: membrosData } = await supabase
                .from('membros')
                .select('*')
                .eq('grupo_id', grupoId)
                .eq('ativo', true)
                .order('is_motorista', { ascending: false });

            setMembros(membrosData || []);

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

        } catch (err) {
            console.error('Erro ao carregar dados:', err);
            setError('Não foi possível carregar os dados.');
        } finally {
            setLoading(false);
        }
    }, [grupoId]);

    useEffect(() => {
        loadData();
    }, [loadData]);

    // Salvar configurações
    const salvarConfig = async () => {
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

    // Formatar data
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

    return (
        <div className="container">
            {/* Header */}
            <header className="header">
                <div>
                    <h1 className="header-title">
                        <span className="icon">🚗</span>
                        {grupo.nome}
                    </h1>
                    <p className="header-subtitle">
                        {membros.length} membro{membros.length !== 1 ? 's' : ''} •
                        {grupo.modelo_precificacao === 'por_trajeto'
                            ? ` R$${parseFloat(grupo.valor_trajeto).toFixed(2)}/trajeto`
                            : ` R$${parseFloat(grupo.valor_semanal).toFixed(2)}/semana`
                        }
                    </p>
                </div>
            </header>

            {/* Tabs */}
            <div style={{
                display: 'flex',
                gap: 'var(--space-2)',
                marginBottom: 'var(--space-4)',
                borderBottom: '1px solid var(--border-color)',
                paddingBottom: 'var(--space-2)'
            }}>
                {['inicio', 'viagens', 'membros', 'config'].map(tab => (
                    <button
                        key={tab}
                        onClick={() => setActiveTab(tab)}
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
                    </button>
                ))}
            </div>

            {/* Tab: Início */}
            {activeTab === 'inicio' && (
                <div>
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
                            <button
                                className="btn btn-secondary"
                                onClick={() => setActiveTab('config')}
                            >
                                ⚙️ Configurar grupo
                            </button>
                            <button
                                className="btn btn-secondary"
                                onClick={() => setActiveTab('membros')}
                            >
                                👥 Gerenciar membros
                            </button>
                        </div>
                    </div>

                    {/* Bot Info */}
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
                    <div className="member-list">
                        {membros.map(membro => (
                            <div key={membro.id} className="member-item">
                                <div className={`member-avatar ${membro.is_motorista ? 'driver' : ''}`}>
                                    {membro.nome?.split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase()}
                                </div>
                                <div className="member-info">
                                    <div className="member-name">{membro.nome}</div>
                                    <div className="member-status">
                                        📱 {membro.telefone}
                                    </div>
                                </div>
                                {membro.is_motorista && (
                                    <span className="member-badge driver">Motorista</span>
                                )}
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Tab: Configurações */}
            {activeTab === 'config' && (
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

                    {/* Danger Zone */}
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
                            onClick={() => alert('Funcionalidade em desenvolvimento')}
                        >
                            🗑️ Excluir Grupo
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}
