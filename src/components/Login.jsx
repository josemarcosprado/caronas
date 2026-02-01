import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase.js';

export default function Login() {
    const [telefone, setTelefone] = useState('');
    const [senha, setSenha] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const navigate = useNavigate();

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        setError('');

        try {
            // Buscar membro motorista pelo telefone
            const { data: membro, error: membroError } = await supabase
                .from('membros')
                .select('*, grupos(*)')
                .eq('telefone', telefone.replace(/\D/g, ''))
                .eq('is_motorista', true)
                .single();

            if (membroError || !membro) {
                throw new Error('Telefone não encontrado ou não é motorista.');
            }

            // Verificar senha (em produção, usar bcrypt no servidor)
            // Por simplicidade no MVP, usamos comparação direta
            // TODO: Implementar hash de senha no backend
            if (membro.senha_hash !== senha) {
                throw new Error('Senha incorreta.');
            }

            // Criar sessão com Supabase Auth
            // Nota: Como estamos usando senha simples, vamos apenas
            // salvar no localStorage por enquanto
            localStorage.setItem('cajurona_admin', JSON.stringify({
                membroId: membro.id,
                grupoId: membro.grupo_id,
                nome: membro.nome
            }));

            // Redirecionar para dashboard admin
            navigate(`/admin/${membro.grupo_id}`);

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
            </div>
        </div>
    );
}
