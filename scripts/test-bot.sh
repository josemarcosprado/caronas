#!/bin/bash
# Script para testar o bot localmente
# Uso: ./scripts/test-bot.sh

BOT_URL="${BOT_URL:-http://localhost:3001}"

echo "🧪 Testando Bot Cajurona..."
echo "📍 URL: $BOT_URL"
echo ""

# 1. Health check
echo "1️⃣ Health Check..."
health=$(curl -s "$BOT_URL/health")
echo "   Resposta: $health"
echo ""

# 2. Testar detecção de intenções
echo "2️⃣ Testando detecção de intenções..."
echo ""

test_intent() {
    local msg="$1"
    local expected="$2"
    result=$(curl -s -X POST "$BOT_URL/test" \
        -H "Content-Type: application/json" \
        -d "{\"numero\": \"5579991248127\", \"texto\": \"$msg\"}")
    action=$(echo "$result" | grep -o '"action":"[^"]*"' | cut -d'"' -f4)
    echo "   \"$msg\" → $action (esperado: $expected)"
}

test_intent "vou hoje" "confirmar"
test_intent "não vou amanhã" "cancelar"
test_intent "quem vai?" "status"
test_intent "vou atrasar 10 min" "atraso"
test_intent "quanto devo?" "saldo"
test_intent "ajuda" "ajuda"

echo ""
echo "✅ Testes concluídos!"
echo ""
echo "📝 Próximos passos:"
echo "   1. Configure o webhook na Evolution API"
echo "   2. Adicione grupos na whitelist (ALLOWED_GROUPS no .env)"
echo "   3. Envie uma mensagem de teste no WhatsApp"
