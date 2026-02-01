import { useState, useEffect, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import { supabase } from '../lib/supabase.js';
import { DIAS_SEMANA_FULL } from '../lib/database.types.js';

export default function Dashboard({ isAdmin = false }) {
    const { grupoId } = useParams();
    const [grupo, setGrupo] = useState(null);
    const [semana, setSemana] = useState([]);
    const [diaAtivo, setDiaAtivo] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    // Carregar dados do grupo e semana
    const loadData = useCallback(async () => {
        try {
            setError(null);

            // Buscar grupo
            const { data: grupoData, error: grupoError } = await supabase
                .from('grupos')
                .select('*')
                .eq('id', grupoId)
                .single();

            if (grupoError) throw grupoError;
            setGrupo(grupoData);

            // Buscar status da semana
            const { data: semanaData, error: semanaError } = await supabase
                .from('vw_status_semana')
                .select('*')
                .eq('grupo_id', grupoId)
                .order('data', { ascending: true });

            if (semanaError) throw semanaError;

            // Agrupar por dia
            const diasMap = {};
            semanaData?.forEach(item => {
                if (!diasMap[item.data]) {
                    diasMap[item.data] = {
                        data: item.data,
                        tipo: item.tipo,
                        horario: item.horario_partida,
                        membros: []
                    };
                }
                if (item.membro_id) {
                    diasMap[item.data].membros.push({
                        id: item.membro_id,
                        nome: item.membro_nome,
                        status: item.status_presenca,
                        atraso: item.horario_atraso,
                        observacao: item.observacao
                    });
                }
            });

            const diasArray = Object.values(diasMap);
            setSemana(diasArray);

            // Selecionar hoje ou primeiro dia
            const hoje = new Date().toISOString().split('T')[0];
            const diaHoje = diasArray.find(d => d.data === hoje);
            setDiaAtivo(diaHoje || diasArray[0] || null);

        } catch (err) {
            console.error('Erro ao carregar dados:', err);
            setError('Não foi possível carregar os dados. Verifique sua conexão.');
        } finally {
            setLoading(false);
        }
    }, [grupoId]);

    useEffect(() => {
        loadData();

        // Realtime subscription
        const channel = supabase
            .channel('presencas-changes')
            .on(
                'postgres_changes',
                { event: '*', schema: 'public', table: 'presencas' },
                () => loadData()
            )
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [loadData]);

    // Formatar data
    const formatData = (dataStr) => {
        const date = new Date(dataStr + 'T12:00:00');
        const dia = date.getDate();
        const diasSemana = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
        return { dia, diaSemana: diasSemana[date.getDay()] };
    };

    // Checar se é hoje
    const isHoje = (dataStr) => {
        return dataStr === new Date().toISOString().split('T')[0];
    };

    // Contar confirmados
    const countConfirmados = (membros) => {
        return membros?.filter(m =>
            m.status === 'confirmado' || m.status === 'atrasado'
        ).length || 0;
    };

    // Calcular valor por pessoa
    const getValorPorPessoa = () => {
        if (!grupo?.valor_semanal || !diaAtivo?.membros) return null;
        const confirmados = countConfirmados(diaAtivo.membros);
        if (confirmados === 0) return null;
        return (grupo.valor_semanal / confirmados).toFixed(2);
    };

    // Obter iniciais do nome
    const getIniciais = (nome) => {
        return nome?.split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase() || '?';
    };

    if (loading) {
        return (
            <div className="container">
                <header className="header">
                    <div className="skeleton" style={{ width: 150, height: 28 }} />
                </header>
                <div className="week-grid">
                    {[1, 2, 3, 4, 5].map(i => (
                        <div key={i} className="day-card">
                            <div className="skeleton skeleton-text" style={{ margin: '0 auto 8px', width: '60%' }} />
                            <div className="skeleton" style={{ width: 24, height: 24, margin: '0 auto' }} />
                        </div>
                    ))}
                </div>
                <div className="day-detail">
                    <div className="skeleton" style={{ height: 200 }} />
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="container">
                <div className="empty-state">
                    <div className="icon">⚠️</div>
                    <p>{error}</p>
                    <button className="btn btn-primary" onClick={loadData} style={{ marginTop: 16, maxWidth: 200 }}>
                        Tentar novamente
                    </button>
                </div>
            </div>
        );
    }

    if (!grupo) {
        return (
            <div className="container">
                <div className="empty-state">
                    <div className="icon">🔍</div>
                    <p>Grupo não encontrado.</p>
                </div>
            </div>
        );
    }

    return (
        <div className="container">
            {/* Header */}
            <header className="header">
                <div>
                    <h1 className="header-title">
                        <span className="icon">🚗</span>
                        {grupo.nome}
                    </h1>
                    <p className="header-subtitle">
                        Semana de {semana[0] ? formatData(semana[0].data).dia : '--'} a {semana[semana.length - 1] ? formatData(semana[semana.length - 1].data).dia : '--'}
                    </p>
                </div>
                {isAdmin && (
                    <span className="member-badge driver">Admin</span>
                )}
            </header>

            {/* Grid de dias */}
            <div className="week-grid">
                {semana.map(dia => {
                    const { dia: diaNum, diaSemana } = formatData(dia.data);
                    const confirmados = countConfirmados(dia.membros);

                    return (
                        <div
                            key={dia.data}
                            className={`day-card ${diaAtivo?.data === dia.data ? 'active' : ''} ${isHoje(dia.data) ? 'today' : ''}`}
                            onClick={() => setDiaAtivo(dia)}
                        >
                            <div className="day-name">{diaSemana}</div>
                            <div className="day-number">{diaNum}</div>
                            <div className={`day-count ${confirmados === 0 ? 'empty' : ''}`}>
                                {confirmados > 0 ? (
                                    <>✅ {confirmados}</>
                                ) : (
                                    '—'
                                )}
                            </div>
                        </div>
                    );
                })}
            </div>

            {/* Detalhes do dia selecionado */}
            {diaAtivo && (
                <div className="day-detail">
                    <div className="day-detail-header">
                        <h2 className="day-detail-title">
                            {isHoje(diaAtivo.data) ? 'Hoje' : formatData(diaAtivo.data).diaSemana}
                            {' '}({diaAtivo.data.split('-').reverse().slice(0, 2).join('/')})
                        </h2>
                        <div className="day-detail-time">
                            🕐 Saída: {diaAtivo.horario?.slice(0, 5) || grupo.horario_ida?.slice(0, 5) || '07:00'}
                        </div>
                    </div>

                    {diaAtivo.membros.length === 0 ? (
                        <div className="empty-state">
                            <div className="icon">😴</div>
                            <p>Nenhuma confirmação ainda</p>
                        </div>
                    ) : (
                        <div className="member-list">
                            {diaAtivo.membros
                                .filter(m => m.status !== 'cancelado')
                                .sort((a, b) => {
                                    // Motorista primeiro, depois por nome
                                    if (a.isMotorista) return -1;
                                    if (b.isMotorista) return 1;
                                    return a.nome?.localeCompare(b.nome);
                                })
                                .map(membro => (
                                    <div key={membro.id} className="member-item">
                                        <div className={`member-avatar ${membro.status}`}>
                                            {getIniciais(membro.nome)}
                                        </div>
                                        <div className="member-info">
                                            <div className="member-name">{membro.nome}</div>
                                            <div className="member-status">
                                                {membro.status === 'atrasado' && membro.atraso
                                                    ? `⏰ Chega às ${membro.atraso.slice(0, 5)}`
                                                    : membro.status === 'confirmado'
                                                        ? '✅ Confirmado'
                                                        : '⏳ Pendente'}
                                            </div>
                                        </div>
                                        {membro.isMotorista && (
                                            <span className="member-badge driver">Motorista</span>
                                        )}
                                    </div>
                                ))}
                        </div>
                    )}
                </div>
            )}

            {/* Resumo financeiro */}
            {grupo.valor_semanal > 0 && (
                <div className="summary-card">
                    <div className="summary-title">💰 Valor por pessoa (semana)</div>
                    <div className="summary-value">
                        R$ {getValorPorPessoa() || '--'}
                    </div>
                    <div className="summary-detail">
                        Total: R$ {parseFloat(grupo.valor_semanal).toFixed(2)}
                        {' '}÷ {countConfirmados(diaAtivo?.membros) || '?'} pessoas
                    </div>
                </div>
            )}
        </div>
    );
}
