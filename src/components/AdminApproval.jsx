import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase.js';

const ADMIN_SECRET = import.meta.env.VITE_ADMIN_SECRET;

export default function AdminApproval() {
    const [autenticado, setAutenticado] = useState(false);
    const [senha, setSenha] = useState('');
    const [senhaError, setSenhaError] = useState('');
    const [pendentes, setPendentes] = useState([]);
    const [loading, setLoading] = useState(false);
    const [imagemExpandida, setImagemExpandida] = useState(null);

    const handleLogin = (e) => {
        e.preventDefault();
        if (senha === ADMIN_SECRET) {
            setAutenticado(true);
            setSenhaError('');
            carregarPendentes();
        } else {
            setSenhaError('Senha incorreta.');
        }
    };

    const carregarPendentes = async () => {
        setLoading(true);
        try {
            const { data, error } = await supabase
                .from('membros')
                .select(`
                    id,
                    nome,
                    telefone,
                    is_motorista,
                    cnh_url,
                    matricula,
                    status_aprovacao,
                    created_at,
                    grupo_id,
                    grupos ( nome )
                `)
                .in('status_aprovacao', ['pendente'])
                .order('created_at', { ascending: true });

            if (error) throw error;
            setPendentes(data || []);
        } catch (err) {
            console.error('Erro ao carregar pendentes:', err);
        } finally {
            setLoading(false);
        }
    };

    const atualizarStatus = async (membroId, novoStatus) => {
        const acao = novoStatus === 'aprovado' ? 'aprovar' : 'rejeitar';
        if (!confirm(`Tem certeza que deseja ${acao} este membro?`)) return;

        try {
            const { error } = await supabase
                .from('membros')
                .update({ status_aprovacao: novoStatus })
                .eq('id', membroId);

            if (error) throw error;
            // Remover da lista local
            setPendentes(prev => prev.filter(p => p.id !== membroId));
        } catch (err) {
            alert('Erro ao atualizar status: ' + err.message);
        }
    };

    const formatarData = (dataStr) => {
        const d = new Date(dataStr);
        return d.toLocaleDateString('pt-BR', {
            day: '2-digit', month: '2-digit', year: 'numeric',
            hour: '2-digit', minute: '2-digit'
        });
    };

    // Tela de login com senha admin
    if (!autenticado) {
        return (
            <div className="login-container">
                <div className="login-card">
                    <h1 className="login-title">
                        🔐 Painel de Aprovações
                    </h1>
                    <form onSubmit={handleLogin}>
                        <div className="form-group">
                            <label className="form-label">Senha Administrativa</label>
                            <input
                                type="password"
                                className="form-input"
                                placeholder="Digite a senha admin"
                                value={senha}
                                onChange={e => setSenha(e.target.value)}
                                required
                            />
                        </div>
                        {senhaError && (
                            <div style={{
                                color: 'var(--error)',
                                fontSize: 'var(--font-size-sm)',
                                marginBottom: 'var(--space-4)',
                                padding: 'var(--space-3)',
                                background: 'var(--error-bg)',
                                borderRadius: 'var(--radius-md)'
                            }}>
                                {senhaError}
                            </div>
                        )}
                        <button type="submit" className="btn btn-primary">
                            Entrar
                        </button>
                    </form>
                </div>
            </div>
        );
    }

    return (
        <div className="container">
            <header className="header">
                <div>
                    <h1 className="header-title">
                        <span className="icon">🔐</span>
                        Aprovações de Membros
                    </h1>
                    <p className="header-subtitle">
                        {pendentes.length} pendente{pendentes.length !== 1 ? 's' : ''}
                    </p>
                </div>
                <button
                    className="btn btn-secondary"
                    onClick={carregarPendentes}
                    disabled={loading}
                    style={{ fontSize: 'var(--font-size-sm)' }}
                >
                    🔄 Atualizar
                </button>
            </header>

            {loading ? (
                <div style={{ textAlign: 'center', padding: 'var(--space-8)' }}>
                    <p style={{ color: 'var(--text-muted)' }}>Carregando...</p>
                </div>
            ) : pendentes.length === 0 ? (
                <div className="empty-state">
                    <div className="icon">✅</div>
                    <p>Nenhuma aprovação pendente!</p>
                </div>
            ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
                    {pendentes.map(membro => (
                        <div key={membro.id} className="day-detail">
                            {/* Info do membro */}
                            <div style={{ marginBottom: 'var(--space-3)' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                                    <div>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', marginBottom: 'var(--space-1)' }}>
                                            <h3 style={{ margin: 0 }}>
                                                {membro.nome}
                                            </h3>
                                            <span style={{
                                                padding: '2px 8px',
                                                borderRadius: 'var(--radius-sm)',
                                                fontSize: 'var(--font-size-xs)',
                                                fontWeight: 600,
                                                background: membro.is_motorista ? 'var(--info-bg, #cce5ff)' : 'var(--success-bg, #d4edda)',
                                                color: membro.is_motorista ? 'var(--info, #004085)' : 'var(--success, #155724)'
                                            }}>
                                                {membro.is_motorista ? '🚗 Motorista' : '👤 Passageiro'}
                                            </span>
                                        </div>
                                        <p style={{ fontSize: 'var(--font-size-sm)', color: 'var(--text-secondary)' }}>
                                            📱 {membro.telefone}
                                        </p>
                                        <p style={{ fontSize: 'var(--font-size-sm)', color: 'var(--text-muted)' }}>
                                            Grupo: {membro.grupos?.nome || 'Desconhecido'}
                                        </p>
                                    </div>
                                    <span style={{
                                        fontSize: 'var(--font-size-xs)',
                                        color: 'var(--text-muted)'
                                    }}>
                                        {formatarData(membro.created_at)}
                                    </span>
                                </div>
                            </div>

                            {/* Documentos */}
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)', marginBottom: 'var(--space-3)' }}>
                                {/* CNH (apenas motoristas) */}
                                {membro.is_motorista && (
                                    membro.cnh_url ? (
                                        <div>
                                            <p style={{ fontSize: 'var(--font-size-sm)', color: 'var(--text-secondary)', marginBottom: 'var(--space-2)' }}>
                                                🪪 Foto da CNH:
                                            </p>
                                            <img
                                                src={membro.cnh_url}
                                                alt={`CNH de ${membro.nome}`}
                                                onClick={() => setImagemExpandida(membro.cnh_url)}
                                                style={{ maxWidth: '100%', maxHeight: '250px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)', cursor: 'pointer', objectFit: 'contain' }}
                                            />
                                        </div>
                                    ) : (
                                        <p style={{ color: 'var(--error)', fontSize: 'var(--font-size-sm)' }}>⚠️ CNH não enviada</p>
                                    )
                                )}

                                {/* Matrícula (todos) */}
                                {membro.matricula ? (
                                    <div>
                                        <p style={{ fontSize: 'var(--font-size-sm)', color: 'var(--text-secondary)', marginBottom: 'var(--space-2)' }}>
                                            🎓 Matrícula:
                                        </p>
                                        <div style={{
                                            padding: 'var(--space-3)',
                                            background: 'var(--bg-secondary)',
                                            borderRadius: 'var(--radius-md)',
                                            border: '1px solid var(--border-color)',
                                            fontSize: 'var(--font-size-lg)',
                                            fontWeight: 600,
                                            letterSpacing: '0.05em'
                                        }}>
                                            {membro.matricula}
                                        </div>
                                    </div>
                                ) : (
                                    <p style={{ color: 'var(--error)', fontSize: 'var(--font-size-sm)' }}>⚠️ Matrícula não informada</p>
                                )}

                                {membro.is_motorista && membro.cnh_url && (
                                    <small style={{ color: 'var(--text-muted)', fontSize: 'var(--font-size-xs)' }}>
                                        Clique na imagem da CNH para ampliar
                                    </small>
                                )}
                            </div>

                            {/* Botões de ação */}
                            <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
                                <button
                                    className="btn btn-primary"
                                    style={{ flex: 1 }}
                                    onClick={() => atualizarStatus(membro.id, 'aprovado')}
                                >
                                    ✅ Aprovar
                                </button>
                                <button
                                    className="btn"
                                    style={{
                                        flex: 1,
                                        background: 'var(--error)',
                                        color: 'white'
                                    }}
                                    onClick={() => atualizarStatus(membro.id, 'rejeitado')}
                                >
                                    ❌ Rejeitar
                                </button>
                            </div>
                        </div>
                    ))}
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
