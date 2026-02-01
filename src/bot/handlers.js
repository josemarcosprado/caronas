/**
 * Handlers de Comandos do Bot
 * Processa intenções e executa ações no banco
 */

import { supabase } from '../lib/supabase.js';
import { getMensagemAjuda } from './intentParser.js';
import { DIAS_SEMANA_FULL } from '../lib/database.types.js';

/**
 * Obtém ou cria membro pelo telefone
 * @param {string} telefone 
 * @param {string} whatsappId
 * @returns {Promise<import('../lib/database.types.js').Membro|null>}
 */
export async function getOrCreateMembro(telefone, whatsappId) {
    // Buscar membro existente
    const { data: membro } = await supabase
        .from('membros')
        .select('*, grupos(*)')
        .eq('telefone', telefone)
        .single();

    if (membro) {
        // Atualizar whatsapp_id se necessário
        if (!membro.whatsapp_id && whatsappId) {
            await supabase
                .from('membros')
                .update({ whatsapp_id: whatsappId })
                .eq('id', membro.id);
        }
        return membro;
    }

    return null;
}

/**
 * Confirma presença do membro nos dias especificados
 * @param {string} membroId 
 * @param {string} grupoId
 * @param {string[]} dias 
 * @returns {Promise<string>} Mensagem de resposta
 */
export async function confirmarPresenca(membroId, grupoId, dias) {
    const hoje = new Date();
    const diasConfirmados = [];

    for (const dia of dias) {
        // Mapear dia para data real
        const dataViagem = getDiaData(dia);
        if (!dataViagem || dataViagem < hoje.toISOString().split('T')[0]) continue;

        // Buscar viagem
        const { data: viagem } = await supabase
            .from('viagens')
            .select('id')
            .eq('grupo_id', grupoId)
            .eq('data', dataViagem)
            .eq('tipo', 'ida')
            .single();

        if (!viagem) continue;

        // Inserir ou atualizar presença
        await supabase
            .from('presencas')
            .upsert({
                viagem_id: viagem.id,
                membro_id: membroId,
                status: 'confirmado',
                confirmado_em: new Date().toISOString()
            }, { onConflict: 'viagem_id,membro_id' });

        diasConfirmados.push(DIAS_SEMANA_FULL[dia] || dia);
    }

    if (diasConfirmados.length === 0) {
        return '🤔 Não encontrei viagens para os dias informados.';
    }

    return `✅ Confirmado para ${diasConfirmados.join(', ')}!`;
}

/**
 * Cancela presença do membro nos dias especificados
 * @param {string} membroId 
 * @param {string} grupoId
 * @param {string[]} dias 
 * @returns {Promise<string>}
 */
export async function cancelarPresenca(membroId, grupoId, dias) {
    const hoje = new Date();
    const diasCancelados = [];

    for (const dia of dias) {
        const dataViagem = getDiaData(dia);
        if (!dataViagem || dataViagem < hoje.toISOString().split('T')[0]) continue;

        const { data: viagem } = await supabase
            .from('viagens')
            .select('id')
            .eq('grupo_id', grupoId)
            .eq('data', dataViagem)
            .eq('tipo', 'ida')
            .single();

        if (!viagem) continue;

        await supabase
            .from('presencas')
            .upsert({
                viagem_id: viagem.id,
                membro_id: membroId,
                status: 'cancelado'
            }, { onConflict: 'viagem_id,membro_id' });

        diasCancelados.push(DIAS_SEMANA_FULL[dia] || dia);
    }

    if (diasCancelados.length === 0) {
        return '🤔 Não encontrei viagens para os dias informados.';
    }

    return `❌ Cancelado para ${diasCancelados.join(', ')}.`;
}

/**
 * Registra atraso do membro
 * @param {string} membroId 
 * @param {string} grupoId
 * @param {number} minutos 
 * @returns {Promise<string>}
 */
export async function registrarAtraso(membroId, grupoId, minutos) {
    const hoje = new Date().toISOString().split('T')[0];

    const { data: viagem } = await supabase
        .from('viagens')
        .select('id, horario_partida')
        .eq('grupo_id', grupoId)
        .eq('data', hoje)
        .eq('tipo', 'ida')
        .single();

    if (!viagem) {
        return '🤔 Não há viagem agendada para hoje.';
    }

    // Calcular horário de chegada
    const [h, m] = viagem.horario_partida.split(':').map(Number);
    const novoMinuto = m + minutos;
    const horaAtraso = `${String(h + Math.floor(novoMinuto / 60)).padStart(2, '0')}:${String(novoMinuto % 60).padStart(2, '0')}`;

    await supabase
        .from('presencas')
        .upsert({
            viagem_id: viagem.id,
            membro_id: membroId,
            status: 'atrasado',
            horario_atraso: horaAtraso,
            observacao: `Atraso de ${minutos} minutos`
        }, { onConflict: 'viagem_id,membro_id' });

    return `⏰ Anotado! Você chegará às ${horaAtraso}. Vou avisar o motorista.`;
}

/**
 * Retorna status de quem vai hoje
 * @param {string} grupoId 
 * @returns {Promise<string>}
 */
export async function getStatusHoje(grupoId) {
    const hoje = new Date().toISOString().split('T')[0];

    const { data: presencas } = await supabase
        .from('vw_status_semana')
        .select('*')
        .eq('grupo_id', grupoId)
        .eq('data', hoje)
        .eq('tipo', 'ida');

    if (!presencas || presencas.length === 0) {
        return '📋 Nenhuma confirmação para hoje ainda.';
    }

    const confirmados = presencas.filter(p => p.status_presenca === 'confirmado');
    const atrasados = presencas.filter(p => p.status_presenca === 'atrasado');

    let msg = `📋 *Hoje (${hoje})*\n`;
    msg += `🚗 Saída: ${presencas[0]?.horario_partida || '07:00'}\n\n`;

    if (confirmados.length > 0) {
        msg += confirmados.map(p => `✅ ${p.membro_nome}`).join('\n');
    }

    if (atrasados.length > 0) {
        msg += '\n' + atrasados.map(p => `⏰ ${p.membro_nome} (${p.horario_atraso})`).join('\n');
    }

    const total = confirmados.length + atrasados.length;
    if (presencas[0]?.valor_semanal && total > 0) {
        const valorPorPessoa = (parseFloat(presencas[0].valor_semanal) / total).toFixed(2);
        msg += `\n\n💰 R$ ${valorPorPessoa}/pessoa`;
    }

    return msg;
}

/**
 * Processa mensagem de onboarding
 * @param {string} texto 
 * @param {string} telefone
 * @param {string} grupoWhatsappId
 * @returns {Promise<string>}
 */
export async function processarOnboarding(texto, telefone, grupoWhatsappId) {
    // Extrair nome (primeira parte antes de vírgula ou "vou")
    const nomeMatch = texto.match(/(?:sou\s+[oa]?\s*)?([A-Za-záéíóúâêîôûãõàèìòùç]+)/i);
    const nome = nomeMatch ? nomeMatch[1] : 'Novo Membro';

    // Extrair dias
    const diasMatch = texto.toLowerCase();
    const dias = [];

    if (diasMatch.includes('seg') || diasMatch.includes('segunda')) dias.push('seg');
    if (diasMatch.includes('ter') || diasMatch.includes('terça') || diasMatch.includes('terca')) dias.push('ter');
    if (diasMatch.includes('qua') || diasMatch.includes('quarta')) dias.push('qua');
    if (diasMatch.includes('qui') || diasMatch.includes('quinta')) dias.push('qui');
    if (diasMatch.includes('sex') || diasMatch.includes('sexta')) dias.push('sex');

    // Buscar grupo pelo whatsapp_group_id
    const { data: grupo } = await supabase
        .from('grupos')
        .select('id')
        .eq('whatsapp_group_id', grupoWhatsappId)
        .single();

    if (!grupo) {
        return '❌ Grupo não cadastrado. Peça ao motorista para configurar.';
    }

    // Criar membro
    const { data: novoMembro, error } = await supabase
        .from('membros')
        .insert({
            grupo_id: grupo.id,
            nome,
            telefone,
            dias_padrao: dias
        })
        .select()
        .single();

    if (error) {
        if (error.code === '23505') { // unique violation
            return '👋 Você já está cadastrado! Use "ajuda" para ver os comandos.';
        }
        return '❌ Erro ao cadastrar. Tente novamente.';
    }

    const diasFormatados = dias.map(d => DIAS_SEMANA_FULL[d]).join(', ');
    return `✅ Cadastrado, ${nome}!\nSeus dias padrão: ${diasFormatados || 'nenhum'}\n\nUse "ajuda" para ver os comandos.`;
}

/**
 * Converte dia da semana para data
 * @param {string} dia - 'seg', 'ter', etc. ou 'hoje'
 * @returns {string|null} Data no formato YYYY-MM-DD
 */
function getDiaData(dia) {
    const hoje = new Date();
    const diaAtual = hoje.getDay(); // 0 = domingo

    if (dia === 'hoje') {
        return hoje.toISOString().split('T')[0];
    }

    const diaMap = { 'seg': 1, 'ter': 2, 'qua': 3, 'qui': 4, 'sex': 5 };
    const targetDow = diaMap[dia];

    if (!targetDow) return null;

    // Calcular diferença de dias
    let diff = targetDow - diaAtual;
    if (diff < 0) diff += 7; // Próxima semana

    const targetDate = new Date(hoje);
    targetDate.setDate(hoje.getDate() + diff);

    return targetDate.toISOString().split('T')[0];
}

/**
 * Loga atividade no banco
 * @param {string} membroId 
 * @param {string} tipoAcao 
 * @param {string} mensagemOriginal 
 * @param {string} intencaoDetectada 
 * @param {number} confianca 
 */
export async function logAtividade(membroId, tipoAcao, mensagemOriginal, intencaoDetectada, confianca) {
    await supabase
        .from('logs_atividade')
        .insert({
            membro_id: membroId,
            tipo_acao: tipoAcao,
            mensagem_original: mensagemOriginal,
            intencao_detectada: intencaoDetectada,
            confianca
        });
}
