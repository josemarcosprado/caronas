# 🚗 Cajurona

Sistema de gerenciamento de caronas recorrentes para grupos universitários.

## Stack

- **Backend**: Supabase (PostgreSQL + Edge Functions)
- **Bot WhatsApp**: Evolution API + Express.js
- **Frontend**: React + Vite (PWA)

## Estrutura

```
caronas/
├── src/
│   ├── bot/              # Servidor do bot WhatsApp
│   │   ├── server.js     # Express webhook handler
│   │   ├── intentParser.js # Parser NLP com regex
│   │   └── handlers.js   # Lógica de comandos
│   │
│   ├── components/       # Componentes React
│   │   ├── Dashboard.jsx # Visualização semanal
│   │   └── Login.jsx     # Login do motorista
│   │
│   ├── lib/              # Utilitários
│   │   ├── supabase.js   # Cliente Supabase
│   │   └── database.types.js
│   │
│   ├── App.jsx           # Rotas
│   ├── main.jsx          # Entry point
│   └── index.css         # Design system
│
├── supabase/
│   └── schema.sql        # Schema do banco
│
├── index.html
├── vite.config.js
└── package.json
```

## Setup

### 1. Instalar dependências

```bash
npm install
```

### 2. Configurar Supabase

1. Crie um projeto em [supabase.com](https://supabase.com)
2. Execute o `supabase/schema.sql` no SQL Editor
3. Copie `.env.example` para `.env` e preencha as credenciais

### 3. Configurar Evolution API

1. Deploy Evolution API (Railway, VPS, etc.)
2. Configure o webhook para `http://SEU_IP:3001/webhook`
3. Adicione as credenciais no `.env`

### 4. Rodar localmente

```bash
# Frontend (Dashboard)
npm run dev

# Bot WhatsApp
npm run bot
```

## Comandos do Bot

| Comando | Exemplos |
|---------|----------|
| Confirmar | "vou hoje", "confirmado seg e qua" |
| Cancelar | "não vou hoje", "fora terça" |
| Atraso | "vou atrasar 10min" |
| Status | "quem vai?", "como tá hoje?" |
| Ajuda | "ajuda" |

## URLs do Dashboard

- **Público**: `/{grupoId}` - Visualização read-only
- **Admin**: `/admin/{grupoId}` - Edição (requer login)

## Licença

MIT
