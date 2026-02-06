/**
 * Parser de Intenções - NLP Simples com Regex
 * Detecta comandos do usuário via WhatsApp
 */

const DIAS_MAP = {
    'seg': ['seg', 'segunda', 'monday', 'mon'],
    'ter': ['ter', 'terca', 'terça', 'tuesday', 'tue'],
    'qua': ['qua', 'quarta', 'wednesday', 'wed'],
    'qui': ['qui', 'quinta', 'thursday', 'thu'],
    'sex': ['sex', 'sexta', 'friday', 'fri']
};

const PATTERNS = {
    confirmar: [
        /\b(vou|confirmado?|to dentro|confirmo|vou sim|estarei|participo)\b/i,
        /\b(pode contar|conta comigo|bora|to indo)\b/i
    ],
    cancelar: [
        /\b(não vou|nao vou|cancela|fora|desisto|não posso|nao posso)\b/i,
        /\b(não vai dar|nao vai dar|não dá|nao da|sem mim)\b/i
    ],
    atraso: [
        /\b(atras[oa]r?|atrasado?|chego|demora|delay)\b/i,
        /(\d{1,2})\s*(min|minutos?|h|hora)/i
    ],
    status: [
        /\b(quem vai|como ta|como tá|status|lista|confirmados?)\b/i,
        /\b(quem confirmou|quantos vão|quantos vao)\b/i
    ],
    saldo: [
        /\b(quanto devo|meu saldo|devo quanto|minha divida|minha dívida)\b/i,
        /\b(saldo|débito|debito|pendente|quanto tenho)\b/i
    ],
    ajuda: [
        /\b(ajuda|help|comandos?|menu|opcoes|opções)\b/i
    ],
    saudacao: [
        /^(oi|olá|ola|hey|bom dia|boa tarde|boa noite|e ai|eae)$/i
    ]
};

/**
 * Extrai dias mencionados na mensagem
 * @param {string} text 
 * @returns {string[]} Array de dias ['seg', 'qua']
 */
function extractDias(text) {
    const dias = [];
    const lowerText = text.toLowerCase();

    // Checar "hoje"
    if (/\bhoje\b/i.test(text)) {
        const hoje = new Date();
        const dow = hoje.getDay();
        const diaMap = { 1: 'seg', 2: 'ter', 3: 'qua', 4: 'qui', 5: 'sex' };
        if (diaMap[dow]) dias.push(diaMap[dow]);
    }

    // Checar "amanhã"
    if (/\b(amanha|amanhã)\b/i.test(text)) {
        const amanha = new Date();
        amanha.setDate(amanha.getDate() + 1);
        const dow = amanha.getDay();
        const diaMap = { 1: 'seg', 2: 'ter', 3: 'qua', 4: 'qui', 5: 'sex' };
        if (diaMap[dow]) dias.push(diaMap[dow]);
    }

    // Checar dias específicos
    for (const [dia, aliases] of Object.entries(DIAS_MAP)) {
        for (const alias of aliases) {
            if (lowerText.includes(alias)) {
                if (!dias.includes(dia)) dias.push(dia);
                break;
            }
        }
    }

    // Checar "semana toda" ou "todos os dias"
    if (/\b(semana toda|todos os dias|a semana inteira)\b/i.test(text)) {
        return ['seg', 'ter', 'qua', 'qui', 'sex'];
    }

    return dias;
}

/**
 * Extrai minutos de atraso da mensagem
 * @param {string} text 
 * @returns {number|null}
 */
function extractMinutosAtraso(text) {
    // "10 min", "10min", "10 minutos"
    const minMatch = text.match(/(\d{1,2})\s*(min|minutos?)/i);
    if (minMatch) return parseInt(minMatch[1], 10);

    // "chego 7:20" comparado com horário padrão (assume 7:00)
    const horaMatch = text.match(/chego\s+(\d{1,2})[:\s]?(\d{2})?/i);
    if (horaMatch) {
        const hora = parseInt(horaMatch[1], 10);
        const minuto = parseInt(horaMatch[2] || '0', 10);
        // Assume horário padrão 7:00
        const atraso = ((hora - 7) * 60) + minuto;
        if (atraso > 0 && atraso < 120) return atraso;
    }

    return null;
}

/**
 * Detecta a intenção principal da mensagem
 * @param {string} text 
 * @returns {{ action: string, dias: string[], minutos: number|null, confidence: number }}
 */
export function detectIntent(text) {
    if (!text || typeof text !== 'string') {
        return { action: 'desconhecido', dias: [], minutos: null, confidence: 0 };
    }

    const cleanText = text.trim();

    // Testar cada padrão
    for (const [action, patterns] of Object.entries(PATTERNS)) {
        for (const pattern of patterns) {
            if (pattern.test(cleanText)) {
                const dias = extractDias(cleanText);
                const minutos = action === 'atraso' ? extractMinutosAtraso(cleanText) : null;

                // Calcular confiança baseada em match + contexto
                let confidence = 0.8;
                if (dias.length > 0) confidence += 0.1;
                if (action === 'atraso' && minutos) confidence += 0.1;

                return {
                    action,
                    dias: dias.length > 0 ? dias : (action === 'confirmar' || action === 'cancelar' ? ['hoje'] : []),
                    minutos,
                    confidence: Math.min(confidence, 1)
                };
            }
        }
    }

    return { action: 'desconhecido', dias: [], minutos: null, confidence: 0 };
}

/**
 * Gera mensagem de ajuda
 * @returns {string}
 */
export function getMensagemAjuda() {
    return `🚗 *Cajurona - Comandos*

✅ *Confirmar presença:*
"vou hoje", "confirmado seg e qua", "to dentro"

❌ *Cancelar:*
"não vou hoje", "fora terça", "cancela"

⏰ *Avisar atraso:*
"vou atrasar 10min", "chego 7:20"

📋 *Ver status:*
"quem vai?", "status", "como tá hoje?"

💰 *Ver saldo:*
"quanto devo?", "meu saldo"

💡 Você pode usar: seg, ter, qua, qui, sex, hoje, amanhã`;
}
