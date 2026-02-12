import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { supabase } from '../lib/supabase.js';
import { useAuth } from '../contexts/AuthContext.jsx';

/**
 * Componente para solicitar entrada em um grupo existente
 * Requer login prévio. Dados do perfil (nome, matrícula) vêm da sessão.
 * Rota: /entrar/:grupoId
 */
export default function JoinGroup() {
    const { grupoId } = useParams();
    const navigate = useNavigate();
    const { user, refreshSession } = useAuth();

    const [grupo, setGrupo] = useState(null);
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState('');
    const [sucesso, setSucesso] = useState(false);
    const [jaEMembro, setJaEMembro] = useState(false);
    const [statusMembro, setStatusMembro] = useState(null);

    // Carregar dados do grupo e verificar se já é membro
    useEffect(() => {
        const load = async () => {
            try {
                // Carregar grupo
                const { data: grupoData, error: grupoError } = await supabase
                    .from('grupos')
                    .select('id, nome')
                    .eq('id', grupoId)
                    .single();

                if (grupoError) throw grupoError;
                setGrupo(grupoData);

                // Verificar se já é membro deste grupo
                if (user) {
                    const { data: membro } = await supabase
                        .from('membros')
                        .select('id, status_aprovacao')
                        .eq('grupo_id', grupoId)
                        .eq('usuario_id', user.id)
                        .limit(1)
                        .single();

                    if (membro) {
                        setJaEMembro(true);
                        setStatusMembro(membro.status_aprovacao);
                    }
                }
            } catch (err) {
                console.error('Erro ao carregar grupo:', err);
                setError('Grupo não encontrado.');
            } finally {
                setLoading(false);
            }
        };
        load();
    }, [grupoId, user]);

    const handleSubmit = async () => {
        setSubmitting(true);
        setError('');

        try {
            // Criar membro (passageiro pendente de aprovação pelo motorista)
            const { error: membroError } = await supabase
                .from('membros')
                .insert({
                    grupo_id: grupoId,
                    usuario_id: user.id,
                    nome: user.nome,
                    telefone: user.telefone,
                    is_motorista: false,
                    ativo: true,
                    dias_padrao: ['seg', 'ter', 'qua', 'qui', 'sex'],
                    status_aprovacao: 'pendente'
                });

            if (membroError) {
                if (membroError.message.includes('membros_grupo_usuario_key') || membroError.message.includes('duplicate')) {
                    throw new Error('Você já faz parte deste grupo.');
                }
                throw membroError;
            }

            await refreshSession();
            setSucesso(true);
        } catch (err) {
            console.error('Erro ao solicitar entrada:', err);
            setError(err.message || 'Erro ao processar solicitação.');
        } finally {
            setSubmitting(false);
        }
    };

    if (loading) {
        return (
            <div className="login-container">
                <div className="login-card" style={{ textAlign: 'center' }}>
                    <p style={{ color: 'var(--text-muted)' }}>Carregando...</p>
                </div>
            </div>
        );
    }

    if (!grupo) {
        return (
            <div className="login-container">
                <div className="login-card" style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: '4rem', marginBottom: 'var(--space-4)' }}>⚠️</div>
                    <p>Grupo não encontrado.</p>
                    <Link to="/" className="btn btn-primary" style={{ marginTop: 'var(--space-4)' }}>
                        🏠 Voltar ao Início
                    </Link>
                </div>
            </div>
        );
    }

    // Tela de sucesso
    if (sucesso) {
        return (
            <div className="login-container">
                <div className="login-card" style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: '4rem', marginBottom: 'var(--space-4)' }}>⏳</div>
                    <h1 style={{ fontSize: 'var(--font-size-2xl)', marginBottom: 'var(--space-2)' }}>
                        Solicitação Enviada!
                    </h1>
                    <p style={{ color: 'var(--text-secondary)', marginBottom: 'var(--space-4)' }}>
                        Seu pedido para entrar em <strong>{grupo.nome}</strong> foi enviado.
                    </p>

                    <div style={{
                        background: 'var(--warning-bg, #fff3cd)',
                        color: 'var(--warning, #856404)',
                        padding: 'var(--space-4)',
                        borderRadius: 'var(--radius-md)',
                        marginBottom: 'var(--space-4)',
                        fontSize: 'var(--font-size-sm)'
                    }}>
                        <strong>📋 Aguardando aprovação</strong>
                        <p style={{ marginTop: 'var(--space-2)', marginBottom: 0 }}>
                            O motorista do grupo irá revisar seus dados e aprovar sua entrada.
                        </p>
                    </div>

                    <button
                        className="btn btn-secondary"
                        onClick={() => navigate('/')}
                    >
                        🏠 Voltar ao Início
                    </button>
                </div>
            </div>
        );
    }

    // Já é membro
    if (jaEMembro) {
        return (
            <div className="login-container">
                <div className="login-card" style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: '4rem', marginBottom: 'var(--space-4)' }}>
                        {statusMembro === 'aprovado' ? '✅' : statusMembro === 'pendente' ? '⏳' : '❌'}
                    </div>
                    <h1 style={{ fontSize: 'var(--font-size-2xl)', marginBottom: 'var(--space-2)' }}>
                        {statusMembro === 'aprovado' ? 'Você já é membro!' :
                            statusMembro === 'pendente' ? 'Aguardando aprovação' :
                                'Solicitação rejeitada'}
                    </h1>
                    <p style={{ color: 'var(--text-secondary)', marginBottom: 'var(--space-4)' }}>
                        {statusMembro === 'aprovado'
                            ? `Você já faz parte de ${grupo.nome}.`
                            : statusMembro === 'pendente'
                                ? `Sua solicitação para ${grupo.nome} está em análise.`
                                : `Sua solicitação para ${grupo.nome} foi rejeitada.`
                        }
                    </p>

                    {statusMembro === 'aprovado' ? (
                        <button
                            className="btn btn-primary"
                            onClick={() => navigate(`/g/${grupoId}`)}
                        >
                            📊 Ir para o Dashboard
                        </button>
                    ) : (
                        <button
                            className="btn btn-secondary"
                            onClick={() => navigate('/')}
                        >
                            🏠 Voltar ao Início
                        </button>
                    )}
                </div>
            </div>
        );
    }

    return (
        <div className="login-container">
            <div className="login-card" style={{ textAlign: 'center' }}>
                <h1 className="login-title">
                    🚗 Entrar no Grupo
                    <br />
                    <span style={{ fontSize: '1rem', fontWeight: 400, color: 'var(--text-secondary)' }}>
                        {grupo.nome}
                    </span>
                </h1>

                {/* Info do perfil (vem da conta) */}
                <div style={{
                    background: 'var(--bg-secondary)',
                    padding: 'var(--space-4)',
                    borderRadius: 'var(--radius-md)',
                    marginBottom: 'var(--space-4)',
                    textAlign: 'left'
                }}>
                    <p style={{ fontSize: 'var(--font-size-sm)', color: 'var(--text-muted)', marginBottom: 'var(--space-2)' }}>
                        Seus dados (da conta):
                    </p>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-1)' }}>
                        <span><strong>👤 Nome:</strong> {user.nome}</span>
                        <span><strong>📱 Telefone:</strong> {user.telefone}</span>
                        <span><strong>🎓 Matrícula:</strong> {user.matricula || 'Não informada'}</span>
                    </div>
                </div>

                <p style={{ color: 'var(--text-secondary)', marginBottom: 'var(--space-4)', fontSize: 'var(--font-size-sm)' }}>
                    O motorista do grupo irá revisar seus dados e aprovar sua entrada.
                </p>

                {error && (
                    <div style={{
                        color: 'var(--error)',
                        fontSize: 'var(--font-size-sm)',
                        marginBottom: 'var(--space-4)',
                        padding: 'var(--space-3)',
                        background: 'var(--error-bg)',
                        borderRadius: 'var(--radius-md)'
                    }}>
                        {error}
                    </div>
                )}

                <button
                    className="btn btn-primary"
                    onClick={handleSubmit}
                    disabled={submitting}
                    style={{ marginBottom: 'var(--space-3)' }}
                >
                    {submitting ? 'Enviando...' : '📋 Solicitar Entrada'}
                </button>

                <p style={{
                    marginTop: 'var(--space-2)',
                    fontSize: 'var(--font-size-sm)',
                    color: 'var(--text-muted)'
                }}>
                    <Link to="/" style={{ color: 'var(--accent-primary)' }}>
                        ← Voltar
                    </Link>
                </p>
            </div>
        </div>
    );
}
