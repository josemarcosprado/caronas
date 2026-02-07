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
    getMensagemSaldo
} from './handlers.js';

const app = express();
app.use(express.json());

const PORT = process.env.BOT_PORT || 3001;
const WEBHOOK_SECRET = process.env.BOT_WEBHOOK_SECRET;
const EVOLUTION_API_URL = process.env.EVOLUTION_API_URL;
const EVOLUTION_API_KEY = process.env.EVOLUTION_API_KEY;
const EVOLUTION_INSTANCE = process.env.EVOLUTION_INSTANCE;

// Whitelist de grupos permitidos (vazio = aceita todos)
// Formato: IDs separados por vírgula, ex: "5511999998888-1234567890@g.us,..."
const ALLOWED_GROUPS = process.env.ALLOWED_GROUPS?.split(',').filter(Boolean) || [];

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
 * Envia mensagem via Evolution API
 * @param {string} numero - Número do destinatário
 * @param {string} texto - Mensagem a enviar
 */
async function enviarMensagem(numero, texto) {
    try {
        const response = await fetch(`${EVOLUTION_API_URL}/message/sendText/${EVOLUTION_INSTANCE}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'apikey': EVOLUTION_API_KEY
            },
            body: JSON.stringify({
                number: numero,
                text: texto
            })
        });

        if (!response.ok) {
            console.error('Erro ao enviar mensagem:', await response.text());
        }
    } catch (error) {
        console.error('Erro ao enviar mensagem:', error);
    }
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

        const { data } = req.body;

        // Ignorar mensagens enviadas pelo próprio bot
        if (data?.key?.fromMe) {
            return res.json({ success: true, ignored: true });
        }

        // Extrair informações da mensagem
        const remoteJid = data?.key?.remoteJid;
        const texto = data?.message?.conversation || data?.message?.extendedTextMessage?.text;
        const isGroup = remoteJid?.includes('@g.us');
        const grupoId = isGroup ? remoteJid : null;
        const isLid = remoteJid?.includes('@lid');

        // senderPn pode conter o número real quando o remoteJid é LID
        const senderPn = data?.senderPn || data?.pushName;

        // Para responder: preferir número real se disponível, senão usar remoteJid
        let whatsappId = remoteJid;
        if (isLid && senderPn && /^\d+$/.test(senderPn.replace(/\D/g, ''))) {
            // Se temos um número real no senderPn, usar ele com formato correto
            const numeroLimpo = senderPn.replace(/\D/g, '');
            whatsappId = `${numeroLimpo}@s.whatsapp.net`;
            console.log(`🔄 LID detectado, usando número real: ${whatsappId}`);
        }

        // Para identificar o usuário: extrair número do participant (em grupos) ou do remoteJid
        const participant = data?.key?.participant;
        const telefone = (participant || remoteJid)
            ?.replace('@s.whatsapp.net', '')
            ?.replace('@g.us', '')
            ?.replace('@lid', '')
            ?.replace(/[^0-9]/g, ''); // Manter só números

        if (!texto || !telefone) {
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
    console.log(`❤️ Health: http://localhost:${PORT}/health`);
});
