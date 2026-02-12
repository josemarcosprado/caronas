import { useState, useEffect } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { supabase } from '../lib/supabase.js';

/**
 * Painel de aprovação do super-admin
 * Gerencia verificação de CNH e matrícula (tabela `usuarios`)
 * Rota: /aprovacoes (protegida por VITE_ADMIN_SECRET)
 */
export default function AdminApproval() {
    const [searchParams] = useSearchParams();
    const adminSecret = searchParams.get('secret');
    const [autenticado, setAutenticado] = useState(false);
    const [pendentes, setPendentes] = useState([]);
    const [loading, setLoading] = useState(true);
    const [imagemExpandida, setImagemExpandida] = useState(null);

    // Verificar senha de admin
    useEffect(() => {
        const expectedSecret = import.meta.env.VITE_ADMIN_SECRET;
        if (adminSecret === expectedSecret) {
            setAutenticado(true);
        }
    }, [adminSecret]);

    // Carregar usuários pendentes
    useEffect(() => {
        if (!autenticado) return;

        const load = async () => {
            try {
                // Buscar usuários com CNH ou matrícula pendente
                const { data, error } = await supabase
                    .from('usuarios')
                    .select('*')
                    .or('matricula_status.eq.pendente,cnh_status.eq.pendente')
                    .order('created_at', { ascending: true });

                if (error) throw error;
                setPendentes(data || []);
            } catch (err) {
                console.error('Erro ao carregar pendentes:', err);
            } finally {
                setLoading(false);
            }
        };
        load();
    }, [autenticado]);

    const atualizarStatus = async (usuarioId, campo, novoStatus) => {
        const acao = novoStatus === 'aprovado' ? 'aprovar' : 'rejeitar';
        const item = campo === 'cnh_status' ? 'CNH' : 'matrícula';
        if (!confirm(`Tem certeza que deseja ${acao} a ${item} deste usuário?`)) return;

        try {
            const updateData = { [campo]: novoStatus };

            // Se aprovando CNH, pode ser motorista
            if (campo === 'cnh_status' && novoStatus === 'aprovado') {
                updateData.pode_ser_motorista = true;
            }

            const { error } = await supabase
                .from('usuarios')
                .update(updateData)
                .eq('id', usuarioId);

            if (error) throw error;

            // Atualizar lista
            setPendentes(prev => prev.map(u => {
                if (u.id === usuarioId) {
                    return { ...u, ...updateData };
                }
                return u;
            }).filter(u => u.matricula_status === 'pendente' || u.cnh_status === 'pendente'));

        } catch (err) {
            alert('Erro ao atualizar: ' + err.message);
        }
    };

    if (!autenticado) {
        return (
            <div className="login-container">
                <div className="login-card" style={{ textAlign: 'center' }}>
                    <h1>🔒 Acesso Restrito</h1>
                    <p style={{ color: 'var(--text-muted)' }}>
                        O painel de aprovações requer autenticação de super-admin.
                    </p>
                    <Link to="/" className="btn btn-secondary" style={{ marginTop: 'var(--space-4)' }}>
                        🏠 Voltar
                    </Link>
                </div>
            </div>
        );
    }

    if (loading) {
        return (
            <div className="login-container">
                <p style={{ color: 'var(--text-muted)' }}>Carregando...</p>
            </div>
        );
    }

    return (
        <div className="container" style={{ maxWidth: '800px', margin: '0 auto', padding: 'var(--space-4)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-4)' }}>
                <h1 style={{ margin: 0 }}>🔑 Aprovações</h1>
                <Link to="/" className="btn btn-secondary" style={{ fontSize: 'var(--font-size-sm)' }}>
                    🏠 Voltar
                </Link>
            </div>

            {pendentes.length === 0 ? (
                <div className="card" style={{ textAlign: 'center', padding: 'var(--space-6)' }}>
                    <div style={{ fontSize: '3rem', marginBottom: 'var(--space-2)' }}>✅</div>
                    <p style={{ color: 'var(--text-muted)' }}>Nenhuma verificação pendente.</p>
                </div>
            ) : (
                <div style={{ display: 'grid', gap: 'var(--space-3)' }}>
                    {pendentes.map(usuario => (
                        <div key={usuario.id} className="card" style={{ padding: 'var(--space-4)' }}>
                            {/* Header */}
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 'var(--space-3)' }}>
                                <div>
                                    <h3 style={{ margin: 0 }}>
                                        👤 {usuario.nome}
                                    </h3>
                                    <small style={{ color: 'var(--text-muted)' }}>
                                        📱 {usuario.telefone}
                                    </small>
                                </div>
                                <small style={{ color: 'var(--text-muted)' }}>
                                    {new Date(usuario.created_at).toLocaleDateString('pt-BR')}
                                </small>
                            </div>

                            {/* Matrícula */}
                            {usuario.matricula_status === 'pendente' && (
                                <div style={{
                                    background: 'var(--bg-secondary)',
                                    padding: 'var(--space-3)',
                                    borderRadius: 'var(--radius-md)',
                                    marginBottom: 'var(--space-3)'
                                }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                        <div>
                                            <strong>🎓 Matrícula</strong>
                                            <p style={{ margin: 'var(--space-1) 0 0', fontSize: 'var(--font-size-sm)', color: 'var(--text-secondary)' }}>
                                                {usuario.matricula || 'Não informada'}
                                            </p>
                                        </div>
                                        <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
                                            <button
                                                className="btn btn-primary"
                                                style={{ padding: '6px 12px', fontSize: 'var(--font-size-sm)' }}
                                                onClick={() => atualizarStatus(usuario.id, 'matricula_status', 'aprovado')}
                                            >
                                                ✅ Aprovar
                                            </button>
                                            <button
                                                className="btn btn-secondary"
                                                style={{ padding: '6px 12px', fontSize: 'var(--font-size-sm)' }}
                                                onClick={() => atualizarStatus(usuario.id, 'matricula_status', 'rejeitado')}
                                            >
                                                ❌ Rejeitar
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* CNH */}
                            {usuario.cnh_status === 'pendente' && usuario.cnh_url && (
                                <div style={{
                                    background: 'var(--bg-secondary)',
                                    padding: 'var(--space-3)',
                                    borderRadius: 'var(--radius-md)'
                                }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                                            <strong>🪪 CNH</strong>
                                            <img
                                                src={usuario.cnh_url}
                                                alt="CNH"
                                                style={{
                                                    width: '60px',
                                                    height: '40px',
                                                    objectFit: 'cover',
                                                    borderRadius: 'var(--radius-sm)',
                                                    border: '1px solid var(--border-color)',
                                                    cursor: 'pointer'
                                                }}
                                                onClick={() => setImagemExpandida(usuario.cnh_url)}
                                            />
                                        </div>
                                        <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
                                            <button
                                                className="btn btn-primary"
                                                style={{ padding: '6px 12px', fontSize: 'var(--font-size-sm)' }}
                                                onClick={() => atualizarStatus(usuario.id, 'cnh_status', 'aprovado')}
                                            >
                                                ✅ Aprovar
                                            </button>
                                            <button
                                                className="btn btn-secondary"
                                                style={{ padding: '6px 12px', fontSize: 'var(--font-size-sm)' }}
                                                onClick={() => atualizarStatus(usuario.id, 'cnh_status', 'rejeitado')}
                                            >
                                                ❌ Rejeitar
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            )}

            {/* Modal de imagem expandida */}
            {imagemExpandida && (
                <div
                    style={{
                        position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
                        background: 'rgba(0,0,0,0.8)', display: 'flex',
                        alignItems: 'center', justifyContent: 'center', zIndex: 1000,
                        cursor: 'pointer'
                    }}
                    onClick={() => setImagemExpandida(null)}
                >
                    <img
                        src={imagemExpandida}
                        alt="CNH expandida"
                        style={{ maxWidth: '90vw', maxHeight: '90vh', borderRadius: 'var(--radius-md)' }}
                    />
                </div>
            )}
        </div>
    );
}
