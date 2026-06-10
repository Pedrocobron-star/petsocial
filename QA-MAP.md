# Mapa de QA — Maestro Pet (sessão autônoma 2026-06-06)

Sessão: populei o site com perfis interagindo, percorri ao vivo, auditei (manual + multiagente) e corrigi o que estava quebrado. Deploy contínuo no ar (https://petsocial-tawny.vercel.app).

## 🧪 Dados de teste criados (para "viver o site")
- **5 perfis novos** (donos do Pedro): Maya (golden), Pingo (dachshund), Frida (calico), Caju (poodle), Mel (gato laranja) + Nina (gata) = 9 pets do Pedro. Já existiam Luna e Thor (outros donos) = **11 pets / 3 donos**.
- **12 posts com fotos** (placedog.net pra cães, cataas.com pra gatos — únicas fontes externas que o CSP do app permite; vídeo externo é bloqueado), legendas com #hashtags.
- **54 follows, 81 curtidas, 24 comentários** entre os pets → feeds, rankings e contadores populados.
- ⚠️ **Concedi Pet Pro ao Pedro** (admin RPC, anual, reversível) pra furar o limite de 1 post/dia e popular. **Pra voltar ao Free**: painel admin → seu usuário → "Revogar Pro" (ou me peça). Os 9 pets/posts continuam mesmo no Free.

## ✅ O QUE FUNCIONA (validado ao vivo + auditoria)
- **Feed**: posts com foto/vídeo renderizam; pet-picker com 9 pets faz scroll; Pro badge dourado no nome; curtir (coração enche, contador sobe); duplo-toque curte; comentar inline (testado com Mozart/Bidu/Rex, persiste no banco); vídeo 4:5 + autoplay + tela cheia.
- **Perfil do pet**: hero, idade calculada do birthdate ("3 anos e 2 meses"), contadores reais (publicações/seguidores/seguindo), grade de publicações, cards de features. Avatar: foto (avatar_url) → SVG (avatar_config) → emoji (fallback) — robusto.
- **Descobrir**: "Ranking semanal · Pets mais seguidos" com contagens corretas, busca, buscas recentes, Wall of Fame.
- **Realtime/Chat**: bubbles otimistas, agrupamento por dia/burst, status de envio, busca de conversas com normalização de acento, RLS sem recursão (SECURITY DEFINER).
- **Notificações**: agrupadas por seção, ícone por tipo, marca lido ao abrir. (O trigger NÃO notifica interação do mesmo dono — anti-spam — por isso o feed de teste não gerou notif.)
- **Saúde**: hub bem estruturado (score, vacinas, parasitas, sintomas, peso, remédios, consultas, calendário, alertas, nutrição) — área madura.

## 🔧 O QUE ESTAVA QUEBRADO → JÁ CORRIGIDO (deploy v16)
1. **Lista de conversas: contador de não-lidas travava em "1"** (`queries.ts` fetchConversations) e escondia não-lidas anteriores quando a última msg era minha. → Agora conta o número REAL por conversa (bate com o badge do header).
2. **Conversa lida continuava destacada** na lista (`chat/[id].tsx` só invalidava `unreadMessages`). → Agora invalida `conversations` também.
3. **Pull-to-refresh do feed não atualizava o badge de mensagens** (`index.tsx` onRefresh). → Incluído `unreadMessages`.
4. **Mensagem que falha no envio sumia sem avisar** (`chat/[id].tsx` onError). → Toast de erro + restaura o texto digitado.
5. **Notificações "menção"/"marcação" inflavam "Todas" sem filtro** (`notifications.tsx`). → Chips "Menções" e "Marcações" (também conserta empty state latente "Sem undefined").
6. **Botão Mensagem funcionava mesmo com tutor bloqueado** (parte cliente) (`pet/[id]/index.tsx`). → Bloqueado quando você bloqueou o tutor.

## ⏳ PENDENTE (precisa de ação sua)
- **SQL — bloqueio de DM no servidor**: o fix #6 acima é só no cliente. A garantia completa (impedir que quem foi bloqueado mande DM, nos dois sentidos) precisa de RLS/RPC checando `blocked_users`. Arquivo pronto: `supabase/block-dm-hardening.sql` — rode no SQL Editor.
- **Decisão de produto — limite de 1 post/dia no Free** (`FREE_POSTS_PER_DAY=1`): muito restritivo pra rede social (Instagram não limita). Sugiro 3–5/dia ou ilimitado, deixando o Pro pra outros benefícios. É call sua.
- **Inconsistência menor — limite de 3 pets é só na UI** (não tem trigger no banco, diferente do limite de posts). Baixo risco; se quiser, dá pra adicionar trigger.

## 💡 O QUE PODE MELHORAR (engajamento estilo Instagram — não-bloqueante)
- **Chat**: "digitando…" + bolinha online (Realtime presence); reações por long-press na bubble; enviar foto no DM; push de nova mensagem.
- **Notificações**: agrupar repetidas ("Rex e mais 4 curtiram"); filtro "Não lidas".
- **Feed**: preview do último comentário inline (precisa o feed trazer 1 comentário/post via RPC); aba Reels dedicada (vertical full-screen); contador de views nos vídeos (precisa coluna+RPC).
- **Avatares**: os 5 pets novos usam foto (avatar_url); os antigos usam o customizador SVG. Tudo OK, só visualmente misto.

## 📝 Notas técnicas
- 2 auditorias multiagente (12 + 11 áreas) rodaram, mas só a área Chat/Notificações retornou estruturado — as demais falharam em chamar StructuredOutput após leituras longas (limitação do harness com schema + análise extensa). Compensei com auditoria manual + QA ao vivo.
- O erro de hidratação `<a>` dentro de `<a>` no console do dev server vem de **bundle velho** (o arquivo `my-pets-section.tsx` já usa Pressable); produção (v16) está correta.
