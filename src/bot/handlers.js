/**
 * Handlers de Comandos do Bot
 * Processa intenções e executa ações no banco
 */

import { supabase } from '../lib/supabase.js';
import { getMensagemAjuda } from './intentParser.js';
import { DIAS_SEMANA_FULL } from '../lib/database.types.js';
import { getPhoneLookupFormats } from '../lib/phoneUtils.js';

/**
 * Obtém membro pelo telefone
 * Busca em `usuarios` primeiro, depois encontra o `membros` correspondente.
 * Retorna objeto com dados do membro + identidade (nome, telefone, whatsapp_id)
 * achatados a partir de `usuarios`.
 * @param {string} telefone 
 * @param {string} whatsappId
 * @returns {Promise<Object|null>}
 */
export async function getOrCreateMembro(telefone, whatsappId) {
    console.log(`🔍 Buscando membro com telefone: "${telefone}"`);

    const telefonesParaBuscar = getPhoneLookupFormats(telefone);
    console.log(`🔍 Tentando formatos: ${telefonesParaBuscar.join(', ')}`);

    // 1. Buscar usuário na tabela usuarios
    const { data: usuario } = await supabase
        .from('usuarios')
        .select('id, nome, telefone, whatsapp_id')
        .in('telefone', telefonesParaBuscar)
        .limit(1)
        .single();

    if (!usuario) {
        console.log(`⚠️ Usuário não encontrado para telefone: "${telefone}"`);
        return null;
    }

    // Atualizar whatsapp_id no usuario se necessário
    if (!usuario.whatsapp_id && whatsappId) {
        await supabase.from('usuarios').update({ whatsapp_id: whatsappId }).eq('id', usuario.id);
        usuario.whatsapp_id = whatsappId;
    }

    // 2. Buscar membro pelo usuario_id
    const { data: membro, error } = await supabase
        .from('membros')
        .select('*, grupos!membros_grupo_id_fkey(*)')
        .eq('usuario_id', usuario.id)
        .eq('ativo', true)
        .limit(1)
        .single();

    if (error && error.code !== 'PGRST116') {
        console.log(`❌ Erro ao buscar membro: ${error.message}`);
    }

    if (membro) {
        // Achatar dados de identidade do usuario no resultado
        const result = {
            ...membro,
            nome: usuario.nome,
            telefone: usuario.telefone,
            whatsapp_id: usuario.whatsapp_id,
            usuario_id: usuario.id
        };
        console.log(`✅ Membro encontrado: ${result.nome} (grupo: ${membro.grupos?.nome || 'sem grupo'})`);
        return result;
    }

    console.log(`⚠️ Usuário encontrado mas sem grupo: ${usuario.telefone}`);
    return null;
}

/**
 * Confirma presença do membro nos dias especificados
 * Se modelo=por_trajeto, cria débito automaticamente
 * @param {string} membroId 
 * @param {string} grupoId
 * @param {string[]} dias 
 * @param {string[]} [tipos=['ida']] - Tipos de viagem: 'ida', 'volta', ou ambos
 * @returns {Promise<string>} Mensagem de resposta
 */
export async function confirmarPresenca(membroId, grupoId, dias, tipos = ['ida']) {
    const hoje = new Date();
    const diasConfirmados = [];
    let totalDebitos = 0;

    // Buscar configurações do grupo
    const { data: grupo } = await supabase
        .from('grupos')
        .select('modelo_precificacao, valor_trajeto')
        .eq('id', grupoId)
        .single();

    const usaDebitoPorTrajeto = grupo?.modelo_precificacao === 'por_trajeto';
    const valorTrajeto = parseFloat(grupo?.valor_trajeto) || 0;

    for (const dia of dias) {
        // Mapear dia para data real
        const dataViagem = getDiaData(dia);
        if (!dataViagem || dataViagem < hoje.toISOString().split('T')[0]) continue;

        for (const tipo of tipos) {
            // Buscar viagem
            const { data: viagem } = await supabase
                .from('viagens')
                .select('id')
                .eq('grupo_id', grupoId)
                .eq('data', dataViagem)
                .eq('tipo', tipo)
                .single();

            if (!viagem) continue;

            // Inserir ou atualizar presença
            const { data: presenca } = await supabase
                .from('presencas')
                .upsert({
                    viagem_id: viagem.id,
                    membro_id: membroId,
                    status: 'confirmado',
                    confirmado_em: new Date().toISOString()
                }, { onConflict: 'viagem_id,membro_id' })
                .select()
                .single();

            // Se modelo por trajeto, criar débito
            if (usaDebitoPorTrajeto && valorTrajeto > 0 && presenca) {
                // Verificar se já existe débito para esta presença
                const { data: debitoExistente } = await supabase
                    .from('transacoes')
                    .select('id')
                    .eq('presenca_id', presenca.id)
                    .eq('tipo', 'debito')
                    .single();

                if (!debitoExistente) {
                    const tipoLabel = tipo === 'ida' ? 'Ida' : 'Volta';
                    await supabase.from('transacoes').insert({
                        grupo_id: grupoId,
                        membro_id: membroId,
                        presenca_id: presenca.id,
                        tipo: 'debito',
                        valor: valorTrajeto,
                        descricao: `Carona ${dataViagem} (${tipoLabel})`
                    });
                    totalDebitos += valorTrajeto;
                }
            }
        }

        diasConfirmados.push(DIAS_SEMANA_FULL[dia] || dia);
    }

    if (diasConfirmados.length === 0) {
        return '🤔 Não encontrei viagens para os dias informados.';
    }

    let resposta = `✅ Confirmado para ${diasConfirmados.join(', ')}!`;
    if (totalDebitos > 0) {
        resposta += `\n💰 Débito adicionado: R$ ${totalDebitos.toFixed(2)}`;
    }

    return resposta;
}

/**
 * Cancela presença do membro nos dias especificados
 * Verifica janela de cancelamento apenas para membros comuns
 * Motoristas podem cancelar a qualquer momento
 * @param {string} membroId 
 * @param {string} grupoId
 * @param {string[]} dias 
 * @param {string[]} [tipos=['ida']] - Tipos de viagem
 * @param {boolean} [isMotorista=false] - Se true, ignora limite de tempo
 * @returns {Promise<string>}
 */
export async function cancelarPresenca(membroId, grupoId, dias, tipos = ['ida'], isMotorista = false) {
    const agora = new Date();
    const diasCancelados = [];
    const diasBloqueados = [];
    let debitosRemovidos = 0;

    // Buscar configurações do grupo
    const { data: grupo } = await supabase
        .from('grupos')
        .select('tempo_limite_cancelamento, modelo_precificacao, horario_ida, horario_volta')
        .eq('id', grupoId)
        .single();

    const limiteMinutos = grupo?.tempo_limite_cancelamento || 30;

    for (const dia of dias) {
        const dataViagem = getDiaData(dia);
        if (!dataViagem || dataViagem < agora.toISOString().split('T')[0]) continue;

        for (const tipo of tipos) {
            const horarioViagem = tipo === 'ida' ? grupo?.horario_ida : grupo?.horario_volta;

            // Verificar se está dentro da janela de cancelamento (apenas para membros comuns)
            if (!isMotorista && dataViagem === agora.toISOString().split('T')[0]) {
                // É hoje - verificar horário
                const [h, m] = (horarioViagem || '07:00').split(':').map(Number);
                const horarioLimite = new Date(agora);
                horarioLimite.setHours(h, m - limiteMinutos, 0, 0);

                if (agora >= horarioLimite) {
                    diasBloqueados.push(`${DIAS_SEMANA_FULL[dia] || dia} (${tipo})`);
                    continue; // Não pode cancelar, passou do limite
                }
            }

            const { data: viagem } = await supabase
                .from('viagens')
                .select('id')
                .eq('grupo_id', grupoId)
                .eq('data', dataViagem)
                .eq('tipo', tipo)
                .single();

            if (!viagem) continue;

            // Buscar presença para remover débito associado
            const { data: presenca } = await supabase
                .from('presencas')
                .select('id')
                .eq('viagem_id', viagem.id)
                .eq('membro_id', membroId)
                .single();

            // Atualizar status para cancelado
            await supabase
                .from('presencas')
                .upsert({
                    viagem_id: viagem.id,
                    membro_id: membroId,
                    status: 'cancelado'
                }, { onConflict: 'viagem_id,membro_id' });

            // Remover débito associado (se existir e modelo for por_trajeto)
            if (presenca && grupo?.modelo_precificacao === 'por_trajeto') {
                const { data: debitoRemovido } = await supabase
                    .from('transacoes')
                    .delete()
                    .eq('presenca_id', presenca.id)
                    .eq('tipo', 'debito')
                    .select();

                if (debitoRemovido?.length > 0) {
                    debitosRemovidos += parseFloat(debitoRemovido[0].valor) || 0;
                }
            }
        }

        diasCancelados.push(DIAS_SEMANA_FULL[dia] || dia);
    }

    if (diasCancelados.length === 0 && diasBloqueados.length === 0) {
        return '🤔 Não encontrei viagens para os dias informados.';
    }

    let resposta = '';

    if (diasCancelados.length > 0) {
        resposta += `❌ Cancelado para ${diasCancelados.join(', ')}.`;
        if (debitosRemovidos > 0) {
            resposta += `\n💸 Débito removido: R$ ${debitosRemovidos.toFixed(2)}`;
        }
    }

    if (diasBloqueados.length > 0) {
        if (resposta) resposta += '\n\n';
        resposta += `⏰ Não foi possível cancelar: ${diasBloqueados.join(', ')}.\nPassou do limite de ${limiteMinutos} minutos antes da viagem. Fale com o motorista.`;
    }

    return resposta;
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
        return `👋 Olá! Eu sou o *Cajurona*, seu assistente de caronas!

Parece que você ainda não faz parte de nenhum grupo de carona cadastrado.

📝 *Para começar:*
Peça ao motorista do seu grupo para te adicionar, ou entre em um grupo de carona e me envie uma mensagem lá.

💡 Se você é motorista e quer cadastrar seu grupo, acesse o painel web.`;
    }

    // Buscar ou criar usuario
    const telefonesParaBuscar = getPhoneLookupFormats(telefone);
    let { data: usuario } = await supabase
        .from('usuarios')
        .select('id')
        .in('telefone', telefonesParaBuscar)
        .limit(1)
        .single();

    if (!usuario) {
        const { data: novoUsuario, error: userError } = await supabase
            .from('usuarios')
            .insert({ nome, telefone, matricula: '', matricula_status: 'pendente' })
            .select()
            .single();
        if (userError) return '❌ Erro ao cadastrar. Tente novamente.';
        usuario = novoUsuario;
    }

    // Criar membro (vinculado ao usuario)
    const { error } = await supabase
        .from('membros')
        .insert({
            grupo_id: grupo.id,
            usuario_id: usuario.id,
            is_motorista: false,
            ativo: true,
            dias_padrao: dias,
            status_aprovacao: 'aprovado'
        });

    if (error) {
        if (error.code === '23505') {
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

/**
 * Obtém saldo devedor do membro
 * @param {string} membroId 
 * @returns {Promise<{saldo: number, debitos: number, pagamentos: number}>}
 */
export async function getSaldoMembro(membroId) {
    const { data } = await supabase
        .from('vw_saldo_membros')
        .select('*')
        .eq('membro_id', membroId)
        .single();

    if (!data) {
        return { saldo: 0, debitos: 0, pagamentos: 0 };
    }

    return {
        saldo: parseFloat(data.saldo_devedor) || 0,
        debitos: parseFloat(data.total_debitos) || 0,
        pagamentos: parseFloat(data.total_pagamentos) || 0
    };
}

/**
 * Retorna mensagem formatada com saldo do membro
 * @param {string} membroId 
 * @param {string} nome 
 * @returns {Promise<string>}
 */
export async function getMensagemSaldo(membroId, nome) {
    const { saldo, debitos, pagamentos } = await getSaldoMembro(membroId);

    if (saldo === 0 && debitos === 0) {
        return `💰 ${nome}, você não tem débitos pendentes! 🎉`;
    }

    if (saldo === 0 && debitos > 0) {
        return `💰 ${nome}, seu saldo está zerado!\nTotal já pago: R$ ${pagamentos.toFixed(2)}`;
    }

    return `💰 *Saldo de ${nome}*\n\nDébitos: R$ ${debitos.toFixed(2)}\nPagamentos: R$ ${pagamentos.toFixed(2)}\n\n📌 *Pendente: R$ ${saldo.toFixed(2)}*`;
}

/**
 * Registra pagamento de um membro (apenas motorista pode usar)
 * @param {string} grupoId 
 * @param {string} membroId 
 * @param {number} valor 
 * @param {string} [descricao] 
 * @returns {Promise<string>}
 */
export async function registrarPagamento(grupoId, membroId, valor, descricao = 'Pagamento') {
    // Buscar nome do membro via usuario
    const { data: membro } = await supabase
        .from('membros')
        .select('id, usuarios(nome)')
        .eq('id', membroId)
        .single();

    const nomeMembro = membro?.usuarios?.nome || 'Membro';

    if (!membro) {
        return '❌ Membro não encontrado.';
    }

    // Registrar pagamento
    const { error } = await supabase.from('transacoes').insert({
        grupo_id: grupoId,
        membro_id: membroId,
        tipo: 'pagamento',
        valor: valor,
        descricao
    });

    if (error) {
        console.error('Erro ao registrar pagamento:', error);
        return '❌ Erro ao registrar pagamento.';
    }

    // Buscar novo saldo
    const { saldo } = await getSaldoMembro(membroId);

    let resposta = `✅ Pagamento de R$ ${valor.toFixed(2)} registrado para ${nomeMembro}.`;
    if (saldo > 0) {
        resposta += `\n📌 Saldo pendente: R$ ${saldo.toFixed(2)}`;
    } else {
        resposta += `\n🎉 Saldo zerado!`;
    }

    return resposta;
}

/**
 * Auto-onboarding: cria membro automaticamente quando entra no grupo WhatsApp
 * Agora cria `usuarios` primeiro (se não existe), depois `membros` com `usuario_id`
 * @param {string} telefone - Telefone do novo membro
 * @param {string} grupoWhatsappId - JID do grupo WhatsApp
 * @param {string} senhaDescartavel - Senha gerada para acesso ao dashboard
 * @returns {Promise<import('../lib/database.types.js').Membro|null>}
 */
export async function autoOnboardMembro(telefone, grupoWhatsappId, senhaDescartavel) {
    // Buscar grupo pelo whatsapp_group_id
    const { data: grupo } = await supabase
        .from('grupos')
        .select('id, motorista_id')
        .eq('whatsapp_group_id', grupoWhatsappId)
        .single();

    if (!grupo) {
        console.log(`⚠️ Grupo não encontrado para auto-onboarding: ${grupoWhatsappId}`);
        return null;
    }

    // Verificar se é o motorista (motorista_id agora referencia usuarios.id)
    if (grupo.motorista_id) {
        const { data: motorista } = await supabase
            .from('usuarios')
            .select('telefone')
            .eq('id', grupo.motorista_id)
            .single();

        if (motorista?.telefone) {
            const motorFormats = getPhoneLookupFormats(motorista.telefone);
            const newFormats = getPhoneLookupFormats(telefone);
            const isMotorista = motorFormats.some(f => newFormats.includes(f));

            if (isMotorista) {
                console.log(`🚗 Telefone ${telefone} é do motorista, ignorando auto-onboarding`);
                return null;
            }
        }
    }

    const telefonesParaBuscar = getPhoneLookupFormats(telefone);

    // 1. Buscar ou criar usuario
    let { data: usuario } = await supabase
        .from('usuarios')
        .select('id, nome')
        .in('telefone', telefonesParaBuscar)
        .limit(1)
        .single();

    if (!usuario) {
        // Criar usuario com dados mínimos
        const { data: novoUsuario, error: userError } = await supabase
            .from('usuarios')
            .insert({
                nome: `Membro ${telefone.slice(-4)}`,
                telefone,
                senha_hash: senhaDescartavel,
                matricula: '',
                matricula_status: 'pendente'
            })
            .select()
            .single();

        if (userError) {
            console.error(`❌ Erro ao criar usuario auto-onboarding: ${userError.message}`);
            return null;
        }
        usuario = novoUsuario;
    }

    // 2. Verificar se já existe membro neste grupo
    const { data: membroExistente } = await supabase
        .from('membros')
        .select('id')
        .eq('grupo_id', grupo.id)
        .eq('usuario_id', usuario.id)
        .limit(1)
        .single();

    if (membroExistente) {
        console.log(`👤 Membro já existe neste grupo: ${telefone}`);
        return null;
    }

    // 3. Criar membro vinculado ao usuario (sem nome/telefone — vêm de usuarios)
    const { data: novoMembro, error } = await supabase
        .from('membros')
        .insert({
            grupo_id: grupo.id,
            usuario_id: usuario.id,
            is_motorista: false,
            ativo: true,
            dias_padrao: [],
            status_aprovacao: 'aprovado'
        })
        .select()
        .single();

    if (error) {
        console.error(`❌ Erro ao criar membro auto-onboarding: ${error.message}`);
        return null;
    }

    console.log(`✨ Membro auto-cadastrado: ${novoMembro.nome} (${telefone})`);
    return novoMembro;
}
