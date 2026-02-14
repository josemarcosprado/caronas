# 🚗# Cajurona 🚐

Sistema de gerenciamento de caronas recorrentes para estudantes universitários, focado em substituir planilhas e grupos de WhatsApp por uma interface moderna e automatizada.

![Cajurona App](public/pwa-512x512.png)

## 🚀 Funcionalidades

- **Gestão de Caronas**: Visualização semanal de idas e voltas.
- **Confirmação Automática**: Integração com bot de WhatsApp para confirmações.
- **Financeiro**: Cálculo automático de debts e créditos por viagem.
- **PWA**: Instalável no celular, funciona offline (visualização).
- **Admin**: Painel para aprovação de motoristas e gestão de grupos.

## 🛠 Tech Stack

- **Frontend**: React, Vite, TailwindCSS (via Styled Components/CSS Modules patterns).
- **Backend/Db**: Supabase (PostgreSQL, Auth, Realtime).
- **Bot**: Node.js, Express, [Evolution API](https://github.com/EvolutionAPI/evolution-api) (WhatsApp).
- **Deploy**: Vercel (Frontend).

## ⚡️ Instalação e Uso Local

### Pré-requisitos
- Node.js 18+
- Conta no Supabase
- Instância da Evolution API rodando (para o bot)

### Passos

1. **Clone o repositório**
   ```bash
   git clone https://github.com/seu-usuario/cajurona.git
   cd cajurona
   ```

2. **Instale as dependências**
   ```bash
   npm install
   ```

3. **Configure as variáveis de ambiente**
   Copie o arquivo de exemplo e preencha com suas credenciais:
   ```bash
   cp .env.example .env
   ```
   > **Nota**: As variáveis `VITE_*` são expostas para o frontend. As demais são para o bot.

4. **Rode o projeto**
   ```bash
   # Apenas o Frontend
   npm run dev

   # Frontend + Bot (necessita Evolution API)
   npm run dev & npm run bot
   ```

## 📦 Deploy (Vercel)

O projeto está configurado para deploy contínuo na Vercel.

### Configuração de Deploy Automático para Colaboradores
Para garantir que commits de todos os colaboradores acionem o deploy:

1. Vá no painel da Vercel: **Settings > Git > Deploy Hooks**.
2. Crie um hook chamado `Main Branch Push`.
3. Copie a URL gerada.
4. No GitHub do projeto: **Settings > Secrets and variables > Actions**.
5. Crie um segredo chamado `VERCEL_DEPLOY_HOOK` com a URL do hook.

Agora, qualquer push na branch `main` disparará um deploy na Vercel via GitHub Actions.

## 🤝 Contribuição

1. Faça um Fork do projeto
2. Crie uma Branch para sua Feature (`git checkout -b feature/AmazingFeature`)
3. Faça o Commit de suas mudanças (`git commit -m 'Add some AmazingFeature'`)
4. Faça o Push para a Branch (`git push origin feature/AmazingFeature`)
5. Abra um Pull Request

## 📝 Licença

Distribuído sob a licença MIT. Veja `LICENSE` para mais informações.

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
