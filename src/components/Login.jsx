import { useState } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { supabase } from '../lib/supabase.js';
import { useAuth } from '../contexts/AuthContext.jsx';

/**
 * Componente de Login
 * Autentica contra a tabela `usuarios` (não `membros`)
 * Após login, carrega memberships separadamente
 */
export default function Login() {
    const [telefone, setTelefone] = useState('');
    const [senha, setSenha] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    const navigate = useNavigate();
    const location = useLocation();
    const { login } = useAuth();

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        setError('');

        try {
            const telefoneNormalizado = telefone.replace(/\D/g, '');

            // Gerar variantes do telefone para busca flexível
            const variantes = [telefoneNormalizado];
            if (!telefoneNormalizado.startsWith('55')) {
                variantes.push('55' + telefoneNormalizado);
            }
            if (telefoneNormalizado.startsWith('55') && telefoneNormalizado.length > 2) {
                variantes.push(telefoneNormalizado.substring(2));
            }

            // 1. Buscar usuário na tabela `usuarios`
            const { data: usuario, error: userError } = await supabase
                .from('usuarios')
                .select('*')
                .in('telefone', variantes)
                .limit(1)
                .single();

            if (userError || !usuario) {
                throw new Error('Telefone não encontrado. Verifique se digitou corretamente ou cadastre-se.');
            }

            // 2. Verificar senha
            if (usuario.senha_hash !== senha) {
                throw new Error('Senha incorreta.');
            }

            // 3. Carregar memberships (grupos do usuário)
            const { data: memberships } = await supabase
                .from('membros')
                .select('*, grupos(*)')
                .eq('usuario_id', usuario.id)
                .eq('ativo', true);

            // 4. Fazer login via contexto
            login(usuario, memberships || []);

            // 5. Redirecionar
            const redirectTo = location.state?.from?.pathname;
            if (redirectTo) {
                navigate(redirectTo);
            } else if (memberships && memberships.length > 0) {
                // Tem grupo — ir pro dashboard do primeiro grupo aprovado
                const aprovado = memberships.find(m => m.status_aprovacao === 'aprovado');
                if (aprovado) {
                    const path = aprovado.is_motorista
                        ? `/admin/${aprovado.grupo_id}`
                        : `/g/${aprovado.grupo_id}`;
                    navigate(path);
                } else {
                    // Só tem pendentes — ir pra lista de grupos
                    navigate('/grupos');
                }
            } else {
                // Sem grupo — ir pra lista de grupos
                navigate('/grupos');
            }

        } catch (err) {
            setError(err.message || 'Erro ao fazer login.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="login-container">
            <div className="login-card">
                <h1 className="login-title">
                    🚗 Cajurona
                    <br />
                    <span style={{ fontSize: '1rem', fontWeight: 400, color: 'var(--text-secondary)' }}>
                        Entrar na sua conta
                    </span>
                </h1>

                <form onSubmit={handleSubmit}>
                    <div className="form-group">
                        <label className="form-label" htmlFor="telefone">
                            Telefone
                        </label>
                        <input
                            id="telefone"
                            type="tel"
                            className="form-input"
                            placeholder="(00) 00000-0000"
                            value={telefone}
                            onChange={(e) => setTelefone(e.target.value)}
                            required
                        />
                    </div>

                    <div className="form-group">
                        <label className="form-label" htmlFor="senha">
                            Senha
                        </label>
                        <input
                            id="senha"
                            type="password"
                            className="form-input"
                            placeholder="Sua senha"
                            value={senha}
                            onChange={(e) => setSenha(e.target.value)}
                            required
                        />
                    </div>

                    {error && (
                        <div style={{
                            background: 'var(--error-bg)',
                            color: 'var(--error)',
                            padding: 'var(--space-3)',
                            borderRadius: 'var(--radius-md)',
                            marginBottom: 'var(--space-4)',
                            fontSize: 'var(--font-size-sm)'
                        }}>
                            {error}
                        </div>
                    )}

                    <button
                        type="submit"
                        className="btn btn-primary"
                        disabled={loading}
                    >
                        {loading ? 'Entrando...' : 'Entrar'}
                    </button>
                </form>

                <p style={{
                    marginTop: 'var(--space-4)',
                    fontSize: 'var(--font-size-sm)',
                    color: 'var(--text-muted)',
                    textAlign: 'center'
                }}>
                    Não tem uma conta?{' '}
                    <Link to="/cadastro" style={{ color: 'var(--accent-primary)' }}>
                        Cadastre-se
                    </Link>
                </p>
            </div>
        </div>
    );
}
