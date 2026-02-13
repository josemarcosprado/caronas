/**
 * Módulo de integração com a Evolution API
 * Encapsula todas as chamadas HTTP para a Evolution API
 */

import 'dotenv/config';

const EVOLUTION_API_URL = process.env.EVOLUTION_API_URL;
const EVOLUTION_API_KEY = process.env.EVOLUTION_API_KEY;
const EVOLUTION_INSTANCE = process.env.EVOLUTION_INSTANCE;

/**
 * Helper para fazer requisições à Evolution API
 * @param {string} path - Caminho da API (ex: /group/create)
 * @param {object} [options] - Opções do fetch
 * @returns {Promise<any>}
 */
async function evolutionFetch(path, options = {}) {
    const url = `${EVOLUTION_API_URL}${path}/${EVOLUTION_INSTANCE}`;

    const response = await fetch(url, {
        ...options,
        headers: {
            'Content-Type': 'application/json',
            'apikey': EVOLUTION_API_KEY,
            ...options.headers
        }
    });

    if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Evolution API error (${response.status}): ${errorText}`);
    }

    return response.json();
}

/**
 * Envia mensagem de texto via Evolution API
 * @param {string} numero - Número do destinatário (com ou sem @s.whatsapp.net)
 * @param {string} texto - Texto da mensagem
 */
export async function enviarMensagem(numero, texto) {
    console.log(`📤 Tentando enviar mensagem para ${numero}:`, texto.substring(0, 50) + '...');
    try {
        const result = await evolutionFetch('/message/sendText', {
            method: 'POST',
            body: JSON.stringify({
                number: numero,
                text: texto
            })
        });
        console.log(`✅ Mensagem enviada com sucesso para ${numero}:`, JSON.stringify(result));
    } catch (error) {
        console.error(`❌ Erro ao enviar mensagem para ${numero}:`, error.message);
        console.error('Stack:', error.stack);
    }
}

/**
 * Cria um grupo no WhatsApp via Evolution API
 * Tenta adicionar o motorista; se falhar, cria grupo vazio
 * @param {string} nomeGrupo - Nome do grupo
 * @param {string[]} participantes - Array de números de telefone dos participantes
 * @returns {Promise<{groupJid: string, participants: Array}>}
 */
export async function criarGrupoWhatsApp(nomeGrupo, participantes = []) {
    try {
        // Tentar criar com participantes
        const result = await evolutionFetch('/group/create', {
            method: 'POST',
            body: JSON.stringify({
                subject: nomeGrupo,
                participants: participantes
            })
        });

        console.log(`✅ Grupo WhatsApp criado: ${nomeGrupo}`);
        return result;
    } catch (error) {
        // Se falhar com participantes (ex: motorista bloqueou ser adicionado),
        // criar grupo vazio e disponibilizar apenas o link de convite
        if (participantes.length > 0) {
            console.warn(`⚠️ Falha ao adicionar participantes, criando grupo vazio: ${error.message}`);
            try {
                const result = await evolutionFetch('/group/create', {
                    method: 'POST',
                    body: JSON.stringify({
                        subject: nomeGrupo,
                        participants: []
                    })
                });

                console.log(`✅ Grupo WhatsApp criado sem participantes: ${nomeGrupo}`);
                return result;
            } catch (retryError) {
                console.error('❌ Erro ao criar grupo vazio:', retryError.message);
                throw retryError;
            }
        }

        console.error('❌ Erro ao criar grupo WhatsApp:', error.message);
        throw error;
    }
}

/**
 * Busca o link de convite de um grupo WhatsApp
 * @param {string} groupJid - JID do grupo (ex: 123456789@g.us)
 * @returns {Promise<string>} - Link de convite completo (https://chat.whatsapp.com/...)
 */
export async function buscarInviteLink(groupJid) {
    try {
        const response = await fetch(
            `${EVOLUTION_API_URL}/group/invite-code/${EVOLUTION_INSTANCE}?groupJid=${encodeURIComponent(groupJid)}`,
            {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json',
                    'apikey': EVOLUTION_API_KEY
                }
            }
        );

        if (!response.ok) {
            throw new Error(`Erro ao buscar invite code: ${await response.text()}`);
        }

        const data = await response.json();
        const inviteCode = data.inviteCode || data.invite || data.code || data;

        // Construir link completo se recebeu apenas o código
        if (typeof inviteCode === 'string' && !inviteCode.startsWith('http')) {
            return `https://chat.whatsapp.com/${inviteCode}`;
        }

        return inviteCode;
    } catch (error) {
        console.error('❌ Erro ao buscar invite link:', error.message);
        throw error;
    }
}

/**
 * Busca os participantes de um grupo WhatsApp
 * Retorna array com LIDs e números de telefone associados
 * @param {string} groupJid - JID do grupo
 * @returns {Promise<Array<{id: string, admin?: string}>>}
 */
export async function buscarParticipantes(groupJid) {
    try {
        const response = await fetch(
            `${EVOLUTION_API_URL}/group/participants/${EVOLUTION_INSTANCE}?groupJid=${encodeURIComponent(groupJid)}`,
            {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json',
                    'apikey': EVOLUTION_API_KEY
                }
            }
        );

        if (!response.ok) {
            throw new Error(`Erro ao buscar participantes: ${await response.text()}`);
        }

        const data = await response.json();
        // A API pode retornar { participants: [...] } ou diretamente o array
        return data.participants || data || [];
    } catch (error) {
        console.error('❌ Erro ao buscar participantes do grupo:', error.message);
        return [];
    }
}

/**
 * Revoga o invite link atual e gera um novo
 * @param {string} groupJid - JID do grupo
 * @returns {Promise<string>} - Novo link de convite
 */
export async function renovarInviteLink(groupJid) {
    try {
        // Revogar o código atual
        const response = await fetch(
            `${EVOLUTION_API_URL}/group/revoke-invite-code/${EVOLUTION_INSTANCE}?groupJid=${encodeURIComponent(groupJid)}`,
            {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'apikey': EVOLUTION_API_KEY
                }
            }
        );

        if (!response.ok) {
            console.warn('⚠️ Erro ao revogar invite, tentando buscar novo...');
        }

        // Buscar novo link
        return await buscarInviteLink(groupJid);
    } catch (error) {
        console.error('❌ Erro ao renovar invite link:', error.message);
        // Fallback: tentar apenas buscar o link atual
        return await buscarInviteLink(groupJid);
    }
}

/**
 * Promove um participante a administrador do grupo WhatsApp
 * @param {string} groupJid - JID do grupo (ex: 123456789@g.us)
 * @param {string} participantJid - JID do participante (ex: 5579999998888@s.whatsapp.net)
 * @returns {Promise<object>}
 */
export async function promoverParaAdmin(groupJid, participantJid) {
    try {
        const result = await evolutionFetch('/group/updateParticipant', {
            method: 'PUT',
            body: JSON.stringify({
                groupJid,
                action: 'promote',
                participants: [participantJid]
            })
        });

        console.log(`👑 Participante promovido a admin: ${participantJid} em ${groupJid}`);
        return result;
    } catch (error) {
        console.error('❌ Erro ao promover participante a admin:', error.message);
        throw error;
    }
}
