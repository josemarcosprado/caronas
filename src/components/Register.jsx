import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { supabase } from '../lib/supabase.js';
import { validatePhone } from '../lib/phoneUtils.js';
import PhoneInput from './PhoneInput.jsx';

/**
 * Componente de cadastro de usuário
 * Cria conta na tabela `usuarios` (independente de grupo)
 * Matrícula obrigatória, CNH facultativa
 */
export default function Register() {
    const navigate = useNavigate();
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [sucesso, setSucesso] = useState(false);
    const [cnhFile, setCnhFile] = useState(null);
    const [cnhPreview, setCnhPreview] = useState(null);
    const [formData, setFormData] = useState({
        nome: '',
        telefone: '',
        senha: '',
        confirmarSenha: '',
        matricula: '',
        bairro: ''
    });

    const handleChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const handleCnhChange = (e) => {
        const file = e.target.files[0];
        if (file) {
            if (file.size > 5 * 1024 * 1024) {
                setError('A imagem da CNH deve ter no máximo 5MB.');
                return;
            }
            if (!file.type.startsWith('image/')) {
                setError('O arquivo deve ser uma imagem (JPG, PNG, etc).');
                return;
            }
            setCnhFile(file);
            setCnhPreview(URL.createObjectURL(file));
            setError('');
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        setError('');

        // Validações
        const phoneValidation = validatePhone(formData.telefone);
        if (!phoneValidation.valid) {
            setError(`Telefone inválido: ${phoneValidation.error}`);
            setLoading(false);
            return;
        }

        if (!formData.senha || formData.senha.length < 4) {
            setError('A senha deve ter pelo menos 4 caracteres.');
            setLoading(false);
            return;
        }

        if (formData.senha !== formData.confirmarSenha) {
            setError('As senhas não coincidem.');
            setLoading(false);
            return;
        }

        if (!formData.matricula.trim()) {
            setError('O número de matrícula é obrigatório.');
            setLoading(false);
            return;
        }

        if (!formData.bairro.trim()) {
            setError('O nome do bairro é obrigatório.');
            setLoading(false);
            return;
        }

        try {
            const telefoneNormalizado = phoneValidation.normalized.replace('+', '');

            // Upload da CNH se fornecida
            let cnhUrl = null;
            if (cnhFile) {
                const cnhFileName = `user_${telefoneNormalizado}_${Date.now()}.${cnhFile.name.split('.').pop()}`;
                const { error: uploadError } = await supabase.storage
                    .from('cnh-uploads')
                    .upload(cnhFileName, cnhFile, {
                        cacheControl: '3600',
                        upsert: false
                    });

                if (uploadError) throw new Error('Erro ao enviar foto da CNH: ' + uploadError.message);

                const { data: urlData } = supabase.storage
                    .from('cnh-uploads')
                    .getPublicUrl(cnhFileName);
                cnhUrl = urlData.publicUrl;
            }

            // Criar usuário
            const { error: userError } = await supabase
                .from('usuarios')
                .insert({
                    nome: formData.nome.trim(),
                    telefone: telefoneNormalizado,
                    senha_hash: formData.senha,
                    matricula: formData.matricula.trim(),
                    matricula_status: 'pendente',
                    bairro: formData.bairro.trim().toLowerCase(),
                    cnh_url: cnhUrl,
                    cnh_status: cnhUrl ? 'pendente' : 'nao_enviada',
                    pode_ser_motorista: false
                });

            if (userError) {
                if (userError.message.includes('usuarios_telefone_key') || userError.message.includes('duplicate')) {
                    throw new Error('Este telefone já está cadastrado. Tente fazer login.');
                }
                throw userError;
            }

            setSucesso(true);
        } catch (err) {
            console.error('Erro ao cadastrar:', err);
            setError(err.message || 'Erro ao criar conta.');
        } finally {
            setLoading(false);
        }
    };

    // Tela de sucesso
    if (sucesso) {
        return (
            <div className="login-container">
                <div className="login-card" style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: '4rem', marginBottom: 'var(--space-4)' }}>✅</div>
                    <h1 style={{ fontSize: 'var(--font-size-2xl)', marginBottom: 'var(--space-2)' }}>
                        Conta Criada!
                    </h1>
                    <p style={{ color: 'var(--text-secondary)', marginBottom: 'var(--space-4)' }}>
                        Sua conta foi criada com sucesso.
                    </p>

                    <div style={{
                        background: 'var(--info-bg, #dbeafe)',
                        color: 'var(--info, #1e40af)',
                        padding: 'var(--space-4)',
                        borderRadius: 'var(--radius-md)',
                        marginBottom: 'var(--space-4)',
                        fontSize: 'var(--font-size-sm)'
                    }}>
                        <strong>📋 Verificação em andamento</strong>
                        <p style={{ marginTop: 'var(--space-2)', marginBottom: 0 }}>
                            Sua matrícula{cnhFile ? ' e CNH' : ''} foram enviadas para verificação.
                            Você já pode fazer login e explorar os grupos disponíveis.
                        </p>
                    </div>

                    <button
                        className="btn btn-primary"
                        onClick={() => navigate('/login')}
                    >
                        🔑 Fazer Login
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="login-container">
            <div className="login-card">
                <h1 className="login-title">
                    🚗 Cajurona
                    <br />
                    <span style={{ fontSize: '1rem', fontWeight: 400, color: 'var(--text-secondary)' }}>
                        Criar Conta
                    </span>
                </h1>

                <form onSubmit={handleSubmit}>
                    {/* Nome */}
                    <div className="form-group">
                        <label className="form-label">Seu Nome</label>
                        <input
                            type="text"
                            name="nome"
                            className="form-input"
                            placeholder="Ex: João Silva"
                            value={formData.nome}
                            onChange={handleChange}
                            required
                        />
                    </div>

                    {/* Telefone */}
                    <div className="form-group">
                        <label className="form-label">Telefone</label>
                        <PhoneInput
                            value={formData.telefone}
                            onChange={(val) => setFormData(prev => ({ ...prev, telefone: val }))}
                            placeholder="+55 79 99999-9999"
                            required
                        />
                    </div>

                    {/* Matrícula (obrigatória) */}
                    <div className="form-group">
                        <label className="form-label">Número de Matrícula *</label>
                        <input
                            type="text"
                            name="matricula"
                            className="form-input"
                            placeholder="Ex: 202100012345"
                            value={formData.matricula}
                            onChange={handleChange}
                            required
                        />
                        <small style={{ color: 'var(--text-muted)', fontSize: 'var(--font-size-xs)' }}>
                            Matrícula da sua instituição de ensino
                        </small>
                    </div>

                    {/* Bairro (obrigatório) */}
                    <div className="form-group">
                        <label className="form-label">Bairro *</label>
                        <input
                            type="text"
                            name="bairro"
                            className="form-input"
                            placeholder="Ex: Centro, Jabotiana, Luzia"
                            value={formData.bairro}
                            onChange={handleChange}
                            required
                        />
                        <small style={{ color: 'var(--text-muted)', fontSize: 'var(--font-size-xs)' }}>
                           Informe o bairro onde você deseja ser pego na carona:
                        </small>
                    </div>

                    {/* Senha */}
                    <div className="form-group">
                        <label className="form-label">Senha</label>
                        <input
                            type="password"
                            name="senha"
                            className="form-input"
                            placeholder="Mínimo 4 caracteres"
                            value={formData.senha}
                            onChange={handleChange}
                            required
                        />
                    </div>

                    {/* Confirmar Senha */}
                    <div className="form-group">
                        <label className="form-label">Confirmar Senha</label>
                        <input
                            type="password"
                            name="confirmarSenha"
                            className="form-input"
                            placeholder="Digite a senha novamente"
                            value={formData.confirmarSenha}
                            onChange={handleChange}
                            required
                        />
                    </div>

                    {/* CNH (opcional) */}
                    <div className="form-group">
                        <label className="form-label">
                            Foto da CNH
                            <span style={{ fontWeight: 400, color: 'var(--text-muted)', marginLeft: 'var(--space-1)' }}>
                                (opcional — necessária para ser motorista)
                            </span>
                        </label>

                        {cnhPreview ? (
                            <div style={{ marginBottom: 'var(--space-2)' }}>
                                <img
                                    src={cnhPreview}
                                    alt="Preview CNH"
                                    style={{
                                        maxWidth: '100%',
                                        maxHeight: '200px',
                                        borderRadius: 'var(--radius-md)',
                                        border: '1px solid var(--border-color)',
                                        objectFit: 'contain'
                                    }}
                                />
                                <button
                                    type="button"
                                    className="btn btn-secondary"
                                    style={{ marginTop: 'var(--space-2)', fontSize: 'var(--font-size-sm)' }}
                                    onClick={() => { setCnhFile(null); setCnhPreview(null); }}
                                >
                                    🗑️ Remover
                                </button>
                            </div>
                        ) : (
                            <input
                                type="file"
                                accept="image/*"
                                onChange={handleCnhChange}
                                className="form-input"
                                style={{ padding: 'var(--space-2)' }}
                            />
                        )}
                        <small style={{ color: 'var(--text-muted)', fontSize: 'var(--font-size-xs)' }}>
                            Envie sua CNH se pretende ser motorista. Máximo 5MB.
                        </small>
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
                        {loading ? 'Cadastrando...' : '📋 Criar Conta'}
                    </button>
                </form>

                <p style={{
                    marginTop: 'var(--space-4)',
                    fontSize: 'var(--font-size-sm)',
                    color: 'var(--text-muted)',
                    textAlign: 'center'
                }}>
                    Já tem uma conta?{' '}
                    <Link to="/login" style={{ color: 'var(--accent-primary)' }}>
                        Fazer login
                    </Link>
                </p>
            </div>
        </div>
    );
}
