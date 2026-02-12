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
    const [cnhFile, setCnhFile] = useState(null);
    const [cnhPreview, setCnhPreview] = useState(null);
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
        motoristaSenha: '',
        matricula: ''
    });

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

        // Validate CNH
        if (!cnhFile) {
            setError('É obrigatório enviar uma foto da CNH para verificação.');
            setLoading(false);
            return;
        }

        // Validate matrícula
        if (!formData.matricula || !formData.matricula.trim()) {
            setError('É obrigatório informar o número de matrícula.');
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

            // 2. Upload da CNH para o Supabase Storage
            const cnhFileName = `${grupo.id}_${Date.now()}.${cnhFile.name.split('.').pop()}`;
            const { data: uploadData, error: uploadError } = await supabase.storage
                .from('cnh-uploads')
                .upload(cnhFileName, cnhFile, {
                    cacheControl: '3600',
                    upsert: false
                });

            if (uploadError) throw new Error('Erro ao enviar foto da CNH: ' + uploadError.message);

            // Obter URL pública da CNH
            const { data: urlData } = supabase.storage
                .from('cnh-uploads')
                .getPublicUrl(cnhFileName);

            const cnhUrl = urlData.publicUrl;



            // 4. Criar o motorista como primeiro membro (pendente de aprovação)
            const { data: membro, error: membroError } = await supabase
                .from('membros')
                .insert({
                    grupo_id: grupo.id,
                    nome: formData.motoristaNome,
                    telefone: phoneValidation.normalized.replace('+', ''),
                    is_motorista: true,
                    ativo: true,
                    dias_padrao: ['seg', 'ter', 'qua', 'qui', 'sex'],
                    senha_hash: formData.motoristaSenha,
                    cnh_url: cnhUrl,
                    matricula: formData.matricula.trim(),
                    status_aprovacao: 'pendente'
                })
                .select()
                .single();

            if (membroError) throw membroError;

            // 4. Atualizar grupo com motorista_id
            const { error: updateError } = await supabase
                .from('grupos')
                .update({ motorista_id: membro.id })
                .eq('id', grupo.id);

            if (updateError) console.error('Erro ao atualizar motorista_id:', updateError);

            // 5. Criar viagens da semana
            await criarViagensSemana(grupo.id, formData.horarioIda, formData.horarioVolta);

            // 6. Criar grupo no WhatsApp via bot API
            let inviteLink = null;
            try {
                const botResponse = await fetch('/api/create-whatsapp-group', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ grupoId: grupo.id })
                });

                if (botResponse.ok) {
                    const botData = await botResponse.json();
                    inviteLink = botData.inviteLink;
                } else {
                    console.warn('Aviso: Não foi possível criar grupo no WhatsApp automaticamente.');
                }
            } catch (botErr) {
                console.warn('Aviso: Bot não disponível para criar grupo WhatsApp:', botErr.message);
            }

            // 7. NÃO fazer login automático — conta pendente de aprovação
            setGrupoCriado({
                id: grupo.id,
                nome: grupo.nome,
                pendente: true,
                inviteLink
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
        if (grupoCriado?.inviteLink) {
            navigator.clipboard.writeText(grupoCriado.inviteLink);
            alert('Link copiado!');
        }
    };

    const isPorTrajeto = formData.modeloPrecificacao === 'por_trajeto';

    // Tela de sucesso após criar grupo (pendente de aprovação)
    if (grupoCriado) {
        return (
            <div className="login-container">
                <div className="login-card" style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: '4rem', marginBottom: 'var(--space-4)' }}>✅</div>
                    <h1 style={{ fontSize: 'var(--font-size-2xl)', marginBottom: 'var(--space-2)' }}>
                        Grupo Criado!
                    </h1>
                    <p style={{ color: 'var(--text-secondary)', marginBottom: 'var(--space-4)' }}>
                        <strong>{grupoCriado.nome}</strong> foi criado com sucesso.
                    </p>

                    {grupoCriado.inviteLink && (
                        <div style={{
                            background: 'var(--success-bg, #d1fae5)',
                            color: 'var(--success, #065f46)',
                            padding: 'var(--space-4)',
                            borderRadius: 'var(--radius-md)',
                            marginBottom: 'var(--space-4)',
                            fontSize: 'var(--font-size-sm)'
                        }}>
                            <strong>📱 Grupo WhatsApp criado!</strong>
                            <p style={{ marginTop: 'var(--space-2)', marginBottom: 'var(--space-2)' }}>
                                Compartilhe o link abaixo com os membros:
                            </p>
                            <div style={{
                                background: 'rgba(0,0,0,0.05)',
                                padding: 'var(--space-2) var(--space-3)',
                                borderRadius: 'var(--radius-sm)',
                                wordBreak: 'break-all',
                                fontSize: 'var(--font-size-xs)',
                                marginBottom: 'var(--space-2)'
                            }}>
                                {grupoCriado.inviteLink}
                            </div>
                            <button
                                className="btn btn-primary"
                                onClick={copiarLink}
                                style={{ width: '100%' }}
                            >
                                📋 Copiar Link de Convite
                            </button>
                        </div>
                    )}

                    {!grupoCriado.inviteLink && (
                        <div style={{
                            background: 'var(--info-bg, #dbeafe)',
                            color: 'var(--info, #1e40af)',
                            padding: 'var(--space-4)',
                            borderRadius: 'var(--radius-md)',
                            marginBottom: 'var(--space-4)',
                            fontSize: 'var(--font-size-sm)'
                        }}>
                            <strong>ℹ️ Grupo WhatsApp</strong>
                            <p style={{ marginTop: 'var(--space-2)', marginBottom: 0 }}>
                                O link de convite do WhatsApp estará disponível no painel após a aprovação.
                            </p>
                        </div>
                    )}

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
                            Sua CNH foi enviada para verificação. Você receberá acesso ao painel
                            de administração assim que sua conta for aprovada.
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

                    {/* Upload da CNH */}
                    <div className="form-group">
                        <label className="form-label">Foto da CNH (obrigatório)</label>
                        <input
                            type="file"
                            accept="image/*"
                            onChange={handleCnhChange}
                            style={{
                                width: '100%',
                                padding: 'var(--space-2)',
                                border: '1px solid var(--border-color)',
                                borderRadius: 'var(--radius-md)',
                                background: 'var(--bg-secondary)',
                                color: 'var(--text-primary)',
                                fontSize: 'var(--font-size-sm)'
                            }}
                        />
                        <small style={{ color: 'var(--text-muted)', fontSize: 'var(--font-size-xs)' }}>
                            Envie uma foto legível da sua CNH para verificação (máx. 5MB)
                        </small>
                        {cnhPreview && (
                            <div style={{ marginTop: 'var(--space-2)' }}>
                                <img
                                    src={cnhPreview}
                                    alt="Preview da CNH"
                                    style={{
                                        maxWidth: '100%',
                                        maxHeight: '200px',
                                        borderRadius: 'var(--radius-md)',
                                        border: '1px solid var(--border-color)',
                                        objectFit: 'contain'
                                    }}
                                />
                            </div>
                        )}
                    </div>

                    {/* Número de Matrícula */}
                    <div className="form-group">
                        <label className="form-label">Número de Matrícula (obrigatório)</label>
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
                            Digite o número de matrícula da sua instituição
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
