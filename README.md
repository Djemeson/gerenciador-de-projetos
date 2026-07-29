# Gerenciador de Projetos

App pessoal de gestão de projetos e tarefas (React + Vite + Tailwind + Zustand), com
login pelo Google e sincronização em tempo real via Firebase Firestore.

> As decisões de produto, design e arquitetura ficam em [DIRETRIZES.md](DIRETRIZES.md) —
> leia antes de mexer no código.

## Rodar localmente

**Pré-requisito:** Node.js 20+

1. Instale as dependências: `npm install`
2. Copie `.env.example` para `.env` e preencha as variáveis do Firebase
   (Console do Firebase → Configurações do projeto → Seus apps → Web).
   `GEMINI_API_KEY` é opcional (recursos de IA).
3. Rode: `npm run dev` → http://localhost:3000

Sem `.env`, o app abre **sem login**, funcionando só com o armazenamento do navegador —
útil para desenvolvimento, mas sem sincronização.

Outros comandos: `npm run lint` (checagem de tipos) · `npm run build` · `npm start`.

## Login com Google — configuração no Firebase

Feito uma vez no [Console do Firebase](https://console.firebase.google.com):

1. **Authentication → Sign-in method → Google**: habilitar.
2. **Authentication → Settings → Authorized domains**: incluir `localhost` e o domínio da
   Vercel (ex.: `meu-app.vercel.app`, além de qualquer domínio próprio).
3. **Firestore → Rules**: publicar as regras de [firestore.rules](firestore.rules)
   (`firebase deploy --only firestore:rules`).

Cada conta Google tem seu próprio documento em `syncGroups/{uid}` — entrar com a mesma
conta no celular e no PC sincroniza os dois automaticamente, sem código nenhum.

## Deploy

Vercel. As variáveis `VITE_FIREBASE_*` precisam estar configuradas no projeto da Vercel
(Settings → Environment Variables) e o domínio gerado precisa estar nos *Authorized
domains* do Firebase — senão o login com Google falha com "domínio não autorizado".

## Trabalhar pelo Claude Code no celular

O repositório já vem preparado para sessões na nuvem (claude.ai/code, também pelo app do
Claude no celular):

- Dê `git push` antes — a sessão clona do GitHub, não do PC.
- As dependências são instaladas sozinhas no início da sessão (hook `SessionStart` em
  `.claude/settings.json` → `scripts/install_pkgs.sh`).
- Sem `.env` na nuvem, o app roda em modo local sem login; login e sincronização se
  validam no PC ou no deploy.

Detalhes na seção 16 do [DIRETRIZES.md](DIRETRIZES.md).
