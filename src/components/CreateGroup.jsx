import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase.js';

/**
 * Componente para criar um novo grupo de caronas
 */
function CreateGroup() {
    const navigate = useNavigate();
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [formData, setFormData] = useState({
        nome: '',
        horarioIda: '07:00',
        horarioVolta: '18:00',
        valorSemanal: '',
        motoristaNome: '',
        motoristaTelefone: ''
    });

    const handleChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        setError('');

        try {
            // 1. Criar o grupo
            const { data: grupo, error: grupoError } = await supabase
                .from('grupos')
                .insert({
                    nome: formData.nome,
                    horario_ida: formData.horarioIda,
                    horario_volta: formData.horarioVolta,
                    valor_semanal: parseFloat(formData.valorSemanal) || 0
                })
                .select()
                .single();

            if (grupoError) throw grupoError;

            // 2. Criar o motorista como primeiro membro
            const { error: membroError } = await supabase
                .from('membros')
                .insert({
                    grupo_id: grupo.id,
                    nome: formData.motoristaNome,
                    telefone: formData.motoristaTelefone.replace(/\D/g, ''),
                    is_motorista: true,
                    ativo: true,
                    dias_padrao: ['seg', 'ter', 'qua', 'qui', 'sex']
                });

            if (membroError) throw membroError;

            // 3. Atualizar o grupo com o motorista_id (opcional, se precisar)
            // Pode ser feito depois se necessário

            // 4. Redirecionar para o dashboard do grupo criado
            navigate(`/g/${grupo.id}`);

        } catch (err) {
            console.error('Erro ao criar grupo:', err);
            setError(err.message || 'Erro ao criar grupo. Verifique os dados.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="login-container">
            <div className="login-card">
                <h1 className="login-title">
                    🚗 Criar Grupo
                </h1>

                <form onSubmit={handleSubmit}>
                    <div className="form-group">
                        <label className="form-label">Nome do Grupo</label>
                        <input
                            type="text"
                            name="nome"
                            className="form-input"
                            placeholder="Ex: Carona UFMG Engenharia"
                            value={formData.nome}
                            onChange={handleChange}
                            required
                        />
                    </div>

                    <div className="form-group">
                        <label className="form-label">Seu Nome (Motorista)</label>
                        <input
                            type="text"
                            name="motoristaNome"
                            className="form-input"
                            placeholder="Ex: João Silva"
                            value={formData.motoristaNome}
                            onChange={handleChange}
                            required
                        />
                    </div>

                    <div className="form-group">
                        <label className="form-label">Seu Telefone</label>
                        <input
                            type="tel"
                            name="motoristaTelefone"
                            className="form-input"
                            placeholder="Ex: 31999998888"
                            value={formData.motoristaTelefone}
                            onChange={handleChange}
                            required
                        />
                    </div>

                    <div style={{ display: 'flex', gap: 'var(--space-3)' }}>
                        <div className="form-group" style={{ flex: 1 }}>
                            <label className="form-label">Horário Ida</label>
                            <input
                                type="time"
                                name="horarioIda"
                                className="form-input"
                                value={formData.horarioIda}
                                onChange={handleChange}
                            />
                        </div>

                        <div className="form-group" style={{ flex: 1 }}>
                            <label className="form-label">Horário Volta</label>
                            <input
                                type="time"
                                name="horarioVolta"
                                className="form-input"
                                value={formData.horarioVolta}
                                onChange={handleChange}
                            />
                        </div>
                    </div>

                    <div className="form-group">
                        <label className="form-label">Valor Semanal (R$)</label>
                        <input
                            type="number"
                            name="valorSemanal"
                            className="form-input"
                            placeholder="Ex: 50"
                            step="0.01"
                            min="0"
                            value={formData.valorSemanal}
                            onChange={handleChange}
                        />
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
                        disabled={loading}
                    >
                        {loading ? 'Criando...' : '✨ Criar Grupo'}
                    </button>
                </form>

                <p style={{
                    marginTop: 'var(--space-4)',
                    fontSize: 'var(--font-size-sm)',
                    color: 'var(--text-muted)',
                    textAlign: 'center'
                }}>
                    Após criar, você receberá um link para compartilhar com o grupo.
                </p>
            </div>
        </div>
    );
}

export default CreateGroup;
