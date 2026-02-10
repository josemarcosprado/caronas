import { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { supabase } from '../lib/supabase.js';
import { useAuth } from '../contexts/AuthContext.jsx';

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
            
            // Se NÃO começa com 55, adicionar variante com 55
            if (!telefoneNormalizado.startsWith('55')) {
                variantes.push('55' + telefoneNormalizado);
            }
            // Se começa com 55, adicionar variante sem 55
            if (telefoneNormalizado.startsWith('55') && telefoneNormalizado.length > 2) {
                variantes.push(telefoneNormalizado.substring(2));
            }

            console.log('Tentando login com variantes:', variantes);

            // Buscar membro com qualquer uma das variantes do telefone
            const { data: todos, error: todosError } = await supabase
                .from('membros')
                .select('id, telefone, is_motorista, nome')
                .in('telefone', variantes);

            console.log('Resultado busca por telefone:', { todos, todosError });

            if (todosError) {
                console.error('Erro na query:', todosError);
                throw new Error('Erro ao acessar o banco de dados.');
            }

            if (!todos || todos.length === 0) {
                throw new Error('Telefone não encontrado. Verifique se digitou corretamente.');
            }

            const membroEncontrado = todos.find(m => m.is_motorista);
            if (!membroEncontrado) {
                throw new Error('Este telefone não pertence a um motorista.');
            }

            // Buscar dados completos do motorista
            const { data: membro, error: membroError } = await supabase
                .from('membros')
                .select('*')
                .eq('id', membroEncontrado.id)
                .single();

            console.log('Busca membro completo:', { membro, membroError });

            if (membroError || !membro) {
                console.error('Erro busca membro:', membroError);
                throw new Error('Erro ao carregar dados do motorista.');
            }

            // Buscar grupo separadamente
            const { data: grupoData, error: grupoError } = await supabase
                .from('grupos')
                .select('*')
                .eq('id', membro.grupo_id)
                .single();

            console.log('Busca grupo:', { grupoData, grupoError });

            // Anexar grupo ao membro (não bloqueia login se grupo falhar)
            membro.grupos = grupoData || null;

            // Verificar senha
            if (membro.senha_hash !== senha) {
                throw new Error('Senha incorreta.');
            }

            // Salvar sessão via contexto
            login(membro, 'motorista');

            // Redirecionar para dashboard admin
            const from = location.state?.from?.pathname || `/admin/${membro.grupo_id}`;
            navigate(from);

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
                        Área do Motorista
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
                    <a href="/criar" style={{ color: 'var(--accent-primary)' }}>
                        Criar novo grupo
                    </a>
                </p>
            </div>
        </div>
    );
}
