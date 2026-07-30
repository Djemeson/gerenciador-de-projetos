/* eslint-disable no-undef */
/**
 * Service worker do app instalável.
 *
 * As três regras que evitam os desastres clássicos de PWA:
 *
 * 1. **A navegação é sempre rede primeiro.** Se o HTML fosse servido do cache, uma versão
 *    velha do app ficaria presa no telefone para sempre — e ela aponta para arquivos
 *    `/assets/<hash>.js` que já não existem no servidor, resultando em tela branca. O
 *    cache do HTML só entra quando a rede falha (modo offline).
 * 2. **Só mexemos em GET do mesmo domínio.** Firestore, autenticação do Google e as APIs
 *    de IA passam direto, sem interceptação. Um service worker que tenta cachear POST ou
 *    resposta de streaming quebra a sincronização de formas difíceis de diagnosticar.
 * 3. **`/assets/*` é cache primeiro** — o Vite põe hash no nome, então aquele arquivo
 *    nunca muda de conteúdo. É daí que vem o carregamento instantâneo na segunda abertura.
 */

const VERSAO = 'v1';
const CACHE  = `gerenciador-projetos-${VERSAO}`;

// Casca mínima para o app abrir sem rede.
const ESSENCIAIS = ['/', '/manifest.webmanifest', '/favicon.svg', '/icon-192.png'];

self.addEventListener('install', (evento) => {
  evento.waitUntil(
    caches.open(CACHE)
      // `reload` evita gravar no cache uma resposta que o próprio navegador já tinha em
      // cache HTTP — senão a instalação pode "congelar" uma versão anterior.
      .then((c) => c.addAll(ESSENCIAIS.map((u) => new Request(u, { cache: 'reload' }))))
      .catch(() => { /* sem rede na instalação: segue, o fetch preenche depois */ }),
  );
  self.skipWaiting();
});

self.addEventListener('activate', (evento) => {
  evento.waitUntil(
    caches.keys()
      .then((nomes) => Promise.all(nomes.filter((n) => n !== CACHE).map((n) => caches.delete(n))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (evento) => {
  const req = evento.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;   // Firebase, Google Fonts, IA: passam direto

  // Navegação (abrir o app, recarregar): rede primeiro, cache como rede de segurança.
  if (req.mode === 'navigate') {
    evento.respondWith(
      fetch(req)
        .then((resp) => {
          const copia = resp.clone();
          caches.open(CACHE).then((c) => c.put('/', copia));
          return resp;
        })
        .catch(() => caches.match('/').then((r) => r || Response.error())),
    );
    return;
  }

  // Arquivos com hash no nome: imutáveis, cache primeiro.
  if (url.pathname.startsWith('/assets/')) {
    evento.respondWith(
      caches.match(req).then((emCache) => emCache || fetch(req).then((resp) => {
        if (resp.ok) { const copia = resp.clone(); caches.open(CACHE).then((c) => c.put(req, copia)); }
        return resp;
      })),
    );
    return;
  }

  // Ícones e manifesto: entrega o que está em cache e atualiza por trás.
  if (/\.(png|svg|webmanifest|ico)$/.test(url.pathname)) {
    evento.respondWith(
      caches.match(req).then((emCache) => {
        const daRede = fetch(req).then((resp) => {
          if (resp.ok) { const copia = resp.clone(); caches.open(CACHE).then((c) => c.put(req, copia)); }
          return resp;
        }).catch(() => emCache);
        return emCache || daRede;
      }),
    );
  }
});

// Permite que a página peça a troca imediata quando uma versão nova for detectada.
self.addEventListener('message', (evento) => {
  if (evento.data === 'aplicar-atualizacao') self.skipWaiting();
});
