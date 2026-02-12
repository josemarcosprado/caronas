/**
 * Servidor do Bot WhatsApp
 * Recebe webhooks da Evolution API e processa mensagens
 */

import 'dotenv/config';

import express from 'express';
import { detectIntent, getMensagemAjuda, getSaudacao } from './intentParser.js';
import {
    getOrCreateMembro,
    confirmarPresenca,
    cancelarPresenca,
    registrarAtraso,
    getStatusHoje,
    processarOnboarding,
    logAtividade,
    getMensagemSaldo,
    autoOnboardMembro
} from './handlers.js';
import {
    enviarMensagem as enviarMensagemApi,
    criarGrupoWhatsApp,
    buscarInviteLink,
    buscarParticipantes,
    renovarInviteLink
} from './evolutionApi.js';
import { supabase } from '../lib/supabase.js';
import { getPhoneLookupFormats } from '../lib/phoneUtils.js';

const app = express();
app.use(express.json());

const PORT = process.env.BOT_PORT || 3001;
const WEBHOOK_SECRET = process.env.BOT_WEBHOOK_SECRET;

// Whitelist de grupos permitidos (vazio = aceita todos)
// Formato: IDs separados por vírgula, ex: "5511999998888-1234567890@g.us,..."
const ALLOWED_GROUPS = process.env.ALLOWED_GROUPS?.split(',').filter(Boolean) || [];

/**
 * Cache para evitar mensagens duplicadas
 * Chave: whatsappId:hash_da_mensagem
 * Valor: timestamp
 */
const messageCache = new Map();
const MESSAGE_CACHE_TTL = 5 * 60 * 1000; // 5 minutos

/**
 * Cache em memória de LID → telefone (carregado a partir do banco)
 * Chave: lid (ex: "133440506744833")
 * Valor: telefone (ex: "557998223366")
 */
const lidCache = new Map();

/**
 * Verifica se a mensagem já foi enviada recentemente
 * @param {string} whatsappId - ID do destinatário
 * @param {string} mensagem - Mensagem a enviar
 * @returns {boolean} true se é duplicada
 */
function isDuplicateMessage(whatsappId, mensagem) {
    // Limpar cache antigo
    const now = Date.now();
    for (const [key, timestamp] of messageCache.entries()) {
        if (now - timestamp > MESSAGE_CACHE_TTL) {
            messageCache.delete(key);
        }
    }

    // Criar hash simples da mensagem (primeiros 50 chars)
    const hash = mensagem.substring(0, 50);
    const cacheKey = `${whatsappId}:${hash}`;

    if (messageCache.has(cacheKey)) {
        console.log(`⏭️ Evitando mensagem duplicada para ${whatsappId}`);
        return true;
    }

    messageCache.set(cacheKey, now);
    return false;
}

/**
 * Verifica se o grupo está na whitelist
 * @param {string} remoteJid - ID do chat
 * @returns {boolean}
 */
function isGroupAllowed(remoteJid) {
    // Se não há whitelist configurada, aceita tudo
    if (ALLOWED_GROUPS.length === 0) return true;

    // Verifica se o grupo está na lista
    return ALLOWED_GROUPS.some(g => remoteJid.includes(g.trim()));
}

/**
 * Envia mensagem via Evolution API com verificação de duplicatas
 * @param {string} numero - Número do destinatário
 * @param {string} texto - Mensagem a enviar
 * @param {boolean} [checkDuplicate=true] - Se deve verificar duplicatas
 */
async function enviarMensagem(numero, texto, checkDuplicate = true) {
    // Evitar mensagens duplicadas (exceto para respostas importantes)
    if (checkDuplicate && isDuplicateMessage(numero, texto)) {
        return;
    }
    await enviarMensagemApi(numero, texto);
}

/**
 * Resolve LID para telefone real
 * Estratégia: 1) Cache em memória → 2) Banco de dados → 3) Evolution API
 * @param {string} lid - LID sem sufixo (ex: "133440506744833")
 * @param {string} grupoJid - JID do grupo WhatsApp (ex: "xxx@g.us")
 * @returns {Promise<string|null>} - Telefone real ou null
 */
async function resolverLidParaTelefone(lid, grupoJid) {
    // 1. Verificar cache em memória
    if (lidCache.has(lid)) {
        const telefone = lidCache.get(lid);
        console.log(`📋 LID resolvido via cache: ${lid} → ${telefone}`);
        return telefone;
    }

    // 2. Verificar banco de dados
    const { data: mapping } = await supabase
        .from('lid_mapping')
        .select('telefone')
        .eq('lid', lid)
        .limit(1)
        .single();

    if (mapping) {
        // Encontrou no banco, popular cache
        lidCache.set(lid, mapping.telefone);
        console.log(`💾 LID resolvido via banco: ${lid} → ${mapping.telefone}`);
        return mapping.telefone;
    }

    // 3. Buscar participantes do grupo via Evolution API e atualizar mapeamentos
    console.log(`🌐 LID não encontrado, buscando participantes do grupo via API...`);
    const telefoneResolvido = await sincronizarParticipantesGrupo(grupoJid);

    // Verificar se o LID agora está no cache após sincronização
    if (lidCache.has(lid)) {
        const telefone = lidCache.get(lid);
        console.log(`🔗 LID resolvido via API: ${lid} → ${telefone}`);
        return telefone;
    }

    console.log(`❌ Não foi possível resolver LID: ${lid}`);
    return null;
}

/**
 * Sincroniza participantes do grupo: busca da Evolution API,
 * salva no banco de dados, e popula o cache em memória
 * @param {string} grupoJid - JID do grupo WhatsApp
 * @returns {Promise<void>}
 */
async function sincronizarParticipantesGrupo(grupoJid) {
    try {
        const participantes = await buscarParticipantes(grupoJid);

        if (!participantes || participantes.length === 0) {
            console.log(`⚠️ Nenhum participante retornado pela API para ${grupoJid}`);
            return;
        }

        for (const p of participantes) {
            // O participante pode ter um id no formato "numero@s.whatsapp.net" 
            // e/ou um lid no formato "lid_id@lid"
            const id = p.id || '';
            const lid = p.lid || '';

            let telefone = null;
            let lidId = null;

            // Extrair telefone do id (@s.whatsapp.net)
            if (id.includes('@s.whatsapp.net')) {
                telefone = id.replace('@s.whatsapp.net', '').replace(/\D/g, '');
            }

            // Extrair LID
            if (lid.includes('@lid')) {
                lidId = lid.replace('@lid', '').replace(/\D/g, '');
            } else if (id.includes('@lid')) {
                lidId = id.replace('@lid', '').replace(/\D/g, '');
            }

            // Se temos ambos (telefone e LID), salvar mapeamento
            if (telefone && lidId) {
                // Salvar no banco primeiro
                await supabase
                    .from('lid_mapping')
                    .upsert({
                        lid: lidId,
                        telefone,
                        grupo_whatsapp_id: grupoJid,
                        atualizado_em: new Date().toISOString()
                    }, { onConflict: 'lid,grupo_whatsapp_id' });

                // Depois popular cache
                lidCache.set(lidId, telefone);
                console.log(`🗺️ Mapeamento salvo: ${lidId} → ${telefone}`);
            }
        }
    } catch (error) {
        console.error('❌ Erro ao sincronizar participantes:', error.message);
    }
}

/**
 * Gera uma senha descartável de 6 dígitos
 * @returns {string}
 */
function gerarSenhaDescartavel() {
    return String(Math.floor(100000 + Math.random() * 900000));
}

/**
 * Webhook para receber mensagens da Evolution API
 */
app.post('/webhook', async (req, res) => {
    try {
        // Validar secret se configurado
        if (WEBHOOK_SECRET && req.headers['x-webhook-secret'] !== WEBHOOK_SECRET) {
            return res.status(401).json({ error: 'Unauthorized' });
        }

        const { data, event } = req.body;

        // Rotear para handler de atualização de participantes
        if (event === 'group-participants.update' || event === 'GROUP_PARTICIPANTS_UPDATE') {
            return await handleGroupParticipantsUpdate(data, res);
        }

        // Ignorar mensagens enviadas pelo próprio bot
        if (data?.key?.fromMe) {
            return res.json({ success: true, ignored: true });
        }

        // Extrair informações da mensagem
        const remoteJid = data?.key?.remoteJid;
        const texto = data?.message?.conversation || data?.message?.extendedTextMessage?.text;
        const isGroup = remoteJid?.includes('@g.us');
        const grupoId = isGroup ? remoteJid : null;

        // Para identificar o usuário: extrair número do participant (em grupos) ou do remoteJid
        const participant = data?.key?.participant;
        const isLidParticipant = participant?.includes('@lid');

        // === RESOLUÇÃO DE TELEFONE ===
        let telefone = null;
        let whatsappId = remoteJid; // Default: responder no mesmo chat

        if (isGroup && participant) {
            if (isLidParticipant) {
                // Participant é um LID — precisa resolver
                const lidId = participant.replace('@lid', '').replace(/\D/g, '');
                console.log(`🔑 Participante com LID detectado: ${lidId}`);

                // Verificar se há participantAlt no payload (telefone real)
                const participantAlt = data?.participantAlt || data?.key?.participantAlt;
                if (participantAlt && participantAlt.includes('@s.whatsapp.net')) {
                    telefone = participantAlt.replace('@s.whatsapp.net', '').replace(/\D/g, '');
                    console.log(`📱 Telefone obtido via participantAlt: ${telefone}`);

                    // Salvar mapeamento no banco e cache para uso futuro
                    await supabase
                        .from('lid_mapping')
                        .upsert({
                            lid: lidId,
                            telefone,
                            grupo_whatsapp_id: remoteJid,
                            atualizado_em: new Date().toISOString()
                        }, { onConflict: 'lid,grupo_whatsapp_id' });
                    lidCache.set(lidId, telefone);
                } else {
                    // Sem participantAlt, resolver via cache → banco → API
                    telefone = await resolverLidParaTelefone(lidId, remoteJid);
                }
            } else {
                // Participant no formato normal @s.whatsapp.net
                telefone = participant
                    .replace('@s.whatsapp.net', '')
                    .replace(/\D/g, '');
            }
        } else if (!isGroup) {
            // Mensagem direta (1:1)
            const isLidRemote = remoteJid?.includes('@lid');
            if (isLidRemote) {
                const lidId = remoteJid.replace('@lid', '').replace(/\D/g, '');
                // Verificar senderPn para número real
                const senderPn = data?.senderPn;
                if (senderPn && /^\d+$/.test(senderPn.replace(/\D/g, ''))) {
                    telefone = senderPn.replace(/\D/g, '');
                    whatsappId = `${telefone}@s.whatsapp.net`;
                    console.log(`🔄 LID em chat direto, usando senderPn: ${telefone}`);
                } else {
                    telefone = await resolverLidParaTelefone(lidId, null);
                    if (telefone) {
                        whatsappId = `${telefone}@s.whatsapp.net`;
                    }
                }
            } else {
                telefone = remoteJid
                    ?.replace('@s.whatsapp.net', '')
                    ?.replace(/\D/g, '');
            }
        }

        if (!texto || !telefone) {
            if (!telefone && texto) {
                console.log(`⚠️ Não foi possível resolver o telefone do remetente`);
            }
            return res.json({ success: true, skipped: true });
        }

        // Filtrar grupos não permitidos (whitelist)
        if (isGroup && !isGroupAllowed(remoteJid)) {
            console.log(`⏭️ Ignorando grupo não autorizado: ${remoteJid}`);
            return res.json({ success: true, filtered: true });
        }

        console.log(`📩 Mensagem de ${telefone}: ${texto}`);

        // Buscar membro
        const membro = await getOrCreateMembro(telefone, whatsappId);

        // Se não encontrar membro, tentar onboarding
        if (!membro) {
            const resposta = await processarOnboarding(texto, telefone, grupoId);
            await enviarMensagem(whatsappId, resposta);
            return res.json({ success: true, action: 'onboarding' });
        }

        // Detectar intenção
        const intent = detectIntent(texto);
        console.log(`🎯 Intenção detectada:`, intent);

        // Processar ação
        let resposta = '';

        switch (intent.action) {
            case 'confirmar':
                resposta = await confirmarPresenca(membro.id, membro.grupo_id, intent.dias);
                break;

            case 'cancelar':
                // Motorista pode cancelar a qualquer momento, membros respeitam limite
                resposta = await cancelarPresenca(membro.id, membro.grupo_id, intent.dias, ['ida'], membro.is_motorista);
                break;

            case 'atraso':
                if (intent.minutos) {
                    resposta = await registrarAtraso(membro.id, membro.grupo_id, intent.minutos);
                } else {
                    resposta = '⏰ Quantos minutos de atraso? Ex: "vou atrasar 10 min"';
                }
                break;

            case 'status':
                resposta = await getStatusHoje(membro.grupo_id);
                break;

            case 'saldo':
                resposta = await getMensagemSaldo(membro.id, membro.nome);
                break;

            case 'saudacao':
                // Saudação rápida e amigável
                resposta = `${getSaudacao()}, ${membro.nome}! 👋\n\nPosso te ajudar com sua carona. Digite *ajuda* para ver o que posso fazer!`;
                break;

            case 'ajuda':
                resposta = getMensagemAjuda(membro.nome);
                break;

            default:
                resposta = `🤔 Não entendi, ${membro.nome}. Tente:\n• *"vou hoje"* - confirmar presença\n• *"não vou"* - cancelar\n• *"quem vai?"* - ver status\n• *"ajuda"* - ver comandos`;
        }

        // Logar atividade
        await logAtividade(membro.id, intent.action, texto, intent.action, intent.confidence);

        // Enviar resposta
        await enviarMensagem(whatsappId, resposta);

        res.json({ success: true, action: intent.action });

    } catch (error) {
        console.error('Erro no webhook:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

/**
 * Handler para evento GROUP_PARTICIPANTS_UPDATE
 * Auto-onboarding: quando um novo membro entra no grupo, cria conta automaticamente
 * @param {object} data - Dados do evento
 * @param {object} res - Response do Express
 */
async function handleGroupParticipantsUpdate(data, res) {
    try {
        const action = data?.action; // 'add', 'remove', 'promote', 'demote'
        const participants = data?.participants || [];
        const groupJid = data?.id || data?.groupJid;

        console.log(`👥 Evento de participantes: ${action} em ${groupJid} — ${participants.length} participantes`);

        if (action !== 'add' || !groupJid) {
            return res.json({ success: true, ignored: true });
        }

        // Buscar grupo no banco pelo whatsapp_group_id
        const { data: grupo } = await supabase
            .from('grupos')
            .select('id, nome, motorista_id')
            .eq('whatsapp_group_id', groupJid)
            .single();

        if (!grupo) {
            console.log(`⚠️ Grupo ${groupJid} não encontrado no banco`);
            return res.json({ success: true, ignored: true });
        }

        // Buscar dados do motorista para comparar telefone
        let motoristaTelefone = null;
        if (grupo.motorista_id) {
            const { data: motorista } = await supabase
                .from('membros')
                .select('telefone')
                .eq('id', grupo.motorista_id)
                .single();
            motoristaTelefone = motorista?.telefone;
        }

        for (const participantJid of participants) {
            // Extrair telefone do JID do participante
            let telefone = null;

            if (participantJid.includes('@s.whatsapp.net')) {
                telefone = participantJid.replace('@s.whatsapp.net', '').replace(/\D/g, '');
            } else if (participantJid.includes('@lid')) {
                // Participante é LID — tentar resolver
                const lidId = participantJid.replace('@lid', '').replace(/\D/g, '');
                telefone = await resolverLidParaTelefone(lidId, groupJid);

                if (!telefone) {
                    console.log(`⚠️ Não foi possível resolver telefone do novo participante LID: ${lidId}`);
                    continue;
                }
            }

            if (!telefone) continue;

            // Verificar se é o motorista (já cadastrado, ignorar)
            if (motoristaTelefone) {
                const motorFormats = getPhoneLookupFormats(motoristaTelefone);
                const participantFormats = getPhoneLookupFormats(telefone);
                const isMotorista = motorFormats.some(f => participantFormats.includes(f));

                if (isMotorista) {
                    console.log(`🚗 Motorista entrou no grupo, ignorando auto-onboarding: ${telefone}`);
                    continue;
                }
            }

            // Verificar se membro já existe
            const membroExistente = await getOrCreateMembro(telefone, `${telefone}@s.whatsapp.net`);
            if (membroExistente) {
                console.log(`👤 Membro já existe: ${membroExistente.nome} (${telefone})`);
                continue;
            }

            // Auto-onboarding: criar membro com senha descartável
            const senhaDescartavel = gerarSenhaDescartavel();
            const resultado = await autoOnboardMembro(telefone, groupJid, senhaDescartavel);

            if (resultado) {
                console.log(`✨ Novo membro auto-cadastrado: ${telefone}`);

                // Enviar mensagem privada com credenciais
                const mensagemPrivada = `👋 Bem-vindo ao grupo *${grupo.nome}*!\n\n` +
                    `Sou o *Cajurona*, seu assistente de caronas. 🚗\n\n` +
                    `📱 *Seus dados de acesso ao painel:*\n` +
                    `• Telefone: ${telefone}\n` +
                    `• Senha temporária: *${senhaDescartavel}*\n\n` +
                    `🔗 Acesse o painel para ver detalhes da carona.\n\n` +
                    `💡 No grupo, digite *ajuda* para ver os comandos disponíveis!`;

                await enviarMensagem(`${telefone}@s.whatsapp.net`, mensagemPrivada, false);
            }
        }

        // Após adicionar novos membros, sincronizar mapeamentos LID do grupo
        await sincronizarParticipantesGrupo(groupJid);

        return res.json({ success: true, action: 'participants_update' });
    } catch (error) {
        console.error('❌ Erro ao processar atualização de participantes:', error);
        return res.status(500).json({ error: 'Internal server error' });
    }
}

/**
 * API: Criar grupo WhatsApp e retornar invite link
 * Chamado pelo frontend após criar grupo no banco
 */
app.post('/api/create-whatsapp-group', async (req, res) => {
    try {
        const { grupoId } = req.body;

        if (!grupoId) {
            return res.status(400).json({ error: 'grupoId é obrigatório' });
        }

        // Buscar dados do grupo
        const { data: grupo, error: grupoError } = await supabase
            .from('grupos')
            .select('id, nome, motorista_id')
            .eq('id', grupoId)
            .single();

        if (grupoError || !grupo) {
            return res.status(404).json({ error: 'Grupo não encontrado' });
        }

        // Buscar telefone do motorista para adicionar como participante
        let participantes = [];
        if (grupo.motorista_id) {
            const { data: motorista } = await supabase
                .from('membros')
                .select('telefone')
                .eq('id', grupo.motorista_id)
                .single();

            if (motorista?.telefone) {
                participantes = [motorista.telefone];
            }
        }

        // Criar grupo no WhatsApp (com o mesmo nome do banco)
        const result = await criarGrupoWhatsApp(grupo.nome, participantes);

        // Extrair groupJid da resposta
        const groupJid = result?.id || result?.groupId || result?.jid;

        if (!groupJid) {
            return res.status(500).json({ error: 'Não foi possível obter o ID do grupo criado' });
        }

        // Buscar invite link
        let inviteLink = null;
        try {
            inviteLink = await buscarInviteLink(groupJid);
        } catch (e) {
            console.error('⚠️ Erro ao buscar invite link:', e.message);
        }

        // Salvar no banco
        await supabase
            .from('grupos')
            .update({
                whatsapp_group_id: groupJid,
                invite_link: inviteLink,
                invite_link_atualizado_em: new Date().toISOString()
            })
            .eq('id', grupoId);

        console.log(`✅ Grupo WhatsApp criado: ${grupo.nome} (${groupJid})`);

        res.json({
            success: true,
            groupJid,
            inviteLink
        });

    } catch (error) {
        console.error('❌ Erro ao criar grupo WhatsApp:', error);
        res.status(500).json({ error: error.message || 'Erro ao criar grupo WhatsApp' });
    }
});

/**
 * API: Buscar invite link atualizado de um grupo
 * Renova o link se necessário e retorna o link ativo
 */
app.get('/api/invite-link/:grupoId', async (req, res) => {
    try {
        const { grupoId } = req.params;

        // Buscar grupo no banco
        const { data: grupo } = await supabase
            .from('grupos')
            .select('whatsapp_group_id, invite_link, invite_link_atualizado_em')
            .eq('id', grupoId)
            .single();

        if (!grupo || !grupo.whatsapp_group_id) {
            return res.status(404).json({ error: 'Grupo sem WhatsApp vinculado' });
        }

        // Verificar se o link precisa ser renovado (mais de 24h)
        const agora = new Date();
        const ultimaAtualizacao = grupo.invite_link_atualizado_em
            ? new Date(grupo.invite_link_atualizado_em)
            : null;
        const precisaRenovar = !grupo.invite_link ||
            !ultimaAtualizacao ||
            (agora - ultimaAtualizacao) > 24 * 60 * 60 * 1000; // 24h

        let inviteLink = grupo.invite_link;

        if (precisaRenovar) {
            console.log(`🔄 Renovando invite link para grupo ${grupoId}...`);
            try {
                inviteLink = await buscarInviteLink(grupo.whatsapp_group_id);

                // Atualizar no banco
                await supabase
                    .from('grupos')
                    .update({
                        invite_link: inviteLink,
                        invite_link_atualizado_em: new Date().toISOString()
                    })
                    .eq('id', grupoId);
            } catch (e) {
                console.error('⚠️ Erro ao renovar link, usando último disponível:', e.message);
                // Usar o link antigo se não conseguir renovar
            }
        }

        res.json({
            success: true,
            inviteLink,
            atualizadoEm: grupo.invite_link_atualizado_em
        });

    } catch (error) {
        console.error('❌ Erro ao buscar invite link:', error);
        res.status(500).json({ error: 'Erro ao buscar invite link' });
    }
});

/**
 * Health check
 */
app.get('/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

/**
 * Rota para testes (ping/pong)
 */
app.post('/test', async (req, res) => {
    const { numero, texto } = req.body;

    if (!numero || !texto) {
        return res.status(400).json({ error: 'numero e texto são obrigatórios' });
    }

    const intent = detectIntent(texto);
    res.json({ intent, msgRecebida: texto });
});

app.listen(PORT, () => {
    console.log(`🤖 Bot server running on port ${PORT}`);
    console.log(`📡 Webhook: http://localhost:${PORT}/webhook`);
    console.log(`📡 API: http://localhost:${PORT}/api/create-whatsapp-group`);
    console.log(`📡 API: http://localhost:${PORT}/api/invite-link/:grupoId`);
    console.log(`❤️ Health: http://localhost:${PORT}/health`);
});
