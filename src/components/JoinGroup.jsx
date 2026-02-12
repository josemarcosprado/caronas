import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { supabase } from '../lib/supabase.js';
import { validatePhone } from '../lib/phoneUtils.js';
import PhoneInput from './PhoneInput.jsx';

/**
 * Componente para passageiros entrarem em um grupo existente
 * Rota: /entrar/:grupoId
 */
export default function JoinGroup() {
    const { grupoId } = useParams();
    const navigate = useNavigate();

    const [grupo, setGrupo] = useState(null);
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState('');
    const [sucesso, setSucesso] = useState(false);

    const [nome, setNome] = useState('');
    const [telefone, setTelefone] = useState('');
    const [matricula, setMatricula] = useState('');

    // Carregar dados do grupo
    useEffect(() => {
        const loadGrupo = async () => {
            try {
                const { data, error } = await supabase
                    .from('grupos')
                    .select('id, nome')
                    .eq('id', grupoId)
                    .single();

                if (error) throw error;
                setGrupo(data);
            } catch (err) {
                console.error('Erro ao carregar grupo:', err);
                setError('Grupo não encontrado.');
            } finally {
                setLoading(false);
            }
        };
        loadGrupo();
    }, [grupoId]);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setSubmitting(true);
        setError('');

        // Validar telefone
        const phoneValidation = validatePhone(telefone);
        if (!phoneValidation.valid) {
            setError(`Telefone inválido: ${phoneValidation.error}`);
            setSubmitting(false);
            return;
        }

        // Validar matrícula
        if (!matricula.trim()) {
            setError('É obrigatório informar o número de matrícula.');
            setSubmitting(false);
            return;
        }

        try {
            // Criar membro (passageiro pendente)
            const { error: membroError } = await supabase
                .from('membros')
                .insert({
                    grupo_id: grupoId,
                    nome: nome.trim(),
                    telefone: phoneValidation.normalized.replace('+', ''),
                    is_motorista: false,
                    ativo: true,
                    dias_padrao: ['seg', 'ter', 'qua', 'qui', 'sex'],
                    matricula: matricula.trim(),
                    status_aprovacao: 'pendente'
                });

            if (membroError) {
                if (membroError.message.includes('membros_telefone_key')) {
                    throw new Error('Este telefone já está cadastrado em um grupo.');
                }
                throw membroError;
            }

            setSucesso(true);
        } catch (err) {
            console.error('Erro ao entrar no grupo:', err);
            setError(err.message || 'Erro ao processar cadastro.');
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
                            Sua matrícula está sendo verificada. Você poderá usar
                            o grupo assim que o motorista aprovar seu cadastro.
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

    return (
        <div className="login-container">
            <div className="login-card">
                <h1 className="login-title">
                    🚗 Entrar no Grupo
                    <br />
                    <span style={{ fontSize: '1rem', fontWeight: 400, color: 'var(--text-secondary)' }}>
                        {grupo.nome}
                    </span>
                </h1>

                <form onSubmit={handleSubmit}>
                    <div className="form-group">
                        <label className="form-label">Seu Nome</label>
                        <input
                            type="text"
                            className="form-input"
                            placeholder="Ex: Maria Silva"
                            value={nome}
                            onChange={e => setNome(e.target.value)}
                            required
                        />
                    </div>

                    <div className="form-group">
                        <label className="form-label">Seu Telefone</label>
                        <PhoneInput
                            value={telefone}
                            onChange={setTelefone}
                            placeholder="+55 79 99999-9999"
                            required
                        />
                        <small style={{ color: 'var(--text-muted)', fontSize: 'var(--font-size-xs)' }}>
                            Inclua o código do país (ex: +55 para Brasil)
                        </small>
                    </div>

                    {/* Número de Matrícula */}
                    <div className="form-group">
                        <label className="form-label">Número de Matrícula (obrigatório)</label>
                        <input
                            type="text"
                            className="form-input"
                            placeholder="Ex: 202100012345"
                            value={matricula}
                            onChange={e => setMatricula(e.target.value)}
                            required
                        />
                        <small style={{ color: 'var(--text-muted)', fontSize: 'var(--font-size-xs)' }}>
                            Digite o número de matrícula da sua instituição
                        </small>
                    </div>

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
                        type="submit"
                        className="btn btn-primary"
                        disabled={submitting}
                    >
                        {submitting ? 'Enviando...' : '📋 Solicitar Entrada'}
                    </button>
                </form>

                <p style={{
                    marginTop: 'var(--space-4)',
                    fontSize: 'var(--font-size-sm)',
                    color: 'var(--text-muted)',
                    textAlign: 'center'
                }}>
                    Sua matrícula será verificada antes da aprovação.
                </p>
            </div>
        </div>
    );
}
