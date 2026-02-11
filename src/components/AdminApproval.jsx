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
                    cnh_url,
                    status_aprovacao,
                    created_at,
                    grupo_id,
                    grupos ( nome )
                `)
                .eq('is_motorista', true)
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
        if (!confirm(`Tem certeza que deseja ${acao} este motorista?`)) return;

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
                        Aprovações de Motoristas
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
                            {/* Info do motorista */}
                            <div style={{ marginBottom: 'var(--space-3)' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                                    <div>
                                        <h3 style={{ marginBottom: 'var(--space-1)' }}>
                                            {membro.nome}
                                        </h3>
                                        <p style={{ fontSize: 'var(--font-size-sm)', color: 'var(--text-secondary)' }}>
                                            📱 {membro.telefone}
                                        </p>
                                        <p style={{ fontSize: 'var(--font-size-sm)', color: 'var(--text-muted)' }}>
                                            🚗 Grupo: {membro.grupos?.nome || 'Desconhecido'}
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

                            {/* Foto da CNH */}
                            {membro.cnh_url ? (
                                <div style={{ marginBottom: 'var(--space-3)' }}>
                                    <p style={{
                                        fontSize: 'var(--font-size-sm)',
                                        color: 'var(--text-secondary)',
                                        marginBottom: 'var(--space-2)'
                                    }}>
                                        📄 Foto da CNH:
                                    </p>
                                    <img
                                        src={membro.cnh_url}
                                        alt={`CNH de ${membro.nome}`}
                                        onClick={() => setImagemExpandida(membro.cnh_url)}
                                        style={{
                                            maxWidth: '100%',
                                            maxHeight: '300px',
                                            borderRadius: 'var(--radius-md)',
                                            border: '1px solid var(--border-color)',
                                            cursor: 'pointer',
                                            objectFit: 'contain'
                                        }}
                                    />
                                    <small style={{
                                        display: 'block',
                                        color: 'var(--text-muted)',
                                        fontSize: 'var(--font-size-xs)',
                                        marginTop: 'var(--space-1)'
                                    }}>
                                        Clique na imagem para ampliar
                                    </small>
                                </div>
                            ) : (
                                <p style={{
                                    color: 'var(--error)',
                                    fontSize: 'var(--font-size-sm)',
                                    marginBottom: 'var(--space-3)'
                                }}>
                                    ⚠️ CNH não enviada
                                </p>
                            )}

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
                        alt="CNH ampliada"
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
