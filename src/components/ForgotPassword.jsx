import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';

const BOT_API_URL = import.meta.env.VITE_SUPABASE_URL ? '' : 'http://localhost:3001'; // Fallback se precisar

export default function ForgotPassword() {
    const [step, setStep] = useState(1); // 1: Telefone, 2: Código + Nova Senha
    const [telefone, setTelefone] = useState('');
    const [codigo, setCodigo] = useState('');
    const [novaSenha, setNovaSenha] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [message, setMessage] = useState('');

    const navigate = useNavigate();

    const handleRequestReset = async (e) => {
        e.preventDefault();
        setLoading(true);
        setError('');
        setMessage('');

        try {
            // Nota: O bot server roda na porta 3001, mas em dev o Vite proxy pode não estar configurado.
            // Assumindo que o bot server está acessível.
            // Para produção, isso deveria passar por uma URL configurada.
            // No .env, EVOLUTION_API_URL é do bot, mas aqui precisamos falar com o nosso server.js (BOT_PORT=3001)

            // Usando path relativo para aproveitar o proxy do Vite (evita CORS)
            const response = await fetch('/api/auth/request-reset', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ telefone })
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error || 'Erro ao solicitar código');
            }

            setMessage(data.message);
            setStep(2);

        } catch (err) {
            setError(err.message || 'Erro ao conectar com o servidor.');
        } finally {
            setLoading(false);
        }
    };

    const handleVerifyReset = async (e) => {
        e.preventDefault();
        setLoading(true);
        setError('');

        try {
            const response = await fetch('/api/auth/reset-password', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ telefone, codigo, novaSenha })
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error || 'Erro ao redefinir senha');
            }

            // Sucesso!
            alert('Senha redefinida com sucesso! Faça login com a nova senha.');
            navigate('/login');

        } catch (err) {
            setError(err.message || 'Erro ao redefinir senha.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="login-container">
            <div className="login-card">
                <h1 className="login-title">
                    🔐 Recuperar Senha
                </h1>

                {step === 1 ? (
                    <form onSubmit={handleRequestReset}>
                        <p style={{ color: 'var(--text-secondary)', marginBottom: 'var(--space-4)', textAlign: 'center' }}>
                            Digite seu telefone para receber um código de verificação no WhatsApp.
                        </p>

                        <div className="form-group">
                            <label className="form-label" htmlFor="telefone">
                                Telefone Cadastrado
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

                        {error && (
                            <div style={{ color: 'var(--error)', marginBottom: 'var(--space-4)', fontSize: 'var(--font-size-sm)' }}>
                                {error}
                            </div>
                        )}

                        <button
                            type="submit"
                            className="btn btn-primary"
                            disabled={loading}
                        >
                            {loading ? 'Enviando...' : 'Enviar Código'}
                        </button>
                    </form>
                ) : (
                    <form onSubmit={handleVerifyReset}>
                        <div style={{
                            background: 'var(--success-bg, #d4edda)',
                            color: 'var(--success, #155724)',
                            padding: 'var(--space-3)',
                            borderRadius: 'var(--radius-md)',
                            marginBottom: 'var(--space-4)',
                            fontSize: 'var(--font-size-sm)'
                        }}>
                            {message}
                        </div>

                        <div className="form-group">
                            <label className="form-label" htmlFor="codigo">
                                Código de 6 dígitos
                            </label>
                            <input
                                id="codigo"
                                type="text"
                                className="form-input"
                                placeholder="000000"
                                value={codigo}
                                onChange={(e) => setCodigo(e.target.value)}
                                maxLength={6}
                                required
                            />
                        </div>

                        <div className="form-group">
                            <label className="form-label" htmlFor="novaSenha">
                                Nova Senha
                            </label>
                            <input
                                id="novaSenha"
                                type="password"
                                className="form-input"
                                placeholder="Sua nova senha"
                                value={novaSenha}
                                onChange={(e) => setNovaSenha(e.target.value)}
                                required
                            />
                        </div>

                        {error && (
                            <div style={{ color: 'var(--error)', marginBottom: 'var(--space-4)', fontSize: 'var(--font-size-sm)' }}>
                                {error}
                            </div>
                        )}

                        <button
                            type="submit"
                            className="btn btn-primary"
                            disabled={loading}
                        >
                            {loading ? 'Redefinir Senha' : 'Confirmar e Alterar'}
                        </button>

                        <button
                            type="button"
                            className="btn btn-secondary"
                            onClick={() => setStep(1)}
                            style={{ marginTop: 'var(--space-2)' }}
                            disabled={loading}
                        >
                            Voltar
                        </button>
                    </form>
                )}

                <div style={{ textAlign: 'center', marginTop: 'var(--space-4)' }}>
                    <Link to="/login" style={{ color: 'var(--accent-primary)', fontSize: 'var(--font-size-sm)' }}>
                        ← Voltar para Login
                    </Link>
                </div>
            </div>
        </div>
    );
}
