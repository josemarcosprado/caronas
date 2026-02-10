import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase.js';
import { validatePhone } from '../lib/phoneUtils.js';
import PhoneInput from './PhoneInput.jsx';
import { useAuth } from '../contexts/AuthContext.jsx';

/**
 * Componente para criar um novo grupo de caronas
 */
function CreateGroup() {
    const navigate = useNavigate();
    const { login } = useAuth();
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [grupoCriado, setGrupoCriado] = useState(null);
    const [formData, setFormData] = useState({
        nome: '',
        horarioIda: '07:00',
        horarioVolta: '18:00',
        modeloPrecificacao: 'semanal',
        valorSemanal: '',
        valorTrajeto: '',
        tempoLimiteCancelamento: '30',
        motoristaNome: '',
        motoristaTelefone: '',
        motoristaSenha: ''
    });

    const handleChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        setError('');

        // Validate phone before submitting
        const phoneValidation = validatePhone(formData.motoristaTelefone);
        if (!phoneValidation.valid) {
            setError(`Telefone inválido: ${phoneValidation.error}`);
            setLoading(false);
            return;
        }

        // Validate password
        if (!formData.motoristaSenha || formData.motoristaSenha.length < 4) {
            setError('A senha deve ter pelo menos 4 caracteres.');
            setLoading(false);
            return;
        }

        try {
            // 1. Criar o grupo
            const { data: grupo, error: grupoError } = await supabase
                .from('grupos')
                .insert({
                    nome: formData.nome,
                    horario_ida: formData.horarioIda,
                    horario_volta: formData.horarioVolta,
                    modelo_precificacao: formData.modeloPrecificacao,
                    valor_semanal: formData.modeloPrecificacao === 'semanal'
                        ? parseFloat(formData.valorSemanal) || 0
                        : 0,
                    valor_trajeto: formData.modeloPrecificacao === 'por_trajeto'
                        ? parseFloat(formData.valorTrajeto) || 0
                        : 0,
                    tempo_limite_cancelamento: parseInt(formData.tempoLimiteCancelamento) || 30
                })
                .select()
                .single();

            if (grupoError) throw grupoError;

            // 2. Criar o motorista como primeiro membro
            const { data: membro, error: membroError } = await supabase
                .from('membros')
                .insert({
                    grupo_id: grupo.id,
                    nome: formData.motoristaNome,
                    telefone: phoneValidation.normalized.replace('+', ''), // Store without + for consistency
                    is_motorista: true,
                    ativo: true,
                    dias_padrao: ['seg', 'ter', 'qua', 'qui', 'sex'],
                    senha_hash: formData.motoristaSenha // TODO: usar hash real em produção
                })
                .select()
                .single();

            if (membroError) throw membroError;

            // 3. Atualizar grupo com motorista_id
            const { error: updateError } = await supabase
                .from('grupos')
                .update({ motorista_id: membro.id })
                .eq('id', grupo.id);

            if (updateError) console.error('Erro ao atualizar motorista_id:', updateError);

            // 4. Criar viagens da semana
            await criarViagensSemana(grupo.id, formData.horarioIda, formData.horarioVolta);

            // 5. Fazer login automático do motorista
            login({ ...membro, grupo_id: grupo.id }, 'motorista');

            // 6. Salvar dados para tela de sucesso
            setGrupoCriado({
                id: grupo.id,
                nome: grupo.nome,
                link: `${window.location.origin}/g/${grupo.id}`,
                adminLink: `${window.location.origin}/admin/${grupo.id}`
            });

        } catch (err) {
            console.error('Erro ao criar grupo:', err);
            setError(err.message || 'Erro ao criar grupo. Verifique os dados.');
        } finally {
            setLoading(false);
        }
    };

    // Função para criar viagens da semana
    const criarViagensSemana = async (grupoId, horarioIda, horarioVolta) => {
        const hoje = new Date();
        const diaSemana = hoje.getDay(); // 0=dom, 1=seg, ...
        const viagens = [];

        // Criar viagens para seg-sex desta semana (ou próxima se já passou)
        for (let dow = 1; dow <= 5; dow++) {
            let diff = dow - diaSemana;
            if (diff < 0) diff += 7; // Próxima semana se já passou

            const data = new Date(hoje);
            data.setDate(hoje.getDate() + diff);
            const dataStr = data.toISOString().split('T')[0];

            // Viagem de ida
            viagens.push({
                grupo_id: grupoId,
                data: dataStr,
                tipo: 'ida',
                horario_partida: horarioIda,
                status: 'agendada'
            });

            // Viagem de volta
            viagens.push({
                grupo_id: grupoId,
                data: dataStr,
                tipo: 'volta',
                horario_partida: horarioVolta,
                status: 'agendada'
            });
        }

        const { error } = await supabase.from('viagens').insert(viagens);
        if (error) console.error('Erro ao criar viagens:', error);
    };

    const copiarLink = () => {
        navigator.clipboard.writeText(grupoCriado.link);
        alert('Link copiado!');
    };

    const isPorTrajeto = formData.modeloPrecificacao === 'por_trajeto';

    // Tela de sucesso após criar grupo
    if (grupoCriado) {
        return (
            <div className="login-container">
                <div className="login-card" style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: '4rem', marginBottom: 'var(--space-4)' }}>🎉</div>
                    <h1 style={{ fontSize: 'var(--font-size-2xl)', marginBottom: 'var(--space-2)' }}>
                        Grupo Criado!
                    </h1>
                    <p style={{ color: 'var(--text-secondary)', marginBottom: 'var(--space-6)' }}>
                        <strong>{grupoCriado.nome}</strong> está pronto para uso.
                    </p>

                    <div style={{
                        background: 'var(--bg-secondary)',
                        padding: 'var(--space-3)',
                        borderRadius: 'var(--radius-md)',
                        marginBottom: 'var(--space-4)',
                        wordBreak: 'break-all',
                        fontSize: 'var(--font-size-sm)'
                    }}>
                        {grupoCriado.link}
                    </div>

                    <div style={{ display: 'flex', gap: 'var(--space-3)', marginBottom: 'var(--space-4)' }}>
                        <button
                            className="btn btn-secondary"
                            style={{ flex: 1 }}
                            onClick={copiarLink}
                        >
                            📋 Copiar Link
                        </button>
                        <button
                            className="btn btn-primary"
                            style={{ flex: 1 }}
                            onClick={() => navigate(`/admin/${grupoCriado.id}`)}
                        >
                            📊 Gerenciar Grupo
                        </button>
                    </div>

                    <p style={{
                        fontSize: 'var(--font-size-sm)',
                        color: 'var(--text-muted)'
                    }}>
                        Compartilhe este link com os membros do grupo.
                    </p>
                </div>
            </div>
        );
    }

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
                            placeholder="Ex: Carona UFS Computação"
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
                        <PhoneInput
                            value={formData.motoristaTelefone}
                            onChange={(value) => setFormData(prev => ({ ...prev, motoristaTelefone: value }))}
                            placeholder="+55 79 99999-9999"
                            required
                        />
                        <small style={{ color: 'var(--text-muted)', fontSize: 'var(--font-size-xs)' }}>
                            Inclua o código do país (ex: +55 para Brasil)
                        </small>
                    </div>

                    <div className="form-group">
                        <label className="form-label">Sua Senha</label>
                        <input
                            type="password"
                            name="motoristaSenha"
                            className="form-input"
                            placeholder="Mínimo 4 caracteres"
                            value={formData.motoristaSenha}
                            onChange={handleChange}
                            required
                            minLength={4}
                        />
                        <small style={{ color: 'var(--text-muted)', fontSize: 'var(--font-size-xs)' }}>
                            Use esta senha para acessar o painel de administração
                        </small>
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

                    {/* Modelo de Precificação */}
                    <div className="form-group">
                        <label className="form-label">Modelo de Cobrança</label>
                        <select
                            name="modeloPrecificacao"
                            className="form-input"
                            value={formData.modeloPrecificacao}
                            onChange={handleChange}
                        >
                            <option value="semanal">Valor Semanal (rateado)</option>
                            <option value="por_trajeto">Por Trajeto (débito automático)</option>
                        </select>
                    </div>

                    {isPorTrajeto ? (
                        <>
                            <div className="form-group">
                                <label className="form-label">Valor por Trajeto (R$)</label>
                                <input
                                    type="number"
                                    name="valorTrajeto"
                                    className="form-input"
                                    placeholder="Ex: 5 (cobrado por ida E volta)"
                                    step="0.01"
                                    min="0"
                                    value={formData.valorTrajeto}
                                    onChange={handleChange}
                                />
                                <small style={{ color: 'var(--text-muted)', fontSize: 'var(--font-size-xs)' }}>
                                    Débito gerado ao confirmar presença (ida e volta separados)
                                </small>
                            </div>

                            <div className="form-group">
                                <label className="form-label">Tempo limite para cancelar (minutos)</label>
                                <input
                                    type="number"
                                    name="tempoLimiteCancelamento"
                                    className="form-input"
                                    placeholder="30"
                                    min="0"
                                    max="180"
                                    value={formData.tempoLimiteCancelamento}
                                    onChange={handleChange}
                                />
                                <small style={{ color: 'var(--text-muted)', fontSize: 'var(--font-size-xs)' }}>
                                    Minutos antes do horário. Após, só motorista pode cancelar.
                                </small>
                            </div>
                        </>
                    ) : (
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
                            <small style={{ color: 'var(--text-muted)', fontSize: 'var(--font-size-xs)' }}>
                                Dividido entre os confirmados no fim da semana
                            </small>
                        </div>
                    )}

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
