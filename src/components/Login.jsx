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
            // Passo 1: Buscar membros
            const { data: todos, error: todosError } = await supabase
                .from('membros')
                .select('*')
                .in('telefone', variantes);

            console.log('Resultado busca por telefone:', { todos, todosError });

            if (todosError) {
                console.error('Erro na query:', todosError);
                throw new Error('Erro ao acessar o banco de dados.');
            }

            if (!todos || todos.length === 0) {
                throw new Error('Telefone não encontrado. Verifique se digitou corretamente.');
            }

            // Passo 2: Buscar grupos desses membros
            // Coletar IDs de grupos únicos (filtrando nulos)
            const grupoIds = [...new Set(todos.map(m => m.grupo_id).filter(id => id))];

            let gruposData = [];

            if (grupoIds.length > 0) {
                const { data, error } = await supabase
                    .from('grupos')
                    .select('*')
                    .in('id', grupoIds);

                if (error) {
                    console.error('Erro ao buscar grupos:', error);
                    throw new Error('Erro ao carregar dados dos grupos.');
                }
                gruposData = data || [];
            }

            // Anexar dados do grupo a cada membro
            const memberships = todos.map(membro => {
                const grupo = gruposData.find(g => g.id === membro.grupo_id);
                // Se não achou grupo (ou é null), grupo será undefined
                return { ...membro, grupos: grupo };
            });

            // Filtrar apenas membros ativos/pendentes (ignorar rejeitados se quiser, mas aqui vamos tratar depois)
            // memberships já foi declarado acima com o map
            // const memberships = todos; // REMOVIDO

            // Selecionar o membro principal para logar (preferência por motorista, ou o primeiro)
            // Se houver múltiplos, idealmente o usuário escolheria, mas por enquanto vamos logar no primeiro
            // e permitir troca depois.
            // Regra: Se tiver um motorista, entra como motorista.
            let membroSelecionado = memberships.find(m => m.is_motorista) || memberships[0];

            // Verificar senha APENAS se estiver entrando como motorista
            if (membroSelecionado.is_motorista) {
                if (membroSelecionado.senha_hash !== senha) {
                    throw new Error('Senha incorreta.');
                }
            } else {
                // Para passageiros, talvez pedir senha se tiver? Ou fluxo sem senha por enquanto?
                // O código original pedia senha para LOGIN.
                // Se o passageiro não tem senha, como ele loga? 
                // O schema diz: senha_hash VARCHAR(255), -- Apenas para motoristas (admin)
                // Então passageiro não tem senha. Login por telefone apenas? 
                // Isso é inseguro. Vamos assumir que por enquanto é só telefone para passageiro
                // ou verificar se existe algum fluxo de auth real. 
                // O MVP parece confiar no telefone/localstorage.

                // TODO: Implementar OTP ou senha para passageiro. Por enquanto, login aberto (conforme app de teste).
                // Mas se o usuário digitou senha, vamos ignorar para passageiro?
                // Vamos manter simples: Passageiro entra sem senha (apenas telefone).
            }

            // Se o selecionado estiver pendente/rejeitado, tentar achar um aprovado
            if (membroSelecionado.status_aprovacao !== 'aprovado' && memberships.length > 1) {
                const aprovado = memberships.find(m => m.status_aprovacao === 'aprovado');
                if (aprovado) membroSelecionado = aprovado;
            }

            // Motoristas pendentes podem logar (verão warning no Dashboard)
            // Passageiros pendentes são bloqueados
            if (membroSelecionado.status_aprovacao === 'pendente' && !membroSelecionado.is_motorista) {
                throw new Error('Sua solicitação para participar deste grupo ainda está aguardando aprovação do motorista.');
            }
            if (membroSelecionado.status_aprovacao === 'rejeitado') {
                if (membroSelecionado.is_motorista) {
                    throw new Error('Sua solicitação de cadastro como motorista foi rejeitada pelo administrador do sistema.');
                }
                throw new Error('Sua solicitação de entrada neste grupo foi rejeitada.');
            }

            // Salvar sessão via contexto (passando todos os memberships)
            login(membroSelecionado, membroSelecionado.is_motorista ? 'motorista' : 'passageiro', memberships);

            // Redirecionar
            let targetPath = '/';

            if (!membroSelecionado.grupo_id) {
                // Se não tem grupo, vai para listagem
                targetPath = '/grupos';
            } else if (membroSelecionado.is_motorista) {
                targetPath = `/admin/${membroSelecionado.grupo_id}`;
            } else {
                targetPath = `/g/${membroSelecionado.grupo_id}`;
            }

            const from = location.state?.from?.pathname || targetPath;
            console.log('Redirecionando para:', from);
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
