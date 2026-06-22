import { deleteFromBucket } from './storage';
import { supabase } from './supabase';
import type {
  AiConversation,
  AiMessage,
  ConversationSummary,
  HealthSummary,
  LostReport,
  LostReportKind,
  LostReportWithPet,
  Medication,
  MedicationFrequency,
  MedicationLog,
  MedicationWithLogs,
  MemorialMessage,
  MemorialMessageWithProfile,
  Meetup,
  MeetupWithDetails,
  Message,
  NotificationWithDetails,
  PersonalityType,
  Pet,
  PetPrivate,
  PetPrivatePatch,
  PetMilestone,
  Place,
  PlaceKind,
  PlaceReview,
  PlacePhoto,
  PlaceReviewWithProfile,
  PlaceWithStats,
  PostMedia,
  PostWithDetails,
  Profile,
  PublicPetCardResult,
  ReportReason,
  ReportTargetKind,
  Subscription,
  SubscriptionPlan,
  CaretakerRole,
  ParasiteKind,
  ParasiteTreatment,
  PetCaretaker,
  PetCaretakerWithProfile,
  PetDietLog,
  PetEvent,
  PetEventKind,
  PetEventLog,
  PetSymptom,
  RecurrenceRule,
  Vaccination,
  VetVisit,
  WeightRecord,
} from './types';

// -------- Hashtags --------

import { extractHashtags, extractMentions } from './text-parsing';

export const qk = {
  profile: (userId: string) => ['profile', userId] as const,
  myPets: (userId: string) => ['my-pets', userId] as const,
  pet: (petId: string) => ['pet', petId] as const,
  petStats: (petId: string) => ['pet-stats', petId] as const,
  feed: (petId: string, filter: string = 'all') => ['feed', petId, filter] as const,
  petPosts: (petId: string, viewerPetId?: string) =>
    ['pet-posts', petId, viewerPetId ?? petId] as const,
  // Variante paginada (grid do perfil). Compartilha o prefixo ['pet-posts',...]
  // de propósito: as invalidações existentes de petPosts cobrem essa também.
  petPostsPaged: (petId: string, viewerPetId?: string) =>
    ['pet-posts', petId, viewerPetId ?? petId, 'paged'] as const,
  post: (postId: string) => ['post', postId] as const,
  comments: (postId: string) => ['comments', postId] as const,
  meetups: (filter: string = 'upcoming') => ['meetups', filter] as const,
  meetup: (id: string) => ['meetup', id] as const,
  explore: () => ['explore'] as const,
  search: (query: string) => ['search', query] as const,
  followers: (petId: string) => ['followers', petId] as const,
  following: (petId: string) => ['following', petId] as const,
  notifications: (userId: string) => ['notifications', userId] as const,
  unreadCount: (userId: string) => ['unread-count', userId] as const,
  savedPostIds: (userId: string) => ['saved-post-ids', userId] as const,
  savedPostsFeed: (userId: string) => ['saved-posts-feed', userId] as const,
  vaccinations: (petId: string) => ['vaccinations', petId] as const,
  parasiteTreatments: (petId: string) => ['parasite-treatments', petId] as const,
  parasiteSummary: (petId: string) => ['parasite-summary', petId] as const,
  petEvents: (petId: string) => ['pet-events', petId] as const,
  petEventLogs: (petId: string) => ['pet-event-logs', petId] as const,
  petAgenda: (petId: string, rangeKey: string) => ['pet-agenda', petId, rangeKey] as const,
  petCaretakers: (petId: string) => ['pet-caretakers', petId] as const,
  lostReports: (kind: string) => ['lost-reports', kind] as const,
  lostReport: (id: string) => ['lost-report', id] as const,
  achievements: (userId: string) => ['achievements', userId] as const,
  milestones: (petId: string) => ['milestones', petId] as const,
  userStreak: (userId: string) => ['user-streak', userId] as const,
  wallOfFame: () => ['wall-of-fame'] as const,
  suggestedPets: (petId: string) => ['suggested-pets', petId] as const,
  conversations: (userId: string) => ['conversations', userId] as const,
  messages: (conversationId: string) => ['messages', conversationId] as const,
  unreadMessages: (userId: string) => ['unread-messages', userId] as const,
  medications: (petId: string) => ['medications', petId] as const,
  medicationLogs: (medId: string) => ['medication-logs', medId] as const,
  vetVisits: (petId: string) => ['vet-visits', petId] as const,
  petSymptoms: (petId: string, filter: string = 'all') => ['pet-symptoms', petId, filter] as const,
  petDietActive: (petId: string) => ['pet-diet-active', petId] as const,
  petDietHistory: (petId: string) => ['pet-diet-history', petId] as const,
  weightRecords: (petId: string) => ['weight-records', petId] as const,
  healthSummary: (petId: string) => ['health-summary', petId] as const,
  healthTimeline: (petId: string) => ['health-timeline', petId] as const,
  healthMonth: (petId: string, monthKey: string) =>
    ['health-month', petId, monthKey] as const,
  healthSnapshots: (petId: string) => ['health-snapshots', petId] as const,
  blockedUsers: (userId: string) => ['blocked-users', userId] as const,
  isBlocked: (userId: string, otherId: string) => ['is-blocked', userId, otherId] as const,
  hashtag: (name: string) => ['hashtag', name] as const,
  trendingHashtags: () => ['trending-hashtags'] as const,
  places: (filter: string) => ['places', filter] as const,
  placeKindCounts: () => ['place-kind-counts'] as const,
  place: (id: string) => ['place', id] as const,
  placeReviews: (placeId: string) => ['place-reviews', placeId] as const,
  placePhotos: (placeId: string) => ['place-photos', placeId] as const,
  subscription: (userId: string) => ['subscription', userId] as const,
  subscriptionEvents: (userId: string) => ['subscription-events', userId] as const,
  memorialMessages: (petId: string) => ['memorial-messages', petId] as const,
  timeCapsule: (petId: string) => ['time-capsule', petId] as const,
  aiConversations: (userId: string) => ['ai-conversations', userId] as const,
  aiMessages: (conversationId: string) => ['ai-messages', conversationId] as const,
  aiMessagesSentToday: (userId: string) => ['ai-messages-today', userId] as const,
};

// -------- Profile / Pets --------

export async function fetchProfile(userId: string): Promise<Profile | null> {
  const { data, error } = await supabase.from('profiles').select('*').eq('id', userId).maybeSingle();
  if (error) throw error;
  return data;
}

export async function fetchMyPets(userId: string): Promise<Pet[]> {
  const { data, error } = await supabase
    .from('pets')
    .select('*')
    .eq('owner_id', userId)
    .order('created_at', { ascending: true });
  if (error) throw error;
  return data ?? [];
}

/**
 * Busca pet pelo token público da carteirinha. Usado na rota /id/[token].
 * Read all RLS permite acesso público (sem autenticação) — só retorna campos
 * declarados pelo tutor.
 */
export async function fetchPetByIdToken(token: string): Promise<PublicPetCardResult | null> {
  // RPC security-definer gated por token: devolve só os campos da carteirinha +
  // nome/foto do tutor. Evita o vazamento de PII do antigo select('*') público.
  const { data, error } = await supabase.rpc('public_pet_card', { p_token: token });
  if (error) throw error;
  return (data as PublicPetCardResult | null) ?? null;
}

export async function fetchPet(petId: string): Promise<Pet | null> {
  const { data, error } = await supabase.from('pets').select('*').eq('id', petId).maybeSingle();
  if (error) throw error;
  return data;
}

/**
 * Dados sensíveis da carteirinha (PII médica) do pet — tabela-filha
 * `pet_private` com RLS DONO-ONLY. Visitante recebe null (RLS bloqueia), não
 * vaza microchip/alergias/contato de emergência. Ver supabase/pet-private-pii.sql.
 */
export async function fetchPetPrivate(petId: string): Promise<PetPrivate | null> {
  const { data, error } = await supabase
    .from('pet_private')
    .select('*')
    .eq('pet_id', petId)
    .maybeSingle();
  if (error) throw error;
  return (data as PetPrivate | null) ?? null;
}

/**
 * Salva os campos sensíveis da carteirinha em `pet_private` (upsert por pet_id).
 * RLS garante que só o dono escreve. O token NUNCA vem no patch — fica com o
 * DEFAULT da tabela no insert e intocado no update.
 */
export async function upsertPetPrivate(petId: string, patch: PetPrivatePatch): Promise<void> {
  const { error } = await supabase
    .from('pet_private')
    .upsert(
      { pet_id: petId, ...patch, updated_at: new Date().toISOString() },
      { onConflict: 'pet_id' },
    );
  if (error) throw error;
}

/**
 * Posso ver a saúde/histórico privado desse pet? (dono OU co-tutor aceito).
 * Espelha o RLS `can_view_pet` via RPC `can_view_pet_rpc`. Usado pelo guard das
 * telas médicas pra mostrar "Informações privadas" ao visitante.
 */
export async function canViewPet(petId: string): Promise<boolean> {
  const { data, error } = await supabase.rpc('can_view_pet_rpc', { pet_uuid: petId });
  if (error) return false;
  return data === true;
}

export async function fetchPetStats(petId: string) {
  const { data, error } = await supabase
    .from('pet_stats')
    .select('*')
    .eq('pet_id', petId)
    .maybeSingle();
  if (error) throw error;
  return data ?? { pet_id: petId, posts_count: 0, followers_count: 0, following_count: 0 };
}

// -------- Posts / Feed --------

interface FeedRow {
  id: string;
  pet_id: string;
  caption: string | null;
  created_at: string;
  updated_at: string | null;
  reposted_from: string | null;
  pet: Pet;
  media: PostMedia[];
}

/**
 * Hidrata `original_post` (se for repost) e `pet_tags` em posts. Faz queries
 * batch pra evitar N+1. Sempre chamado APÓS hidratação base (likes_count etc).
 */
async function hydrateRepostsAndTags(
  posts: PostWithDetails[],
): Promise<PostWithDetails[]> {
  if (posts.length === 0) return posts;

  // Original posts pros reposts
  const repostIds = posts
    .filter((p) => p.reposted_from)
    .map((p) => p.reposted_from as string);
  let originalMap = new Map<
    string,
    { id: string; pet: Pet; caption: string | null; media: PostMedia[] }
  >();
  if (repostIds.length > 0) {
    const { data: origs } = await supabase
      .from('posts')
      .select('id, caption, pet:pets!posts_pet_id_fkey(*), media:post_media(*)')
      .in('id', repostIds)
      .returns<
        { id: string; caption: string | null; pet: Pet; media: PostMedia[] }[]
      >();
    originalMap = new Map(
      (origs ?? []).map((o) => [
        o.id,
        {
          id: o.id,
          pet: o.pet,
          caption: o.caption,
          media: [...(o.media ?? [])].sort((a, b) => a.position - b.position),
        },
      ]),
    );
  }

  // Pet tags pros posts
  const postIds = posts.map((p) => p.id);
  const { data: tagsData } = await supabase
    .from('post_pet_tags')
    .select('post_id, tagged_pet:pets!tagged_pet_id(*)')
    .in('post_id', postIds);
  const tagsByPost = new Map<string, Pet[]>();
  for (const row of tagsData ?? []) {
    const r = row as unknown as { post_id: string; tagged_pet: Pet };
    if (!r.tagged_pet) continue;
    const arr = tagsByPost.get(r.post_id) ?? [];
    arr.push(r.tagged_pet);
    tagsByPost.set(r.post_id, arr);
  }

  // owner_is_pro: lookup batch em profiles.is_pro pra renderizar selo dourado
  // ao lado do nome do pet quando o dono é Pet Pro. Best-effort — se a coluna
  // ainda não existe, fica todo mundo como false (sem badge).
  const ownerIds = [...new Set(posts.map((p) => p.pet.owner_id).filter(Boolean))];
  const proOwners = new Set<string>();
  if (ownerIds.length > 0) {
    const { data: profs } = await supabase
      .from('profiles')
      .select('id, is_pro')
      .in('id', ownerIds);
    for (const p of profs ?? []) {
      const r = p as { id: string; is_pro: boolean };
      if (r.is_pro) proOwners.add(r.id);
    }
  }

  return posts.map((p) => ({
    ...p,
    original_post: p.reposted_from ? originalMap.get(p.reposted_from) ?? null : null,
    pet_tags: tagsByPost.get(p.id) ?? [],
    owner_is_pro: proOwners.has(p.pet.owner_id),
  }));
}

export type FeedFilter = 'all' | 'following' | 'top_week';

/** Uma página do feed: posts + cursor pra próxima (null = acabou). */
export interface FeedPage {
  items: PostWithDetails[];
  nextCursor: string | null;
}

/**
 * Feed paginado por KEYSET em `created_at` (scroll infinito). `cursor` = o
 * created_at do último post da página anterior; `.lt` evita duplicar (e nunca
 * gera key repetida na FlatList). O filtro de bloqueados acontece DEPOIS, então
 * o `nextCursor` ancora no último ROW cru (não no último visível) pra não pular
 * posts. **top_week NÃO pagina** (página única): ele re-ordena por likes, e
 * keyset por data brigaria com isso — mantém o ranking coerente.
 */
export async function fetchFeed(
  viewerPetId: string,
  filter: FeedFilter = 'all',
  cursor?: string | null,
): Promise<FeedPage> {
  // top_week amostra mais (100) antes de ordenar por likes, pra "Top da semana"
  // ser representativo de verdade (e não só "os 50 mais recentes reordenados").
  const PAGE = filter === 'top_week' ? 100 : 20;
  let query = supabase
    .from('posts')
    .select('id, pet_id, caption, created_at, updated_at, reposted_from, pet:pets!posts_pet_id_fkey(*), media:post_media(*)')
    .order('created_at', { ascending: false })
    .limit(PAGE);

  if (cursor) query = query.lt('created_at', cursor);

  if (filter === 'following') {
    // Pega ids dos pets que o viewer segue
    const followingRes = await supabase
      .from('follows')
      .select('followed_pet_id')
      .eq('follower_pet_id', viewerPetId);
    if (followingRes.error) throw followingRes.error;
    const followedIds = (followingRes.data ?? []).map(
      (r) => (r as { followed_pet_id: string }).followed_pet_id,
    );
    // Inclui o próprio pet também
    followedIds.push(viewerPetId);
    query = query.in('pet_id', followedIds);
  } else if (filter === 'top_week') {
    // Posts dos últimos 7 dias — ordenação por likes acontece após hidratação
    const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
    query = query.gte('created_at', weekAgo);
  }

  // Filtra posts de usuários bloqueados
  const { data: { user } } = await supabase.auth.getUser();
  let blockedUserIds = new Set<string>();
  if (user) {
    const blocked = await fetchBlockedUsers(user.id);
    blockedUserIds = new Set(blocked);
  }

  const { data, error } = await query.returns<FeedRow[]>();
  if (error) throw error;
  const raw = data ?? [];
  const rawCount = raw.length;
  const lastRaw = raw[raw.length - 1];
  // top_week é página única; senão, há mais se a página cru veio cheia.
  const nextCursor =
    filter === 'top_week' ? null : rawCount === PAGE && lastRaw ? lastRaw.created_at : null;

  let rows = raw;
  if (blockedUserIds.size > 0) {
    rows = rows.filter((r) => !blockedUserIds.has(r.pet.owner_id));
  }
  if (rows.length === 0) return { items: [], nextCursor };

  const postIds = rows.map((r) => r.id);
  const [statsRes, likesRes] = await Promise.all([
    supabase.from('post_stats').select('*').in('post_id', postIds),
    supabase.from('likes').select('post_id').eq('pet_id', viewerPetId).in('post_id', postIds),
  ]);
  if (statsRes.error) throw statsRes.error;
  if (likesRes.error) throw likesRes.error;

  const statsByPost = new Map(statsRes.data?.map((s) => [s.post_id, s]) ?? []);
  const likedSet = new Set(likesRes.data?.map((l) => l.post_id) ?? []);

  const hydrated = await hydrateRepostsAndTags(
    rows.map((r) => ({
      ...r,
      media: [...(r.media ?? [])].sort((a, b) => a.position - b.position),
      likes_count: statsByPost.get(r.id)?.likes_count ?? 0,
      comments_count: statsByPost.get(r.id)?.comments_count ?? 0,
      liked_by_me: likedSet.has(r.id),
    })),
  );
  // No filtro "top_week", re-ordena por likes desc (mais curtidos primeiro)
  const items = filter === 'top_week' ? [...hydrated].sort((a, b) => b.likes_count - a.likes_count) : hydrated;
  return { items, nextCursor };
}

export async function toggleLike(postId: string, petId: string, currentlyLiked: boolean) {
  if (currentlyLiked) {
    const { error } = await supabase.from('likes').delete().match({ post_id: postId, pet_id: petId });
    if (error) throw error;
  } else {
    const { error } = await supabase
      .from('likes')
      .upsert({ post_id: postId, pet_id: petId }, { onConflict: 'post_id,pet_id', ignoreDuplicates: true });
    if (error) throw error;
  }
}

// -------- Meetups --------

interface MeetupRow extends Meetup {
  host_pet: Pet;
}

export type MeetupFilter = 'upcoming' | 'attending' | 'hosting' | 'past';

const RECENT_CUTOFF_MS = 1000 * 60 * 60 * 6;

export async function fetchMeetups(
  viewerPetId: string,
  filter: MeetupFilter = 'upcoming',
): Promise<MeetupWithDetails[]> {
  const cutoff = new Date(Date.now() - RECENT_CUTOFF_MS).toISOString();
  let query = supabase.from('meetups').select('*, host_pet:pets!meetups_host_pet_id_fkey(*)');

  if (filter === 'past') {
    query = query.lt('starts_at', cutoff).order('starts_at', { ascending: false });
  } else if (filter === 'hosting') {
    query = query
      .eq('host_pet_id', viewerPetId)
      .gte('starts_at', cutoff)
      .order('starts_at', { ascending: true });
  } else if (filter === 'attending') {
    const { data: attendingIds, error: rsvpErr } = await supabase
      .from('meetup_rsvps')
      .select('meetup_id')
      .eq('pet_id', viewerPetId)
      .eq('status', 'going');
    if (rsvpErr) throw rsvpErr;
    const ids = (attendingIds ?? []).map((r) => (r as { meetup_id: string }).meetup_id);
    if (ids.length === 0) return [];
    query = query
      .in('id', ids)
      .gte('starts_at', cutoff)
      .order('starts_at', { ascending: true });
  } else {
    query = query.gte('starts_at', cutoff).order('starts_at', { ascending: true });
  }

  const { data, error } = await query.limit(50).returns<MeetupRow[]>();
  if (error) throw error;
  const rows = data ?? [];

  if (rows.length === 0) return [];

  const ids = rows.map((r) => r.id);
  const [countsRes, myRes] = await Promise.all([
    supabase.from('meetup_rsvps').select('meetup_id').in('meetup_id', ids).eq('status', 'going'),
    supabase.from('meetup_rsvps').select('meetup_id, status').eq('pet_id', viewerPetId).in('meetup_id', ids),
  ]);
  if (countsRes.error) throw countsRes.error;
  if (myRes.error) throw myRes.error;

  const counts = new Map<string, number>();
  for (const r of countsRes.data ?? []) {
    counts.set(r.meetup_id, (counts.get(r.meetup_id) ?? 0) + 1);
  }
  const mine = new Map(myRes.data?.map((r) => [r.meetup_id, r.status]) ?? []);

  return rows.map((r) => ({
    ...r,
    rsvps_count: counts.get(r.id) ?? 0,
    my_rsvp_status: (mine.get(r.id) as MeetupWithDetails['my_rsvp_status']) ?? null,
  }));
}

export async function setRsvp(meetupId: string, petId: string, status: 'going' | 'maybe' | 'not_going') {
  const { error } = await supabase
    .from('meetup_rsvps')
    .upsert({ meetup_id: meetupId, pet_id: petId, status }, { onConflict: 'meetup_id,pet_id' });
  if (error) throw error;
}

export async function clearRsvp(meetupId: string, petId: string) {
  const { error } = await supabase
    .from('meetup_rsvps')
    .delete()
    .match({ meetup_id: meetupId, pet_id: petId });
  if (error) throw error;
}

// -------- Pet detail / Posts by pet --------

export async function fetchPostsByPet(
  petId: string,
  viewerPetId: string | null,
): Promise<PostWithDetails[]> {
  const { data, error } = await supabase
    .from('posts')
    .select('id, pet_id, caption, created_at, updated_at, reposted_from, pet:pets!posts_pet_id_fkey(*), media:post_media(*)')
    .eq('pet_id', petId)
    .order('created_at', { ascending: false })
    .returns<FeedRow[]>();
  if (error) throw error;
  const rows = data ?? [];
  if (rows.length === 0) return [];

  const ids = rows.map((r) => r.id);
  const [statsRes, likesRes] = await Promise.all([
    supabase.from('post_stats').select('*').in('post_id', ids),
    // viewer sem pet (conta nova / cold-load): pula o likes -> liked_by_me=false
    viewerPetId
      ? supabase.from('likes').select('post_id').eq('pet_id', viewerPetId).in('post_id', ids)
      : Promise.resolve({ data: [] as { post_id: string }[], error: null }),
  ]);
  if (statsRes.error) throw statsRes.error;
  if (likesRes.error) throw likesRes.error;

  const statsByPost = new Map(statsRes.data?.map((s) => [s.post_id, s]) ?? []);
  const likedSet = new Set(likesRes.data?.map((l) => l.post_id) ?? []);

  return hydrateRepostsAndTags(
    rows.map((r) => ({
      ...r,
      media: [...(r.media ?? [])].sort((a, b) => a.position - b.position),
      likes_count: statsByPost.get(r.id)?.likes_count ?? 0,
      comments_count: statsByPost.get(r.id)?.comments_count ?? 0,
      liked_by_me: likedSet.has(r.id),
    })),
  );
}

/** Página do grid do perfil: posts + cursor (created_at) pra próxima. */
export interface PetPostsPage {
  items: PostWithDetails[];
  nextCursor: string | null;
}

/**
 * Posts de um pet PAGINADOS por keyset em created_at (grid do perfil, scroll
 * infinito). Mesma hidratação de fetchPostsByPet. A galeria (lightbox) segue
 * usando fetchPostsByPet SEM paginar — como ambos ordenam por created_at desc,
 * a lista cheia da galeria é um SUPERSET na mesma ordem, então o índice de
 * mídia calculado no grid continua apontando pra foto certa.
 */
export async function fetchPetPostsPage(
  petId: string,
  viewerPetId: string | null,
  cursor?: string | null,
): Promise<PetPostsPage> {
  const PAGE = 18; // múltiplo de 3 (grid de 3 colunas)
  let query = supabase
    .from('posts')
    .select('id, pet_id, caption, created_at, updated_at, reposted_from, pet:pets!posts_pet_id_fkey(*), media:post_media(*)')
    .eq('pet_id', petId)
    .order('created_at', { ascending: false })
    .limit(PAGE);
  if (cursor) query = query.lt('created_at', cursor);

  const { data, error } = await query.returns<FeedRow[]>();
  if (error) throw error;
  const rows = data ?? [];
  const lastRaw = rows[rows.length - 1];
  const nextCursor = rows.length === PAGE && lastRaw ? lastRaw.created_at : null;
  if (rows.length === 0) return { items: [], nextCursor };

  const ids = rows.map((r) => r.id);
  const [statsRes, likesRes] = await Promise.all([
    supabase.from('post_stats').select('*').in('post_id', ids),
    // viewer sem pet (conta nova / cold-load): pula o likes -> liked_by_me=false
    viewerPetId
      ? supabase.from('likes').select('post_id').eq('pet_id', viewerPetId).in('post_id', ids)
      : Promise.resolve({ data: [] as { post_id: string }[], error: null }),
  ]);
  if (statsRes.error) throw statsRes.error;
  if (likesRes.error) throw likesRes.error;

  const statsByPost = new Map(statsRes.data?.map((s) => [s.post_id, s]) ?? []);
  const likedSet = new Set(likesRes.data?.map((l) => l.post_id) ?? []);

  const items = await hydrateRepostsAndTags(
    rows.map((r) => ({
      ...r,
      media: [...(r.media ?? [])].sort((a, b) => a.position - b.position),
      likes_count: statsByPost.get(r.id)?.likes_count ?? 0,
      comments_count: statsByPost.get(r.id)?.comments_count ?? 0,
      liked_by_me: likedSet.has(r.id),
    })),
  );
  return { items, nextCursor };
}

export async function fetchPost(postId: string, viewerPetId: string): Promise<PostWithDetails | null> {
  const { data, error } = await supabase
    .from('posts')
    .select('id, pet_id, caption, created_at, updated_at, reposted_from, pet:pets!posts_pet_id_fkey(*), media:post_media(*)')
    .eq('id', postId)
    .returns<FeedRow>()
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  const row = data as FeedRow;
  const [statsRes, likeRes] = await Promise.all([
    supabase.from('post_stats').select('*').eq('post_id', postId).maybeSingle(),
    supabase.from('likes').select('post_id').match({ post_id: postId, pet_id: viewerPetId }).maybeSingle(),
  ]);
  const stats = statsRes.data as { likes_count: number; comments_count: number } | null;
  const hydrated = await hydrateRepostsAndTags([
    {
      ...row,
      media: [...(row.media ?? [])].sort((a, b) => a.position - b.position),
      likes_count: stats?.likes_count ?? 0,
      comments_count: stats?.comments_count ?? 0,
      liked_by_me: !!likeRes.data,
    },
  ]);
  return hydrated[0] ?? null;
}

// -------- Comments --------

interface CommentRow {
  id: string;
  post_id: string;
  pet_id: string;
  content: string;
  created_at: string;
  updated_at: string | null;
  parent_id: string | null;
  pet: Pet;
}

/**
 * Busca comentários hidratados com pet, likes_count, replies_count e liked_by_me.
 * viewerPetId é usado pra computar liked_by_me — opcional pra public/anonymous.
 */
export async function fetchComments(
  postId: string,
  viewerPetId?: string | null,
): Promise<import('./types').CommentWithDetails[]> {
  const { data, error } = await supabase
    .from('comments')
    .select('*, pet:pets!comments_pet_id_fkey(*)')
    .eq('post_id', postId)
    .order('created_at', { ascending: true })
    .returns<CommentRow[]>();
  if (error) throw error;
  const rows = data ?? [];
  if (rows.length === 0) return [];

  const ids = rows.map((r) => r.id);

  // Conta likes por comment_id
  const { data: likesData } = await supabase
    .from('comment_likes')
    .select('comment_id, pet_id')
    .in('comment_id', ids);
  const likeMap = new Map<string, { count: number; mine: boolean }>();
  for (const r of likesData ?? []) {
    const e = likeMap.get(r.comment_id) ?? { count: 0, mine: false };
    e.count += 1;
    if (viewerPetId && r.pet_id === viewerPetId) e.mine = true;
    likeMap.set(r.comment_id, e);
  }

  // Conta replies por parent_id (entre os próprios comentários carregados)
  const replyCountMap = new Map<string, number>();
  for (const r of rows) {
    if (r.parent_id) {
      replyCountMap.set(r.parent_id, (replyCountMap.get(r.parent_id) ?? 0) + 1);
    }
  }

  return rows.map((r) => ({
    ...r,
    likes_count: likeMap.get(r.id)?.count ?? 0,
    liked_by_me: likeMap.get(r.id)?.mine ?? false,
    replies_count: replyCountMap.get(r.id) ?? 0,
  }));
}

export async function addComment(
  postId: string,
  petId: string,
  content: string,
  parentId?: string | null,
) {
  const { error } = await supabase.from('comments').insert({
    post_id: postId,
    pet_id: petId,
    content,
    parent_id: parentId ?? null,
  });
  if (error) throw error;
}

export async function updateComment(commentId: string, content: string) {
  const { error } = await supabase.from('comments').update({ content }).eq('id', commentId);
  if (error) throw error;
}

export async function deleteComment(commentId: string) {
  const { error } = await supabase.from('comments').delete().eq('id', commentId);
  if (error) throw error;
}

// ============================================================================
// Comment likes
// ============================================================================

/** Curte ou descurte um comentário (toggle). Retorna o novo estado. */
export async function toggleCommentLike(
  commentId: string,
  petId: string,
  currentlyLiked: boolean,
): Promise<boolean> {
  if (currentlyLiked) {
    const { error } = await supabase
      .from('comment_likes')
      .delete()
      .eq('comment_id', commentId)
      .eq('pet_id', petId);
    if (error) throw error;
    return false;
  } else {
    const { error } = await supabase
      .from('comment_likes')
      .insert({ comment_id: commentId, pet_id: petId });
    if (error) throw error;
    return true;
  }
}

// ============================================================================
// Repost
// ============================================================================

/**
 * Reposta um post — cria um novo post no perfil do pet do repostador, vinculado
 * ao post original via reposted_from. Caption opcional (comentário sobre o repost).
 */
export async function repostPost(
  originalPostId: string,
  repostingPetId: string,
  caption?: string | null,
) {
  // Aponta sempre pro post ORIGINAL: se o alvo já é um repost, usa a raiz dele
  // (evita "repost de repost" com reposted_from quebrado).
  const { data: target } = await supabase
    .from('posts')
    .select('reposted_from')
    .eq('id', originalPostId)
    .maybeSingle();
  const rootId = (target as { reposted_from: string | null } | null)?.reposted_from ?? originalPostId;

  // Já repostou esse original? Não duplica (o índice único no banco garante;
  // checamos antes pra dar um erro amigável em vez de violação de constraint).
  const { data: existing } = await supabase
    .from('posts')
    .select('id')
    .eq('pet_id', repostingPetId)
    .eq('reposted_from', rootId)
    .maybeSingle();
  if (existing) throw new Error('Você já repostou esse post.');

  const { error } = await supabase.from('posts').insert({
    pet_id: repostingPetId,
    caption: caption ?? null,
    reposted_from: rootId,
  });
  if (error) throw error;
}

// ============================================================================
// Pet tags (mencionar pets no post)
// ============================================================================

/** Adiciona múltiplos pets como tags em um post + notifica donos taggeados. */
export async function addPetTags(postId: string, taggedPetIds: string[]) {
  if (taggedPetIds.length === 0) return;
  const rows = taggedPetIds.map((id) => ({ post_id: postId, tagged_pet_id: id }));
  const { error } = await supabase.from('post_pet_tags').insert(rows);
  if (error) throw error;
  // Notifica donos dos pets taggeados (best-effort — não bloqueia se falhar).
  // Pega o actor_pet_id via post (autor)
  const { data: postRow } = await supabase
    .from('posts')
    .select('pet_id')
    .eq('id', postId)
    .maybeSingle();
  if (postRow) {
    await Promise.all(
      taggedPetIds.map((tid) =>
        supabase
          .rpc('notify_pet_tag', {
            tagged_pet: tid,
            actor_pet: (postRow as { pet_id: string }).pet_id,
            post_id_param: postId,
          })
          .then(
            () => {},
            () => {},
          ),
      ),
    );
  }
}

/** Remove uma tag de pet de um post. */
export async function removePetTag(postId: string, taggedPetId: string) {
  const { error } = await supabase
    .from('post_pet_tags')
    .delete()
    .eq('post_id', postId)
    .eq('tagged_pet_id', taggedPetId);
  if (error) throw error;
}

/** Busca pets taggeados num post. */
export async function fetchPostPetTags(postId: string): Promise<Pet[]> {
  const { data, error } = await supabase
    .from('post_pet_tags')
    .select('tagged_pet:pets!tagged_pet_id(*)')
    .eq('post_id', postId);
  if (error) throw error;
  return (data ?? [])
    .map((r) => (r as unknown as { tagged_pet: Pet }).tagged_pet)
    .filter(Boolean);
}

// ============================================================================
// Post edit history (Pro feature)
// ============================================================================

export async function fetchPostEditHistory(
  postId: string,
): Promise<import('./types').PostEditHistory[]> {
  const { data, error } = await supabase
    .from('post_edit_history')
    .select('*')
    .eq('post_id', postId)
    .order('edited_at', { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function updatePostCaption(postId: string, caption: string | null) {
  const { error } = await supabase.from('posts').update({ caption }).eq('id', postId);
  if (error) throw error;
}

// -------- Follow --------

export async function fetchIsFollowing(followerPetId: string, followedPetId: string) {
  const { data, error } = await supabase
    .from('follows')
    .select('follower_pet_id')
    .match({ follower_pet_id: followerPetId, followed_pet_id: followedPetId })
    .maybeSingle();
  if (error) throw error;
  return !!data;
}

export async function toggleFollow(followerPetId: string, followedPetId: string, currentlyFollowing: boolean) {
  if (currentlyFollowing) {
    const { error } = await supabase
      .from('follows')
      .delete()
      .match({ follower_pet_id: followerPetId, followed_pet_id: followedPetId });
    if (error) throw error;
  } else {
    const { error } = await supabase
      .from('follows')
      .upsert(
        { follower_pet_id: followerPetId, followed_pet_id: followedPetId },
        { onConflict: 'follower_pet_id,followed_pet_id', ignoreDuplicates: true },
      );
    if (error) throw error;
  }
}

// -------- Meetup detail --------

export interface RsvpRow {
  pet_id: string;
  status: 'going' | 'maybe' | 'not_going';
  pet: Pet;
}

export type MeetupDetail = Meetup & {
  host_pet: Pet;
  rsvps: RsvpRow[];
  my_rsvp_status: 'going' | 'maybe' | 'not_going' | null;
};

export async function fetchMeetup(id: string, viewerPetId: string): Promise<MeetupDetail | null> {
  const { data, error } = await supabase
    .from('meetups')
    .select('*, host_pet:pets!meetups_host_pet_id_fkey(*)')
    .eq('id', id)
    .returns<Meetup & { host_pet: Pet }>()
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  const row = data as Meetup & { host_pet: Pet };

  const [rsvpsRes, myRes] = await Promise.all([
    supabase
      .from('meetup_rsvps')
      .select('pet_id, status, pet:pets!meetup_rsvps_pet_id_fkey(*)')
      .eq('meetup_id', id)
      .returns<RsvpRow[]>(),
    supabase
      .from('meetup_rsvps')
      .select('status')
      .match({ meetup_id: id, pet_id: viewerPetId })
      .maybeSingle(),
  ]);
  if (rsvpsRes.error) throw rsvpsRes.error;

  const myStatus = (myRes.data as { status: 'going' | 'maybe' | 'not_going' } | null)?.status ?? null;

  return {
    ...row,
    rsvps: rsvpsRes.data ?? [],
    my_rsvp_status: myStatus,
  };
}

// -------- Explore / Search --------

interface PetWithFollowers extends Pet {
  followers_count?: number;
}

export async function fetchPopularPets(excludePetId: string, limit = 30): Promise<PetWithFollowers[]> {
  const { data, error } = await supabase
    .from('pets')
    .select('*')
    .neq('id', excludePetId)
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) throw error;
  const pets = (data ?? []) as Pet[];
  if (pets.length === 0) return [];

  const ids = pets.map((p) => p.id);
  const statsRes = await supabase.from('pet_stats').select('*').in('pet_id', ids);
  const map = new Map(
    (statsRes.data ?? []).map((s) => [
      (s as { pet_id: string; followers_count: number }).pet_id,
      (s as { followers_count: number }).followers_count,
    ]),
  );

  return pets
    .map((p) => ({ ...p, followers_count: map.get(p.id) ?? 0 }))
    .sort((a, b) => (b.followers_count ?? 0) - (a.followers_count ?? 0));
}

export async function searchPets(query: string): Promise<Pet[]> {
  const trimmed = query.trim();
  if (trimmed.length < 1) return [];
  const { data, error } = await supabase
    .from('pets')
    .select('*')
    .ilike('name', `%${trimmed}%`)
    .order('name', { ascending: true })
    .limit(30);
  if (error) throw error;
  return (data ?? []) as Pet[];
}

// -------- Update / Delete --------

export async function updateProfile(
  userId: string,
  patch: { display_name?: string; bio?: string | null; avatar_url?: string | null },
) {
  const { error } = await supabase.from('profiles').update(patch).eq('id', userId);
  if (error) throw error;
}

export async function updatePet(
  petId: string,
  patch: Partial<Omit<Pet, 'id' | 'owner_id' | 'created_at' | 'updated_at'>>,
) {
  const { error } = await supabase.from('pets').update(patch).eq('id', petId);
  if (error) throw error;
}

export async function deletePet(petId: string) {
  const { error } = await supabase.from('pets').delete().eq('id', petId);
  if (error) throw error;
}

export async function deletePost(postId: string) {
  const { error } = await supabase.from('posts').delete().eq('id', postId);
  if (error) throw error;
}

// -------- Vaccinations --------

export async function fetchVaccinations(petId: string): Promise<Vaccination[]> {
  const { data, error } = await supabase
    .from('vaccinations')
    .select('*')
    .eq('pet_id', petId)
    .order('applied_at', { ascending: false });
  if (error) throw error;
  return (data ?? []) as Vaccination[];
}

export async function addVaccination(input: {
  pet_id: string;
  name: string;
  applied_at: string;
  next_dose_at?: string | null;
  vet_name?: string | null;
  notes?: string | null;
  photo_urls?: string[] | null;
}): Promise<Vaccination> {
  const { data, error } = await supabase
    .from('vaccinations')
    .insert(input)
    .select('*')
    .single();
  if (error) throw error;
  return data as Vaccination;
}

export async function updateVaccination(
  id: string,
  patch: Partial<Omit<Vaccination, 'id' | 'pet_id' | 'created_at' | 'updated_at'>>,
) {
  const { error } = await supabase.from('vaccinations').update(patch).eq('id', id);
  if (error) throw error;
}

export async function deleteVaccination(id: string) {
  const { error } = await supabase.from('vaccinations').delete().eq('id', id);
  if (error) throw error;
}

// -------- Parasite Treatments (vermífugo, anti-pulga, etc) --------

export interface ParasiteSummary {
  /** Total de tratamentos registrados. */
  total: number;
  /** Quantos estão atrasados (next_due_at < hoje). */
  overdue: number;
  /** Quantos vencem nos próximos 7 dias. */
  due_soon: number;
  /** Próximo tratamento a vencer, com nome e dias até vencer. */
  next_due: { product_name: string; due_at: string; days_until: number } | null;
}

export async function fetchParasiteTreatments(petId: string): Promise<ParasiteTreatment[]> {
  const { data, error } = await supabase
    .from('parasite_treatments')
    .select('*')
    .eq('pet_id', petId)
    .order('applied_at', { ascending: false });
  if (error) throw error;
  return (data ?? []) as ParasiteTreatment[];
}

export async function addParasiteTreatment(input: {
  pet_id: string;
  kind: ParasiteKind;
  product_name: string;
  product_slug?: string | null;
  applied_at: string;
  next_due_at?: string | null;
  interval_days?: number | null;
  vet_name?: string | null;
  dose?: string | null;
  weight_kg_at_treatment?: number | null;
  notes?: string | null;
}): Promise<ParasiteTreatment> {
  const { data, error } = await supabase
    .from('parasite_treatments')
    .insert(input)
    .select('*')
    .single();
  if (error) throw error;
  return data as ParasiteTreatment;
}

export async function updateParasiteTreatment(
  id: string,
  patch: Partial<Omit<ParasiteTreatment, 'id' | 'pet_id' | 'created_at' | 'updated_at'>>,
) {
  const { error } = await supabase.from('parasite_treatments').update(patch).eq('id', id);
  if (error) throw error;
}

export async function deleteParasiteTreatment(id: string) {
  const { error } = await supabase.from('parasite_treatments').delete().eq('id', id);
  if (error) throw error;
}

/**
 * Resumo de tratamentos antiparasitários — usado no banner de saúde e no card do perfil.
 * Considera apenas o último tratamento de cada kind (já que vermífugo + anti-pulga são
 * independentes e cada um tem seu próprio prazo de reaplicação).
 */
export async function fetchParasiteSummary(petId: string): Promise<ParasiteSummary> {
  const treatments = await fetchParasiteTreatments(petId);
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // Para cada kind, pegar o mais recente (já vem ordenado desc por applied_at)
  const latestByKind = new Map<ParasiteKind, ParasiteTreatment>();
  for (const t of treatments) {
    if (!latestByKind.has(t.kind)) latestByKind.set(t.kind, t);
  }

  let overdue = 0;
  let due_soon = 0;
  let nextDue: { product_name: string; due_at: string; days_until: number } | null = null;

  for (const t of latestByKind.values()) {
    if (!t.next_due_at) continue;
    const due = new Date(t.next_due_at);
    due.setHours(0, 0, 0, 0);
    const diffDays = Math.ceil((due.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
    if (diffDays < 0) overdue++;
    else if (diffDays <= 7) due_soon++;
    if (!nextDue || diffDays < nextDue.days_until) {
      nextDue = {
        product_name: t.product_name,
        due_at: t.next_due_at,
        days_until: diffDays,
      };
    }
  }

  return {
    total: treatments.length,
    overdue,
    due_soon,
    next_due: nextDue,
  };
}

// -------- Pet Agenda (eventos + logs + merge com saúde) --------

export async function fetchPetEvents(petId: string): Promise<PetEvent[]> {
  const { data, error } = await supabase
    .from('pet_events')
    .select('*')
    .eq('pet_id', petId)
    .eq('active', true)
    .order('starts_at', { ascending: true });
  if (error) throw error;
  return (data ?? []) as PetEvent[];
}

export async function addPetEvent(input: {
  pet_id: string;
  kind: PetEventKind;
  title: string;
  description?: string | null;
  location?: string | null;
  emoji?: string | null;
  starts_at: string;
  duration_minutes?: number | null;
  all_day?: boolean;
  recurrence_rule?: RecurrenceRule | null;
  recurrence_end_at?: string | null;
  reminder_minutes?: number[];
  estimated_cost?: number | null;
  color?: string | null;
}): Promise<PetEvent> {
  const { data, error } = await supabase
    .from('pet_events')
    .insert(input)
    .select('*')
    .single();
  if (error) throw error;
  return data as PetEvent;
}

export async function updatePetEvent(
  id: string,
  patch: Partial<Omit<PetEvent, 'id' | 'pet_id' | 'created_at' | 'updated_at'>>,
) {
  const { error } = await supabase.from('pet_events').update(patch).eq('id', id);
  if (error) throw error;
}

export async function deletePetEvent(id: string) {
  // Soft delete via active=false, mantém histórico de logs
  const { error } = await supabase.from('pet_events').update({ active: false }).eq('id', id);
  if (error) throw error;
}

export async function fetchPetEventLogs(petId: string, limit = 200): Promise<PetEventLog[]> {
  const { data, error } = await supabase
    .from('pet_event_logs')
    .select('*')
    .eq('pet_id', petId)
    .order('occurrence_date', { ascending: false })
    .limit(limit);
  if (error) throw error;
  return (data ?? []) as PetEventLog[];
}

export interface AgendaMemory {
  id: string;
  occurrence_date: string;
  completed_at: string | null;
  mood: number | null;
  notes: string | null;
  photo_url: string | null;
  event: { title: string; kind: string; emoji: string | null } | null;
}

/**
 * Atividades de agenda CONCLUÍDAS com FOTO (banho, passeio, tosa, treino...) —
 * as "memórias" que alimentam o diário. Junta o evento pai pelo event_id pra
 * pegar título/emoji. Só status='done' e com photo_url.
 */
export async function fetchPetAgendaMemories(petId: string, limit = 100): Promise<AgendaMemory[]> {
  const { data, error } = await supabase
    .from('pet_event_logs')
    .select('id, occurrence_date, completed_at, mood, notes, photo_url, status, event:pet_events(title, kind, emoji)')
    .eq('pet_id', petId)
    .eq('status', 'done')
    .not('photo_url', 'is', null)
    .order('occurrence_date', { ascending: false })
    .limit(limit);
  if (error) throw error;
  return (data ?? []) as unknown as AgendaMemory[];
}

/**
 * Marca ocorrência como concluída/skipada com mood e foto opcionais.
 * Idempotente: upsert na chave (event_id, occurrence_date).
 */
export async function logEventOccurrence(input: {
  event_id: string;
  pet_id: string;
  occurrence_date: string; // ISO date 'YYYY-MM-DD'
  status?: 'done' | 'skipped';
  mood?: number | null;
  notes?: string | null;
  photo_url?: string | null;
  actual_cost?: number | null;
}): Promise<PetEventLog> {
  const { data, error } = await supabase
    .from('pet_event_logs')
    .upsert(
      {
        ...input,
        status: input.status ?? 'done',
        completed_at: new Date().toISOString(),
      },
      { onConflict: 'event_id,occurrence_date' },
    )
    .select('*')
    .single();
  if (error) throw error;
  return data as PetEventLog;
}

export async function deleteEventLog(id: string) {
  const { error } = await supabase.from('pet_event_logs').delete().eq('id', id);
  if (error) throw error;
}

/**
 * Agenda agregada: junta pet_events + vacinas/parasitas/vet_visits/meetups
 * em uma lista única ordenada por data. Faz o merge no client-side.
 *
 * Usado pela tela de agenda principal — não materializa ocorrências aqui,
 * isso é feito no componente (lib/event-templates.expandOccurrences).
 */
export async function fetchAgendaRaw(petId: string): Promise<{
  events: PetEvent[];
  logs: PetEventLog[];
  vaccinations: Vaccination[];
  parasites: ParasiteTreatment[];
  vetVisits: VetVisit[];
}> {
  // Promise.allSettled — se uma tabela não existir (migration não rodada),
  // a agenda ainda carrega o que conseguiu. Cada fonte falha em silêncio.
  const settled = await Promise.allSettled([
    fetchPetEvents(petId),
    fetchPetEventLogs(petId, 100),
    fetchVaccinations(petId),
    fetchParasiteTreatments(petId),
    supabase
      .from('vet_visits')
      .select('*')
      .eq('pet_id', petId)
      .not('next_visit_at', 'is', null)
      .then((r) => (r.data ?? []) as VetVisit[]),
  ]);
  const safe = <T>(s: PromiseSettledResult<T>, fallback: T): T =>
    s.status === 'fulfilled' ? s.value : fallback;
  return {
    events: safe(settled[0] as PromiseSettledResult<PetEvent[]>, []),
    logs: safe(settled[1] as PromiseSettledResult<PetEventLog[]>, []),
    vaccinations: safe(settled[2] as PromiseSettledResult<Vaccination[]>, []),
    parasites: safe(settled[3] as PromiseSettledResult<ParasiteTreatment[]>, []),
    vetVisits: safe(settled[4] as PromiseSettledResult<VetVisit[]>, []),
  };
}

// -------- Pet Caretakers (compartilhamento) --------

export async function fetchPetCaretakers(petId: string): Promise<PetCaretakerWithProfile[]> {
  const { data, error } = await supabase
    .from('pet_caretakers')
    .select(`
      *,
      profile:profiles!pet_caretakers_user_id_fkey (id, display_name, avatar_url)
    `)
    .eq('pet_id', petId)
    .neq('status', 'revoked')
    .order('created_at', { ascending: true });
  if (error) throw error;
  return (data ?? []) as unknown as PetCaretakerWithProfile[];
}

export async function inviteCaretaker(input: {
  pet_id: string;
  invited_email: string;
  role: CaretakerRole;
  nickname?: string | null;
  invited_by: string;
}): Promise<PetCaretaker> {
  const { data, error } = await supabase
    .from('pet_caretakers')
    .insert(input)
    .select('*')
    .single();
  if (error) throw error;
  return data as PetCaretaker;
}

export async function updateCaretaker(
  id: string,
  patch: Partial<Pick<PetCaretaker, 'role' | 'nickname' | 'status'>>,
) {
  const { error } = await supabase.from('pet_caretakers').update(patch).eq('id', id);
  if (error) throw error;
}

export async function revokeCaretaker(id: string) {
  const { error } = await supabase
    .from('pet_caretakers')
    .update({ status: 'revoked' })
    .eq('id', id);
  if (error) throw error;
}

export async function acceptCaretakerInvite(token: string): Promise<string> {
  const { data, error } = await supabase.rpc('accept_caretaker_invite', { token });
  if (error) throw error;
  return data as string;
}

// -------- Pet Milestones (diário) --------

export async function fetchPetMilestones(petId: string): Promise<PetMilestone[]> {
  const { data, error } = await supabase
    .from('pet_milestones')
    .select('*')
    .eq('pet_id', petId)
    .order('happened_at', { ascending: false });
  if (error) throw error;
  return (data ?? []) as PetMilestone[];
}

export async function addPetMilestone(input: {
  pet_id: string;
  title: string;
  description?: string | null;
  happened_at: string;
  emoji?: string | null;
  photo_url?: string | null;
}) {
  const { error } = await supabase.from('pet_milestones').insert(input);
  if (error) throw error;
}

export async function deletePetMilestone(id: string) {
  const { error } = await supabase.from('pet_milestones').delete().eq('id', id);
  if (error) throw error;
}

// -------- Streak / Engajamento --------

export async function fetchUserPostDates(userId: string): Promise<string[]> {
  const myPets = await fetchMyPets(userId);
  if (myPets.length === 0) return [];
  const petIds = myPets.map((p) => p.id);
  const { data, error } = await supabase
    .from('posts')
    .select('created_at')
    .in('pet_id', petIds);
  if (error) throw error;
  return (data ?? []).map((d) => (d as { created_at: string }).created_at);
}

// -------- Wall of Fame --------

export async function fetchWallOfFame(viewerPetId: string): Promise<PostWithDetails[]> {
  const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

  const { data: postsData, error: postsErr } = await supabase
    .from('posts')
    .select('id, pet_id, caption, created_at, updated_at, reposted_from, pet:pets!posts_pet_id_fkey(*), media:post_media(*)')
    .gte('created_at', weekAgo)
    .limit(80)
    .returns<FeedRow[]>();
  if (postsErr) throw postsErr;
  const posts = postsData ?? [];
  if (posts.length === 0) return [];

  const ids = posts.map((p) => p.id);
  const [statsRes, likesRes] = await Promise.all([
    supabase.from('post_stats').select('*').in('post_id', ids),
    supabase.from('likes').select('post_id').eq('pet_id', viewerPetId).in('post_id', ids),
  ]);
  if (statsRes.error) throw statsRes.error;
  if (likesRes.error) throw likesRes.error;

  const statsByPost = new Map(statsRes.data?.map((s) => [s.post_id, s]) ?? []);
  const likedSet = new Set(likesRes.data?.map((l) => l.post_id) ?? []);

  return posts
    .map((p) => ({
      ...p,
      media: [...(p.media ?? [])].sort((a, b) => a.position - b.position),
      likes_count: statsByPost.get(p.id)?.likes_count ?? 0,
      comments_count: statsByPost.get(p.id)?.comments_count ?? 0,
      liked_by_me: likedSet.has(p.id),
    }))
    .filter((p) => p.likes_count > 0) // só posts com pelo menos 1 like
    .sort((a, b) => b.likes_count - a.likes_count)
    .slice(0, 20);
}

// -------- Sugestões de pets --------

export async function fetchSuggestedPets(
  viewerPetId: string,
  limit = 10,
): Promise<(Pet & { followers_count: number })[]> {
  // Quem o viewer já segue
  const { data: following, error: fErr } = await supabase
    .from('follows')
    .select('followed_pet_id')
    .eq('follower_pet_id', viewerPetId);
  if (fErr) throw fErr;
  const exclude = new Set<string>(
    (following ?? []).map((f) => (f as { followed_pet_id: string }).followed_pet_id),
  );
  exclude.add(viewerPetId);

  // Dono do viewer — pra não sugerir os outros pets da própria pessoa
  const { data: viewerPet } = await supabase
    .from('pets')
    .select('owner_id')
    .eq('id', viewerPetId)
    .maybeSingle();
  const viewerOwnerId = (viewerPet as { owner_id?: string } | null)?.owner_id ?? null;

  // Busca todos os pets recentes (mais que limit pra filtrar)
  const { data: pets, error: pErr } = await supabase
    .from('pets')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(limit * 4);
  if (pErr) throw pErr;

  const candidates = (pets ?? []).filter(
    (p) => !exclude.has(p.id) && (!viewerOwnerId || (p as Pet).owner_id !== viewerOwnerId),
  ) as Pet[];
  if (candidates.length === 0) return [];

  // Stats pra ordenar
  const ids = candidates.map((p) => p.id);
  const { data: stats } = await supabase.from('pet_stats').select('*').in('pet_id', ids);
  const followersByPet = new Map(
    (stats ?? []).map((s) => [
      (s as { pet_id: string }).pet_id,
      (s as { followers_count: number }).followers_count ?? 0,
    ]),
  );

  return candidates
    .map((p) => ({ ...p, followers_count: followersByPet.get(p.id) ?? 0 }))
    .sort((a, b) => b.followers_count - a.followers_count)
    .slice(0, limit);
}

// -------- Meetup edit/delete --------

export async function updateMeetup(
  id: string,
  patch: Partial<Omit<Meetup, 'id' | 'host_pet_id' | 'created_at'>>,
) {
  const { error } = await supabase.from('meetups').update(patch).eq('id', id);
  if (error) throw error;
}

export async function deleteMeetup(id: string) {
  const { error } = await supabase.from('meetups').delete().eq('id', id);
  if (error) throw error;
}

// -------- Lost & Found --------

export async function fetchLostReports(kind: LostReportKind | 'all' = 'all'): Promise<LostReportWithPet[]> {
  let query = supabase
    .from('lost_reports')
    .select('*, pet:pets!lost_reports_pet_id_fkey(*)')
    .eq('status', 'open')
    .order('created_at', { ascending: false })
    .limit(80);
  if (kind !== 'all') query = query.eq('kind', kind);
  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []) as unknown as LostReportWithPet[];
}

export async function fetchLostReport(id: string): Promise<LostReportWithPet | null> {
  const { data, error } = await supabase
    .from('lost_reports')
    .select('*, pet:pets!lost_reports_pet_id_fkey(*)')
    .eq('id', id)
    .maybeSingle();
  if (error) throw error;
  return (data ?? null) as unknown as LostReportWithPet | null;
}

export async function createLostReport(
  input: Omit<LostReport, 'id' | 'status' | 'created_at' | 'updated_at'>,
) {
  const { data, error } = await supabase
    .from('lost_reports')
    .insert(input)
    .select('id')
    .single();
  if (error) throw error;
  return (data as { id: string }).id;
}

export async function updateLostReport(id: string, patch: Partial<LostReport>) {
  const { error } = await supabase.from('lost_reports').update(patch).eq('id', id);
  if (error) throw error;
}

export async function resolveLostReport(id: string) {
  const { error } = await supabase
    .from('lost_reports')
    .update({ status: 'resolved' })
    .eq('id', id);
  if (error) throw error;
}

/**
 * Data de HOJE no fuso LOCAL do dispositivo (yyyy-MM-dd). NÃO usar
 * toISOString().split('T')[0] pra "hoje": isso é UTC e, à noite no Brasil
 * (UTC-3), vira o dia seguinte — fazia vacina/vermífugo/remédio de hoje cair
 * fora do filtro de data (colunas date no banco).
 */
function localDateStr(d: Date = new Date()): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export async function deleteLostReport(id: string) {
  // Limpa a mídia do storage ANTES de apagar a linha (senão fotos/vídeo ficam
  // órfãos no bucket). Best-effort: a exclusão da linha roda de qualquer forma.
  try {
    const { data: rep } = await supabase
      .from('lost_reports')
      .select('image_urls, video_url')
      .eq('id', id)
      .single();
    const urls: string[] = [
      ...(((rep as { image_urls?: string[] | null } | null)?.image_urls) ?? []),
      ...(((rep as { video_url?: string | null } | null)?.video_url) ? [(rep as { video_url?: string | null }).video_url as string] : []),
    ];
    if (urls.length) await Promise.all(urls.map((u) => deleteFromBucket('posts', u).catch(() => undefined)));
  } catch {
    // ignora — não bloqueia a exclusão
  }
  const { error } = await supabase.from('lost_reports').delete().eq('id', id);
  if (error) throw error;
}

// -------- Achievements (computed) --------

export interface AchievementInput {
  myPets: Pet[];
  totalPosts: number;
  maxFollowers: number;
  hostedMeetupsCount: number;
  vaccinations: Vaccination[];
  foundReportsCount: number;
  distinctGamesPlayed: number;
  maxGameDifficulty: number;
  tournamentWins: number;
  missionsCompleted: number;
  missionStreak: number;
  tutorPoints: number;
}

export async function fetchAchievementInput(userId: string): Promise<AchievementInput> {
  const myPets = await fetchMyPets(userId);
  // Stats de jogo são do tutor (user_id), independem de ter pet cadastrado.
  const gameStatsRes = await supabase.rpc('game_player_stats');
  const gstats = (gameStatsRes.data as { distinct_games: number; max_difficulty: number }[] | null)?.[0];
  const distinctGamesPlayed = gstats?.distinct_games ?? 0;
  const maxGameDifficulty = gstats?.max_difficulty ?? 0;

  // Vitórias de torneio (pódio) — nível tutor, independe de ter pet.
  const tournamentWinsRes = await supabase
    .from('tournament_winners')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId);
  const tournamentWins = tournamentWinsRes.count ?? 0;

  // Missão do dia — total cumprido + streak atual (nível tutor, independe de pet).
  const [missionCountRes, todayMissionRes, tutorPointsRes] = await Promise.all([
    supabase
      .from('daily_mission_completions')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId),
    supabase.rpc('get_today_mission'),
    // Total vitalício de Pontos de Tutor — alimenta as badges pt_* (read-only,
    // soma o ledger imutável; ?? 0 se a RPC falhar, badges só ficam zeradas).
    supabase.rpc('my_tutor_points'),
  ]);
  const missionsCompleted = missionCountRes.count ?? 0;
  const missionRow = (todayMissionRes.data as { streak: number }[] | null)?.[0];
  const missionStreak = missionRow?.streak ?? 0;
  const tutorPoints = (tutorPointsRes.data as number | null) ?? 0;

  if (myPets.length === 0) {
    return {
      myPets,
      totalPosts: 0,
      maxFollowers: 0,
      hostedMeetupsCount: 0,
      vaccinations: [],
      foundReportsCount: 0,
      distinctGamesPlayed,
      maxGameDifficulty,
      tournamentWins,
      missionsCompleted,
      missionStreak,
      tutorPoints,
    };
  }
  const petIds = myPets.map((p) => p.id);

  const [postsRes, followersRes, meetupsRes, vacsRes, foundRes] = await Promise.all([
    supabase.from('posts').select('id', { count: 'exact', head: true }).in('pet_id', petIds),
    supabase.from('pet_stats').select('followers_count').in('pet_id', petIds),
    supabase
      .from('meetups')
      .select('id', { count: 'exact', head: true })
      .in('host_pet_id', petIds),
    supabase.from('vaccinations').select('*').in('pet_id', petIds),
    supabase
      .from('lost_reports')
      .select('id', { count: 'exact', head: true })
      .eq('reporter_user_id', userId)
      .eq('kind', 'found'),
  ]);

  const maxFollowers = (followersRes.data ?? []).reduce<number>(
    (m, r) => Math.max(m, (r as { followers_count: number }).followers_count ?? 0),
    0,
  );

  return {
    myPets,
    totalPosts: postsRes.count ?? 0,
    maxFollowers,
    hostedMeetupsCount: meetupsRes.count ?? 0,
    vaccinations: (vacsRes.data ?? []) as Vaccination[],
    foundReportsCount: foundRes.count ?? 0,
    distinctGamesPlayed,
    maxGameDifficulty,
    tournamentWins,
    missionsCompleted,
    missionStreak,
    tutorPoints,
  };
}

// -------- Followers / Following --------

interface FollowerRow {
  pet: Pet;
}

export async function fetchFollowers(petId: string): Promise<Pet[]> {
  const { data, error } = await supabase
    .from('follows')
    .select('pet:pets!follower_pet_id(*)')
    .eq('followed_pet_id', petId)
    .order('created_at', { ascending: false })
    .returns<FollowerRow[]>();
  if (error) throw error;
  return (data ?? []).map((r) => r.pet).filter(Boolean);
}

// -------- Saved posts (bookmarks) --------

export async function fetchSavedPostIds(userId: string): Promise<Set<string>> {
  const { data, error } = await supabase
    .from('saved_posts')
    .select('post_id')
    .eq('user_id', userId);
  if (error) throw error;
  return new Set((data ?? []).map((r) => (r as { post_id: string }).post_id));
}

export async function toggleSavePost(userId: string, postId: string, currentlySaved: boolean) {
  if (currentlySaved) {
    const { error } = await supabase
      .from('saved_posts')
      .delete()
      .match({ user_id: userId, post_id: postId });
    if (error) throw error;
  } else {
    const { error } = await supabase.from('saved_posts').insert({ user_id: userId, post_id: postId });
    if (error) throw error;
  }
}

export async function fetchSavedPosts(userId: string, viewerPetId: string): Promise<PostWithDetails[]> {
  const { data, error } = await supabase
    .from('saved_posts')
    .select('post_id, created_at, post:posts!post_id(id, pet_id, caption, created_at, updated_at, reposted_from, pet:pets!posts_pet_id_fkey(*), media:post_media(*))')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(60);
  if (error) throw error;
  const rows = (data ?? []) as unknown as { post: FeedRow | null }[];
  const posts = rows.map((r) => r.post).filter((p): p is FeedRow => p != null);
  if (posts.length === 0) return [];

  const ids = posts.map((r) => r.id);
  const [statsRes, likesRes] = await Promise.all([
    supabase.from('post_stats').select('*').in('post_id', ids),
    supabase.from('likes').select('post_id').eq('pet_id', viewerPetId).in('post_id', ids),
  ]);
  if (statsRes.error) throw statsRes.error;
  if (likesRes.error) throw likesRes.error;

  const statsByPost = new Map(statsRes.data?.map((s) => [s.post_id, s]) ?? []);
  const likedSet = new Set(likesRes.data?.map((l) => l.post_id) ?? []);

  return hydrateRepostsAndTags(
    posts.map((r) => ({
      ...r,
      media: [...(r.media ?? [])].sort((a, b) => a.position - b.position),
      likes_count: statsByPost.get(r.id)?.likes_count ?? 0,
      comments_count: statsByPost.get(r.id)?.comments_count ?? 0,
      liked_by_me: likedSet.has(r.id),
    })),
  );
}

// -------- Notifications --------

export async function fetchNotifications(userId: string): Promise<NotificationWithDetails[]> {
  const { data, error } = await supabase
    .from('notifications')
    .select('*, actor:pets!actor_pet_id(*), target_pet:pets!target_pet_id(*)')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(100)
    .returns<NotificationWithDetails[]>();
  if (error) throw error;
  return data ?? [];
}

export async function fetchUnreadNotificationCount(userId: string): Promise<number> {
  const { count, error } = await supabase
    .from('notifications')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)
    .eq('read', false);
  if (error) throw error;
  return count ?? 0;
}

export async function markAllNotificationsRead(userId: string) {
  const { error } = await supabase
    .from('notifications')
    .update({ read: true })
    .eq('user_id', userId)
    .eq('read', false);
  if (error) throw error;
}

export async function fetchFollowing(petId: string): Promise<Pet[]> {
  const { data, error } = await supabase
    .from('follows')
    .select('pet:pets!followed_pet_id(*)')
    .eq('follower_pet_id', petId)
    .order('created_at', { ascending: false })
    .returns<FollowerRow[]>();
  if (error) throw error;
  return (data ?? []).map((r) => r.pet).filter(Boolean);
}

// -------- Chat / DM --------

export async function getOrCreateDM(otherUserId: string): Promise<string> {
  const { data, error } = await supabase.rpc('get_or_create_dm', { other_user_id: otherUserId });
  if (error) throw error;
  return data as string;
}

export async function fetchConversations(_userId: string): Promise<ConversationSummary[]> {
  // UMA RPC agregada (get_conversation_summaries) no lugar do N+1 antigo (~2N+2
  // round-trips). Escopada em auth.uid() no servidor; devolve por conversa a
  // última msg + contagem de não-lidas + perfil do outro, numa query só.
  const { data, error } = await supabase.rpc('get_conversation_summaries');
  if (error) throw error;
  type Row = {
    id: string;
    last_message_at: string;
    unread_count: number;
    last_message: Message | null;
    other_user: Profile;
  };
  return ((data ?? []) as Row[]).map((r) => ({
    id: r.id,
    last_message_at: r.last_message_at,
    last_message: r.last_message,
    other_user: r.other_user,
    unread_count: r.unread_count,
  }));
}

export async function fetchMessages(conversationId: string): Promise<Message[]> {
  // Busca as 50 mensagens MAIS RECENTES (desc) e reordena pra ASC na exibição.
  // Com `ascending: true` + limit, o Postgres devolvia as 50 mais ANTIGAS e
  // escondia as recentes em conversas longas (o chat "congelava" no começo).
  const { data, error } = await supabase
    .from('messages')
    .select('*')
    .eq('conversation_id', conversationId)
    .order('created_at', { ascending: false })
    .limit(50);
  if (error) throw error;
  return ((data ?? []) as Message[]).reverse();
}

export async function fetchConversationOtherUser(conversationId: string, myUserId: string): Promise<Profile | null> {
  // 2 passos: pega user_id do outro, depois busca o profile
  const { data: row, error } = await supabase
    .from('conversation_participants')
    .select('user_id')
    .eq('conversation_id', conversationId)
    .neq('user_id', myUserId)
    .maybeSingle();
  if (error) throw error;
  if (!row) return null;
  const { data: profile } = await supabase.from('profiles').select('*').eq('id', row.user_id).maybeSingle();
  return (profile as Profile | null) ?? null;
}

/** O tutor (dono) é Pet Pro? Usado pro selo dourado no perfil do pet. */
export async function fetchUserIsPro(userId: string): Promise<boolean> {
  const { data } = await supabase
    .from('profiles')
    .select('is_pro')
    .eq('id', userId)
    .maybeSingle();
  return !!(data as { is_pro?: boolean } | null)?.is_pro;
}

/** Primeiro pet de um tutor — pra abrir o perfil do pet a partir do chat. */
export async function fetchUserFirstPet(userId: string): Promise<Pet | null> {
  const { data } = await supabase
    .from('pets')
    .select('*')
    .eq('owner_id', userId)
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle();
  return (data as Pet | null) ?? null;
}

export async function sendMessage(conversationId: string, senderId: string, content: string): Promise<Message> {
  const trimmed = content.trim();
  if (!trimmed) throw new Error('mensagem vazia');
  const { data, error } = await supabase
    .from('messages')
    .insert({ conversation_id: conversationId, sender_id: senderId, content: trimmed })
    .select('*')
    .single();
  if (error) throw error;
  return data as Message;
}

export async function markConversationRead(conversationId: string, userId: string) {
  const { error } = await supabase
    .from('conversation_participants')
    .update({ last_read_at: new Date().toISOString() })
    .eq('conversation_id', conversationId)
    .eq('user_id', userId);
  if (error) throw error;
}

/**
 * last_read_at do OUTRO participante — pra recibo de leitura (✓ enviado / ✓✓
 * lido). Uma msg minha vira "lida" quando o last_read_at do outro passou do
 * created_at dela. Reusa o dado que já existe; sem coluna nova em messages.
 */
export async function fetchOtherLastReadAt(conversationId: string, myUserId: string): Promise<string | null> {
  const { data, error } = await supabase
    .from('conversation_participants')
    .select('last_read_at')
    .eq('conversation_id', conversationId)
    .neq('user_id', myUserId)
    .maybeSingle();
  if (error) throw error;
  return (data?.last_read_at as string | undefined) ?? null;
}

export async function fetchUnreadMessageCount(_userId: string): Promise<number> {
  // Total de não-lidas numa query só (RPC unread_message_total, escopada em
  // auth.uid()). Antes era N+1 (1 COUNT por conversa) rodando em polling.
  const { data, error } = await supabase.rpc('unread_message_total');
  if (error) throw error;
  return typeof data === 'number' ? data : 0;
}

/**
 * Garante que o usuário logado recebeu a DM de boas-vindas do Mozart (mascote
 * oficial). Idempotente no servidor (flag profiles.mozart_welcomed) — pode
 * chamar à vontade. Não lança em erro pra não atrapalhar o fluxo.
 */
export async function sendMozartWelcome(): Promise<void> {
  const { error } = await supabase.rpc('mozart_send_welcome');
  if (error) throw error;
}

// -------- Pet Health: Medications --------

export async function fetchMedications(petId: string): Promise<MedicationWithLogs[]> {
  const { data, error } = await supabase
    .from('medications')
    .select('*')
    .eq('pet_id', petId)
    .order('active', { ascending: false })
    .order('start_date', { ascending: false });
  if (error) throw error;
  const meds = (data ?? []) as Medication[];
  if (meds.length === 0) return [];

  // Para cada medicação, pega último log + número de doses de hoje
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const todayIso = todayStart.toISOString();

  const enriched = await Promise.all(
    meds.map(async (m) => {
      const { data: lastLog } = await supabase
        .from('medication_logs')
        .select('*')
        .eq('medication_id', m.id)
        .order('administered_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      const { count } = await supabase
        .from('medication_logs')
        .select('id', { count: 'exact', head: true })
        .eq('medication_id', m.id)
        .gte('administered_at', todayIso);
      return {
        ...m,
        last_log: (lastLog as MedicationLog | null) ?? null,
        doses_today: count ?? 0,
      } as MedicationWithLogs;
    }),
  );
  return enriched;
}

export async function createMedication(input: {
  pet_id: string;
  name: string;
  dosage?: string;
  frequency: MedicationFrequency;
  time_of_day?: string;
  start_date?: string;
  end_date?: string | null;
  notes?: string;
}): Promise<Medication> {
  const { data, error } = await supabase
    .from('medications')
    .insert({
      ...input,
      start_date: input.start_date ?? localDateStr(),
    })
    .select('*')
    .single();
  if (error) throw error;
  return data as Medication;
}

export async function updateMedication(id: string, patch: Partial<Medication>): Promise<void> {
  const { error } = await supabase.from('medications').update(patch).eq('id', id);
  if (error) throw error;
}

export async function deleteMedication(id: string): Promise<void> {
  const { error } = await supabase.from('medications').delete().eq('id', id);
  if (error) throw error;
}

export async function logMedicationDose(
  medicationId: string,
  notes?: string,
): Promise<MedicationLog> {
  const { data, error } = await supabase
    .from('medication_logs')
    .insert({ medication_id: medicationId, notes: notes ?? null })
    .select('*')
    .single();
  if (error) throw error;
  return data as MedicationLog;
}

export async function fetchMedicationLogs(medicationId: string, limit = 30): Promise<MedicationLog[]> {
  const { data, error } = await supabase
    .from('medication_logs')
    .select('*')
    .eq('medication_id', medicationId)
    .order('administered_at', { ascending: false })
    .limit(limit);
  if (error) throw error;
  return (data ?? []) as MedicationLog[];
}

// -------- Pet Health: Vet Visits --------

export async function fetchVetVisits(petId: string): Promise<VetVisit[]> {
  const { data, error } = await supabase
    .from('vet_visits')
    .select('*')
    .eq('pet_id', petId)
    .order('visited_at', { ascending: false });
  if (error) throw error;
  return (data ?? []) as VetVisit[];
}

export async function createVetVisit(input: {
  pet_id: string;
  visited_at: string;
  vet_name?: string;
  clinic_name?: string;
  reason: string;
  diagnosis?: string;
  treatment?: string;
  weight_kg?: number;
  next_visit_at?: string;
  notes?: string;
  photo_urls?: string[] | null;
}): Promise<VetVisit> {
  const { data, error } = await supabase
    .from('vet_visits')
    .insert(input)
    .select('*')
    .single();
  if (error) throw error;
  // Se o vet pesou, registra também em weight_records
  if (input.weight_kg && data) {
    await supabase
      .from('weight_records')
      .insert({
        pet_id: input.pet_id,
        weight_kg: input.weight_kg,
        weighed_at: input.visited_at,
        notes: `Pesagem na consulta — ${input.reason}`,
      });
  }
  return data as VetVisit;
}

export async function updateVetVisit(id: string, patch: Partial<VetVisit>): Promise<void> {
  const { error } = await supabase.from('vet_visits').update(patch).eq('id', id);
  if (error) throw error;
}

export async function deleteVetVisit(id: string): Promise<void> {
  const { error } = await supabase.from('vet_visits').delete().eq('id', id);
  if (error) throw error;
}

// -------- Pet Health: Symptoms (registros pro vet) --------
//
// IMPORTANTE: pet_symptoms são REGISTROS do tutor pra mostrar pro vet.
// O app NUNCA diagnostica. Severidade = percepção do tutor, não classificação clínica.

export type SymptomFilter = 'all' | 'active' | 'resolved' | 'flagged';

export async function fetchPetSymptoms(
  petId: string,
  filter: SymptomFilter = 'all',
): Promise<PetSymptom[]> {
  let q = supabase
    .from('pet_symptoms')
    .select('*')
    .eq('pet_id', petId)
    .order('recorded_at', { ascending: false });

  if (filter === 'active') q = q.is('resolved_at', null);
  else if (filter === 'resolved') q = q.not('resolved_at', 'is', null);
  else if (filter === 'flagged') q = q.eq('flagged_for_vet', true);

  const { data, error } = await q;
  if (error) throw error;
  return (data ?? []) as PetSymptom[];
}

export async function createPetSymptom(input: {
  pet_id: string;
  description: string;
  severity: number;
  recorded_at?: string;
  body_part?: string;
  photo_urls?: string[];
  notes?: string;
  flagged_for_vet?: boolean;
}): Promise<PetSymptom> {
  const { data, error } = await supabase
    .from('pet_symptoms')
    .insert({
      pet_id: input.pet_id,
      description: input.description,
      severity: input.severity,
      recorded_at: input.recorded_at ?? new Date().toISOString(),
      body_part: input.body_part ?? null,
      photo_urls: input.photo_urls ?? null,
      notes: input.notes ?? null,
      flagged_for_vet: input.flagged_for_vet ?? false,
    })
    .select('*')
    .single();
  if (error) throw error;
  return data as PetSymptom;
}

export async function updatePetSymptom(
  id: string,
  patch: Partial<Omit<PetSymptom, 'id' | 'pet_id' | 'created_at'>>,
): Promise<void> {
  const { error } = await supabase.from('pet_symptoms').update(patch).eq('id', id);
  if (error) throw error;
}

export async function resolveSymptom(id: string): Promise<void> {
  const { error } = await supabase
    .from('pet_symptoms')
    .update({ resolved_at: new Date().toISOString() })
    .eq('id', id);
  if (error) throw error;
}

export async function reopenSymptom(id: string): Promise<void> {
  const { error } = await supabase
    .from('pet_symptoms')
    .update({ resolved_at: null })
    .eq('id', id);
  if (error) throw error;
}

export async function deletePetSymptom(id: string): Promise<void> {
  const { error } = await supabase.from('pet_symptoms').delete().eq('id', id);
  if (error) throw error;
}

// -------- Pet Health: Weight --------

export async function fetchWeightRecords(petId: string): Promise<WeightRecord[]> {
  const { data, error } = await supabase
    .from('weight_records')
    .select('*')
    .eq('pet_id', petId)
    .order('weighed_at', { ascending: true });
  if (error) throw error;
  return (data ?? []) as WeightRecord[];
}

export async function addWeightRecord(input: {
  pet_id: string;
  weight_kg: number;
  weighed_at?: string;
  notes?: string;
}): Promise<WeightRecord> {
  const { data, error } = await supabase
    .from('weight_records')
    .insert({
      ...input,
      weighed_at: input.weighed_at ?? localDateStr(),
    })
    .select('*')
    .single();
  if (error) throw error;
  return data as WeightRecord;
}

export async function deleteWeightRecord(id: string): Promise<void> {
  const { error } = await supabase.from('weight_records').delete().eq('id', id);
  if (error) throw error;
}

// -------- Pet Health: Summary --------

export async function fetchHealthSummary(petId: string): Promise<HealthSummary> {
  const todayStr = localDateStr();

  // Próxima vacina (mais cedo no futuro, não null)
  const { data: vacs } = await supabase
    .from('vaccinations')
    .select('*')
    .eq('pet_id', petId)
    .not('next_dose_at', 'is', null)
    .gte('next_dose_at', todayStr)
    .order('next_dose_at', { ascending: true })
    .limit(1);
  const nextVac = (vacs?.[0] as Vaccination | undefined) ?? null;
  const next_vaccine = nextVac
    ? (() => {
        const due = new Date(nextVac.next_dose_at!);
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const daysUntil = Math.ceil((due.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
        return { name: nextVac.name, due_at: nextVac.next_dose_at!, days_until: daysUntil };
      })()
    : null;

  // Total de vacinas registradas — pro score reconhecer o registro mesmo quando
  // a "próxima dose" (opcional) não foi preenchida.
  const { count: vaccinationsCount } = await supabase
    .from('vaccinations')
    .select('id', { count: 'exact', head: true })
    .eq('pet_id', petId);

  // Medicamentos ativos
  const { count: activeMedCount } = await supabase
    .from('medications')
    .select('id', { count: 'exact', head: true })
    .eq('pet_id', petId)
    .eq('active', true);

  // Pra hoje: pega medicações ativas e calcula quantas estão "pendentes hoje"
  // Simplificado: conta os com freq daily/twice_daily/weekly/monthly
  const { data: activeMeds } = await supabase
    .from('medications')
    .select('id, frequency')
    .eq('pet_id', petId)
    .eq('active', true);

  let dueToday = 0;
  if (activeMeds && activeMeds.length > 0) {
    const dayStart = new Date();
    dayStart.setHours(0, 0, 0, 0);
    for (const m of activeMeds) {
      if (m.frequency === 'as_needed') continue;
      const { count } = await supabase
        .from('medication_logs')
        .select('id', { count: 'exact', head: true })
        .eq('medication_id', m.id)
        .gte('administered_at', dayStart.toISOString());
      const expected = m.frequency === 'twice_daily' ? 2 : 1;
      if (m.frequency === 'daily' || m.frequency === 'twice_daily') {
        if ((count ?? 0) < expected) dueToday += expected - (count ?? 0);
      }
    }
  }

  // Última e próxima visita ao vet
  const { data: lastVisit } = await supabase
    .from('vet_visits')
    .select('*')
    .eq('pet_id', petId)
    .lte('visited_at', todayStr)
    .order('visited_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  const { data: nextVisit } = await supabase
    .from('vet_visits')
    .select('*')
    .eq('pet_id', petId)
    .not('next_visit_at', 'is', null)
    .gte('next_visit_at', todayStr)
    .order('next_visit_at', { ascending: true })
    .limit(1)
    .maybeSingle();

  // Peso mais recente
  const { data: latestW } = await supabase
    .from('weight_records')
    .select('*')
    .eq('pet_id', petId)
    .order('weighed_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  return {
    next_vaccine,
    vaccinations_count: vaccinationsCount ?? 0,
    active_medications_count: activeMedCount ?? 0,
    due_medications_today: dueToday,
    last_vet_visit: (lastVisit as VetVisit | null) ?? null,
    next_vet_visit: (nextVisit as VetVisit | null) ?? null,
    latest_weight: (latestW as WeightRecord | null) ?? null,
  };
}

// -------- Privacy: Blocks --------

export async function fetchBlockedUsers(userId: string): Promise<string[]> {
  const { data, error } = await supabase
    .from('blocked_users')
    .select('blocked_id')
    .eq('blocker_id', userId);
  if (error) throw error;
  return (data ?? []).map((r) => r.blocked_id as string);
}

export async function blockUser(blockerId: string, blockedId: string): Promise<void> {
  if (blockerId === blockedId) throw new Error('não dá pra bloquear você mesmo');
  const { error } = await supabase
    .from('blocked_users')
    .insert({ blocker_id: blockerId, blocked_id: blockedId });
  if (error && error.code !== '23505') throw error; // ignora duplicate key
}

export async function unblockUser(blockerId: string, blockedId: string): Promise<void> {
  const { error } = await supabase
    .from('blocked_users')
    .delete()
    .eq('blocker_id', blockerId)
    .eq('blocked_id', blockedId);
  if (error) throw error;
}

export async function isUserBlocked(blockerId: string, blockedId: string): Promise<boolean> {
  if (!blockerId || !blockedId || blockerId === blockedId) return false;
  const { data, error } = await supabase
    .from('blocked_users')
    .select('blocker_id')
    .eq('blocker_id', blockerId)
    .eq('blocked_id', blockedId)
    .maybeSingle();
  if (error) throw error;
  return data !== null;
}

/**
 * Existe bloqueio entre A e B em QUALQUER direção? (eu bloqueei ele OU ele me
 * bloqueou). Usa o RPC has_block_between (SECURITY DEFINER) — o `isUserBlocked`
 * só cobre o sentido "eu bloqueei", insuficiente pro gate de enviar mensagem.
 */
export async function hasBlockBetween(a: string, b: string): Promise<boolean> {
  if (!a || !b || a === b) return false;
  const { data, error } = await supabase.rpc('has_block_between', { a, b });
  if (error) throw error;
  return data === true;
}

// -------- Moderation: Reports --------

export async function createReport(input: {
  reporter_user_id: string;
  target_kind: ReportTargetKind;
  target_id: string;
  reason: ReportReason;
  notes?: string;
}): Promise<void> {
  // Dedup: existe índice único (reporter, target_kind, target_id). Upsert com
  // ignoreDuplicates → denunciar de novo o mesmo alvo não dá erro (só não duplica).
  const { error } = await supabase
    .from('reports')
    .upsert(input, {
      onConflict: 'reporter_user_id,target_kind,target_id',
      ignoreDuplicates: true,
    });
  if (error) throw error;
}

export async function attachHashtagsToPost(postId: string, text: string): Promise<void> {
  const tags = extractHashtags(text);
  if (tags.length === 0) return;
  // Upsert hashtags (uma por linha)
  const inserts = tags.map((name) => ({ name }));
  await supabase.from('hashtags').upsert(inserts, { onConflict: 'name', ignoreDuplicates: false });
  // Busca os ids
  const { data: rows } = await supabase.from('hashtags').select('id, name').in('name', tags);
  if (!rows || rows.length === 0) return;
  const links = rows.map((r) => ({ post_id: postId, hashtag_id: r.id }));
  await supabase.from('post_hashtags').upsert(links, { ignoreDuplicates: true });
}

/** Página da hashtag: posts + cursor (created_at do link) pra próxima. */
export interface HashtagPage {
  items: PostWithDetails[];
  nextCursor: string | null;
}

export async function fetchPostsByHashtag(
  name: string,
  viewerPetId: string,
  cursor?: string | null,
): Promise<HashtagPage> {
  const PAGE = 24;
  const lower = name.toLowerCase();
  const { data: tag } = await supabase
    .from('hashtags')
    .select('id')
    .eq('name', lower)
    .maybeSingle();
  if (!tag) return { items: [], nextCursor: null };
  // Keyset pela data do LINK post_hashtags (≈ data do post). `.lt` evita dup.
  let linkQuery = supabase
    .from('post_hashtags')
    .select('post_id, created_at')
    .eq('hashtag_id', tag.id)
    .order('created_at', { ascending: false })
    .limit(PAGE);
  if (cursor) linkQuery = linkQuery.lt('created_at', cursor);
  const { data: links } = await linkQuery;
  const linkRows = (links ?? []) as { post_id: string; created_at: string }[];
  const lastLink = linkRows[linkRows.length - 1];
  const nextCursor = linkRows.length === PAGE && lastLink ? lastLink.created_at : null;

  const postIds = linkRows.map((l) => l.post_id);
  if (postIds.length === 0) return { items: [], nextCursor };

  const { data: rows, error } = await supabase
    .from('posts')
    .select('id, pet_id, caption, created_at, updated_at, reposted_from, pet:pets!posts_pet_id_fkey(*), media:post_media(*)')
    .in('id', postIds)
    .order('created_at', { ascending: false })
    .returns<FeedRow[]>();
  if (error) throw error;
  if (!rows || rows.length === 0) return { items: [], nextCursor };

  const [statsRes, likesRes] = await Promise.all([
    supabase.from('post_stats').select('*').in('post_id', rows.map((r) => r.id)),
    supabase.from('likes').select('post_id').eq('pet_id', viewerPetId).in('post_id', rows.map((r) => r.id)),
  ]);
  const statsByPost = new Map(statsRes.data?.map((s) => [s.post_id, s]) ?? []);
  const likedSet = new Set(likesRes.data?.map((l) => l.post_id) ?? []);

  const items = await hydrateRepostsAndTags(
    rows.map((r) => ({
      ...r,
      media: [...(r.media ?? [])].sort((a, b) => a.position - b.position),
      likes_count: statsByPost.get(r.id)?.likes_count ?? 0,
      comments_count: statsByPost.get(r.id)?.comments_count ?? 0,
      liked_by_me: likedSet.has(r.id),
    })),
  );
  return { items, nextCursor };
}

export async function fetchTrendingHashtags(): Promise<{ name: string; post_count: number }[]> {
  // Top hashtags com mais posts nos últimos 7 dias
  const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
  const { data, error } = await supabase
    .from('post_hashtags')
    .select('hashtag_id, hashtag:hashtags(name)')
    .gte('created_at', since)
    .limit(200)
    .returns<{ hashtag_id: string; hashtag: { name: string } }[]>();
  if (error) throw error;
  if (!data) return [];
  const counts = new Map<string, number>();
  for (const row of data) {
    const name = row.hashtag?.name;
    if (!name) continue;
    counts.set(name, (counts.get(name) ?? 0) + 1);
  }
  return Array.from(counts.entries())
    .map(([name, post_count]) => ({ name, post_count }))
    .sort((a, b) => b.post_count - a.post_count)
    .slice(0, 10);
}

// -------- Mentions: notifica usuários mencionados --------

export async function notifyMentions(text: string, actorPetId: string, postId?: string): Promise<void> {
  const mentions = extractMentions(text);
  if (mentions.length === 0) return;
  // Busca profiles por display_name (case insensitive, prefix match)
  const { data: profiles } = await supabase
    .from('profiles')
    .select('id, display_name')
    .or(mentions.map((m) => `display_name.ilike.${m}%`).join(','));
  if (!profiles || profiles.length === 0) return;
  // Chama RPC SECURITY DEFINER pra criar cada notificação (bypassa RLS)
  await Promise.all(
    profiles.map((p) =>
      supabase.rpc('notify_mention', {
        target_user: p.id,
        actor_pet: actorPetId,
        post_id_param: postId ?? null,
      }),
    ),
  );
}

// -------- Places (Pet Shops & Vets) --------

export async function fetchPlaces(filter: {
  kind?: PlaceKind;
  city?: string;
  search?: string;
  near?: { lat: number; lng: number };
  limit?: number;
}): Promise<PlaceWithStats[]> {
  const limit = filter.limit ?? 150;
  // "Perto de mim": ordena por distância NO SERVIDOR e traz os mais próximos
  // (RPC places_nearby) — essencial com milhares de lugares; já vem com stats.
  if (filter.near) {
    const { data, error } = await supabase.rpc('places_nearby', {
      p_lat: filter.near.lat,
      p_lng: filter.near.lng,
      p_kind: filter.kind ?? null,
      p_search: filter.search?.trim() || null,
      p_limit: limit,
    });
    if (error) throw error;
    return ((data ?? []) as Record<string, unknown>[]).map((p) => ({
      ...(p as unknown as Place),
      avg_rating: Number(p.avg_rating ?? 0),
      review_count: Number(p.review_count ?? 0),
    }));
  }

  let q = supabase.from('places').select('*');
  if (filter.kind) q = q.eq('kind', filter.kind);
  if (filter.city) q = q.ilike('city', `%${filter.city}%`);
  if (filter.search) {
    // sanitiza: tira os chars com significado no filtro PostgREST or() (, ( ) * % \)
    // pra o texto de busca não conseguir injetar condições extras.
    const safe = filter.search.replace(/[,()*%\\]/g, ' ').trim();
    if (safe) q = q.or(`name.ilike.%${safe}%,address.ilike.%${safe}%`);
  }
  q = q.order('verified', { ascending: false }).order('created_at', { ascending: false }).limit(limit);
  const { data: places, error } = await q;
  if (error) throw error;
  if (!places || places.length === 0) return [];

  const ids = places.map((p) => (p as Place).id);
  const { data: stats } = await supabase.from('place_stats').select('*').in('place_id', ids);
  const statsMap = new Map(stats?.map((s) => [s.place_id, s]) ?? []);

  return (places as Place[]).map((p) => ({
    ...p,
    avg_rating: Number(statsMap.get(p.id)?.avg_rating ?? 0),
    review_count: statsMap.get(p.id)?.review_count ?? 0,
  }));
}

/** Contagem de lugares por categoria (pra esconder chips de kind sem nenhum lugar). */
export async function fetchPlaceKindCounts(): Promise<Record<string, number>> {
  const { data, error } = await supabase.rpc('places_kind_counts');
  if (error) throw error;
  const out: Record<string, number> = {};
  for (const row of (data ?? []) as { kind: string; n: number }[]) {
    out[row.kind] = Number(row.n);
  }
  return out;
}

export async function fetchPlace(id: string): Promise<PlaceWithStats | null> {
  const { data, error } = await supabase.from('places').select('*').eq('id', id).maybeSingle();
  if (error) throw error;
  if (!data) return null;
  const { data: stats } = await supabase
    .from('place_stats')
    .select('*')
    .eq('place_id', id)
    .maybeSingle();
  return {
    ...(data as Place),
    avg_rating: Number(stats?.avg_rating ?? 0),
    review_count: stats?.review_count ?? 0,
  };
}

// -------- Lugares salvos (favoritos) → agenda/roteiro pet --------

export async function fetchSavedPlaceIds(userId: string): Promise<Set<string>> {
  const { data, error } = await supabase
    .from('place_favorites')
    .select('place_id')
    .eq('user_id', userId);
  if (error) throw error;
  return new Set((data ?? []).map((r) => (r as { place_id: string }).place_id));
}

export async function toggleSavePlace(userId: string, placeId: string, currentlySaved: boolean) {
  if (currentlySaved) {
    const { error } = await supabase
      .from('place_favorites')
      .delete()
      .match({ user_id: userId, place_id: placeId });
    if (error) throw error;
  } else {
    const { error } = await supabase
      .from('place_favorites')
      .insert({ user_id: userId, place_id: placeId });
    if (error) throw error;
  }
}

export async function fetchSavedPlaces(userId: string): Promise<PlaceWithStats[]> {
  const { data: favs, error } = await supabase
    .from('place_favorites')
    .select('place_id')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  const ids = (favs ?? []).map((r) => (r as { place_id: string }).place_id);
  if (ids.length === 0) return [];
  const { data: places } = await supabase.from('places').select('*').in('id', ids);
  if (!places) return [];
  const { data: stats } = await supabase.from('place_stats').select('*').in('place_id', ids);
  const statsMap = new Map(stats?.map((s) => [s.place_id, s]) ?? []);
  return (places as Place[]).map((p) => ({
    ...p,
    avg_rating: Number(statsMap.get(p.id)?.avg_rating ?? 0),
    review_count: statsMap.get(p.id)?.review_count ?? 0,
  }));
}

export async function createPlace(input: {
  added_by_user_id: string;
  name: string;
  kind: PlaceKind;
  address: string;
  city?: string;
  state?: string;
  description?: string;
  phone?: string;
  website?: string;
  hours?: string;
  latitude?: number;
  longitude?: number;
}): Promise<Place> {
  const { data, error } = await supabase.from('places').insert(input).select('*').single();
  if (error) throw error;
  return data as Place;
}

export async function fetchPlaceReviews(placeId: string): Promise<PlaceReviewWithProfile[]> {
  const { data: reviews, error } = await supabase
    .from('place_reviews')
    .select('*')
    .eq('place_id', placeId)
    .order('created_at', { ascending: false })
    .limit(50);
  if (error) throw error;
  if (!reviews || reviews.length === 0) return [];
  const userIds = Array.from(new Set(reviews.map((r) => (r as PlaceReview).user_id)));
  const { data: profiles } = await supabase.from('profiles').select('*').in('id', userIds);
  const profileMap = new Map((profiles ?? []).map((p) => [p.id, p as Profile]));
  return (reviews as PlaceReview[])
    .map<PlaceReviewWithProfile | null>((r) => {
      const profile = profileMap.get(r.user_id);
      if (!profile) return null;
      return { ...r, profile };
    })
    .filter((x): x is PlaceReviewWithProfile => x !== null);
}

export async function upsertPlaceReview(input: {
  place_id: string;
  user_id: string;
  rating: number;
  comment?: string;
  photo_urls?: string[];
  rating_service?: number | null;
  rating_price?: number | null;
  rating_cleanliness?: number | null;
  rating_petfriendly?: number | null;
}): Promise<void> {
  // Payload explícito: garante que limpar uma sub-nota/foto grave null/[] no upsert
  // (em vez de manter o valor antigo).
  const payload = {
    place_id: input.place_id,
    user_id: input.user_id,
    rating: input.rating,
    comment: input.comment ?? null,
    photo_urls: input.photo_urls ?? [],
    rating_service: input.rating_service ?? null,
    rating_price: input.rating_price ?? null,
    rating_cleanliness: input.rating_cleanliness ?? null,
    rating_petfriendly: input.rating_petfriendly ?? null,
  };
  const { error } = await supabase
    .from('place_reviews')
    .upsert(payload, { onConflict: 'place_id,user_id' });
  if (error) throw error;
}

/**
 * Preenche lat/lng de um lugar SÓ se ainda estiver sem coordenada (geocode
 * comunitário, via RPC SECURITY DEFINER — RLS de places não deixa qualquer um
 * dar UPDATE). Idempotente; não move lugar já posicionado.
 */
export async function setPlaceCoords(placeId: string, lat: number, lng: number): Promise<void> {
  const { error } = await supabase.rpc('set_place_coords', {
    p_place_id: placeId,
    p_lat: lat,
    p_lng: lng,
  });
  if (error) throw error;
}

export async function deletePlaceReview(placeId: string, userId: string): Promise<void> {
  const { error } = await supabase
    .from('place_reviews')
    .delete()
    .eq('place_id', placeId)
    .eq('user_id', userId);
  if (error) throw error;
}

// -------- Place photos (galeria da comunidade) --------

export async function fetchPlacePhotos(placeId: string): Promise<PlacePhoto[]> {
  const { data, error } = await supabase
    .from('place_photos')
    .select('*')
    .eq('place_id', placeId)
    .order('created_at', { ascending: false })
    .limit(30);
  if (error) throw error;
  return (data ?? []) as PlacePhoto[];
}

export async function addPlacePhoto(input: {
  place_id: string;
  user_id: string;
  url: string;
  storage_path: string;
  caption?: string;
}): Promise<void> {
  const { error } = await supabase.from('place_photos').insert(input);
  if (error) throw error;
}

export async function deletePlacePhoto(id: string): Promise<void> {
  const { error } = await supabase.from('place_photos').delete().eq('id', id);
  if (error) throw error;
}

// -------- Subscriptions / Pet Pro --------

export async function fetchSubscription(userId: string): Promise<Subscription | null> {
  const { data, error } = await supabase
    .from('subscriptions')
    .select('*')
    .eq('user_id', userId)
    .maybeSingle();
  if (error) throw error;
  return (data as Subscription | null) ?? null;
}

/**
 * Cria uma checkout session no Stripe via Edge Function.
 * Em dev (sem Edge Function deployada), retorna URL mock e loga aviso.
 */
export async function createCheckoutSession(plan: SubscriptionPlan): Promise<string> {
  try {
    const { data, error } = await supabase.functions.invoke('create-checkout-session', {
      body: { plan },
    });
    if (error) throw error;
    if (data?.url) return data.url as string;
    throw new Error('no url returned');
  } catch (err) {
    if (__DEV__) {
      console.warn('[createCheckoutSession] Edge function não deployada, usando mock (dev):', err);
      return `https://stripe.com/?dev_placeholder=true&plan=${plan}`;
    }
    // Produção: pagamento ainda não está ligado — não finge um checkout real
    // (evita mandar o usuário pra uma URL falsa do Stripe).
    throw new Error('O Pet Pro pago ainda não abriu. A gente te avisa quando estiver disponível! 🐾');
  }
}

/**
 * Cancela a assinatura no fim do período (não reembolsa).
 * Sem efeito imediato: o usuário continua Pro até current_period_end.
 */
export async function cancelSubscription(userId: string): Promise<void> {
  // TODO: chamar Edge Function `cancel-subscription`
  // Por enquanto, atualiza só o flag local
  const { error } = await supabase
    .from('subscriptions')
    .update({ cancel_at_period_end: true })
    .eq('user_id', userId);
  if (error) throw error;
}

export async function fetchSubscriptionEvents(userId: string, limit = 20) {
  const { data, error } = await supabase
    .from('subscription_events')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) throw error;
  return data ?? [];
}

// -------- Memorial --------

export async function markPetAsMemorial(petId: string, memorialAt: string, note?: string): Promise<void> {
  const { error } = await supabase
    .from('pets')
    .update({ memorial_at: memorialAt, memorial_note: note ?? null })
    .eq('id', petId);
  if (error) throw error;
}

export async function unmarkPetMemorial(petId: string): Promise<void> {
  const { error } = await supabase
    .from('pets')
    .update({ memorial_at: null, memorial_note: null })
    .eq('id', petId);
  if (error) throw error;
}

export async function fetchMemorialMessages(petId: string): Promise<MemorialMessageWithProfile[]> {
  const { data: msgs, error } = await supabase
    .from('memorial_messages')
    .select('*')
    .eq('pet_id', petId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  if (!msgs || msgs.length === 0) return [];

  const userIds = Array.from(new Set((msgs as MemorialMessage[]).map((m) => m.author_user_id)));
  const { data: profiles } = await supabase.from('profiles').select('*').in('id', userIds);
  const profileMap = new Map((profiles ?? []).map((p) => [p.id, p as Profile]));

  return (msgs as MemorialMessage[])
    .map<MemorialMessageWithProfile | null>((m) => {
      const profile = profileMap.get(m.author_user_id);
      if (!profile) return null;
      return { ...m, profile };
    })
    .filter((x): x is MemorialMessageWithProfile => x !== null);
}

export async function postMemorialMessage(petId: string, userId: string, message: string): Promise<void> {
  const { error } = await supabase
    .from('memorial_messages')
    .insert({ pet_id: petId, author_user_id: userId, message: message.trim() });
  if (error) throw error;
}

// -------- Personality --------

export async function savePersonality(petId: string, type: PersonalityType): Promise<void> {
  const { error } = await supabase
    .from('pets')
    .update({ personality_type: type, personality_taken_at: new Date().toISOString() })
    .eq('id', petId);
  if (error) throw error;
}

// -------- Time Capsule --------

export interface TimeCapsuleData {
  pet: Pet;
  topPosts: PostWithDetails[];
  stats: {
    postsCount: number;
    likesReceived: number;
    commentsReceived: number;
    daysActive: number;
    placesVisited: number;
  };
  monthlyHighlights: { month: string; postCount: number }[];
}

export async function fetchTimeCapsule(petId: string): Promise<TimeCapsuleData> {
  const yearAgo = new Date(Date.now() - 365 * 24 * 60 * 60 * 1000).toISOString();

  const { data: pet } = await supabase.from('pets').select('*').eq('id', petId).single();
  if (!pet) throw new Error('pet not found');

  // Posts do ano
  const { data: posts } = await supabase
    .from('posts')
    .select('id, pet_id, caption, created_at, updated_at, reposted_from, pet:pets!posts_pet_id_fkey(*), media:post_media(*)')
    .eq('pet_id', petId)
    .gte('created_at', yearAgo)
    .order('created_at', { ascending: false });

  const postsArr = (posts ?? []) as unknown as FeedRow[];

  // Stats por post
  const postIds = postsArr.map((p) => p.id);
  let topPosts: PostWithDetails[] = [];
  let totalLikes = 0;
  let totalComments = 0;

  if (postIds.length > 0) {
    const { data: stats } = await supabase
      .from('post_stats')
      .select('*')
      .in('post_id', postIds);
    const statsMap = new Map(stats?.map((s) => [s.post_id, s]) ?? []);

    const enriched: PostWithDetails[] = postsArr.map((p) => ({
      ...p,
      media: [...(p.media ?? [])].sort((a, b) => a.position - b.position),
      likes_count: statsMap.get(p.id)?.likes_count ?? 0,
      comments_count: statsMap.get(p.id)?.comments_count ?? 0,
      liked_by_me: false,
    }));
    enriched.forEach((p) => {
      totalLikes += p.likes_count;
      totalComments += p.comments_count;
    });
    topPosts = [...enriched].sort((a, b) => b.likes_count - a.likes_count).slice(0, 9);
  }

  // Histogram mensal
  const months: Record<string, number> = {};
  postsArr.forEach((p) => {
    const m = p.created_at.slice(0, 7); // YYYY-MM
    months[m] = (months[m] ?? 0) + 1;
  });
  const monthlyHighlights = Object.entries(months)
    .map(([month, postCount]) => ({ month, postCount }))
    .sort((a, b) => a.month.localeCompare(b.month));

  const firstPost = postsArr[postsArr.length - 1];
  const daysActive = firstPost
    ? Math.ceil((Date.now() - new Date(firstPost.created_at).getTime()) / (1000 * 60 * 60 * 24))
    : 0;

  // Places visitados (de meetups)
  const { data: rsvps } = await supabase
    .from('meetup_rsvps')
    .select('meetup_id')
    .eq('pet_id', petId);
  const placesVisited = rsvps?.length ?? 0;

  return {
    pet: pet as Pet,
    topPosts,
    stats: {
      postsCount: postsArr.length,
      likesReceived: totalLikes,
      commentsReceived: totalComments,
      daysActive,
      placesVisited,
    },
    monthlyHighlights,
  };
}

// -------- AI Assistant --------

export async function fetchAiConversations(userId: string): Promise<AiConversation[]> {
  const { data, error } = await supabase
    .from('ai_conversations')
    .select('*')
    .eq('user_id', userId)
    .order('updated_at', { ascending: false })
    .limit(50);
  if (error) throw error;
  return (data ?? []) as AiConversation[];
}

export async function createAiConversation(userId: string, petId: string | null, title: string): Promise<AiConversation> {
  const { data, error } = await supabase
    .from('ai_conversations')
    .insert({ user_id: userId, pet_id: petId, title })
    .select('*')
    .single();
  if (error) throw error;
  return data as AiConversation;
}

export async function fetchAiMessages(conversationId: string): Promise<AiMessage[]> {
  const { data, error } = await supabase
    .from('ai_messages')
    .select('*')
    .eq('conversation_id', conversationId)
    .order('created_at', { ascending: true });
  if (error) throw error;
  return (data ?? []) as AiMessage[];
}

/**
 * Conta mensagens enviadas pelo user nas últimas 24h.
 *
 * Usado pra rate limit do plano free (5 msgs/dia). Conta cross-conversations:
 * join via ai_conversations.user_id = user atual.
 *
 * RLS já garante que só vê suas próprias conversations — passamos
 * o userId só pra montar a query mais rápida (sem join).
 */
export async function fetchAiMessagesSentToday(userId: string): Promise<number> {
  const dayAgoISO = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const { count, error } = await supabase
    .from('ai_messages')
    .select('id, ai_conversations!inner(user_id)', { count: 'exact', head: true })
    .eq('role', 'user')
    .eq('ai_conversations.user_id', userId)
    // Mensagens que só receberam resposta automática local (IA fora do ar) NÃO
    // contam na cota diária — não faz sentido gastar cota numa não-resposta.
    .eq('is_fallback', false)
    .gte('created_at', dayAgoISO);
  if (error) {
    // Best-effort — em caso de erro, permite envio (não bloqueia user com bug)
    return 0;
  }
  return count ?? 0;
}

export async function sendAiMessage(
  conversationId: string,
  userMessage: string,
  pet?: Pet | null,
): Promise<AiMessage> {
  // 1) Salva mensagem do user
  const { data: userMsg, error: e1 } = await supabase
    .from('ai_messages')
    .insert({ conversation_id: conversationId, role: 'user', content: userMessage.trim() })
    .select('*')
    .single();
  if (e1) throw e1;

  // 2) Chama Edge Function pra resposta da IA
  try {
    const { data: aiResp, error: e2 } = await supabase.functions.invoke('ai-pet-assistant', {
      body: { conversationId, petId: pet?.id ?? null },
    });
    if (e2) throw e2;
    if (aiResp?.message) {
      return aiResp.message as AiMessage;
    }
  } catch (err) {
    console.warn('[sendAiMessage] IA indisponível, resposta local:', err);
    // Fallback local: a IA não respondeu (função fora do ar / erro). Devolve um
    // texto útil e honesto — SEM jargão técnico de deploy. Marca a mensagem do
    // user e a resposta como is_fallback=true pra NÃO gastar a cota diária do
    // plano free (a não-resposta não deve empurrar o tutor pro paywall).
    const petName = pet?.name ?? 'seu pet';
    const fallback = `Oi! Recebi sua mensagem 🐾\n\nNão consegui gerar uma resposta automática agora. Pra dúvidas sobre a saúde de ${petName}, o ideal é conversar com um veterinário de confiança.\n\nEnquanto isso, registre tudo aqui no app — sintomas, peso, vacinas e consultas — pra levar um histórico completo na próxima visita. Em emergências, procure atendimento na hora.`;
    // Best-effort: desconta a msg do user da cota (não bloqueia o fluxo se falhar)
    await supabase
      .from('ai_messages')
      .update({ is_fallback: true })
      .eq('id', (userMsg as AiMessage).id)
      .then(undefined, () => undefined);
    const { data: aMsg, error: e3 } = await supabase
      .from('ai_messages')
      .insert({
        conversation_id: conversationId,
        role: 'assistant',
        content: fallback,
        is_fallback: true,
      })
      .select('*')
      .single();
    if (e3) throw e3;
    return aMsg as AiMessage;
  }

  // Fallback impossível mas TS reclama
  return userMsg as AiMessage;
}

// ============================================================================
// Health Timeline — eventos consolidados (vacinas, parasitas, consultas, peso)
// ============================================================================

export type HealthEventKind =
  | 'vaccine'
  | 'parasite'
  | 'vet_visit'
  | 'weight'
  | 'medication_started'
  | 'symptom';

export interface HealthTimelineEvent {
  kind: HealthEventKind;
  date: string; // ISO
  title: string;
  detail: string | null;
  source_id: string;
}

/**
 * Carrega últimos eventos de saúde em paralelo via Promise.allSettled — uma
 * fonte que falha não derruba a timeline.
 *
 * Retorna ordenado desc por data, limitado a `limit` eventos.
 */
export async function fetchHealthTimeline(
  petId: string,
  limit = 20,
): Promise<HealthTimelineEvent[]> {
  const results = await Promise.allSettled([
    supabase
      .from('vaccinations')
      .select('id,name,applied_at,vet_name')
      .eq('pet_id', petId)
      .order('applied_at', { ascending: false })
      .limit(limit),
    supabase
      .from('parasite_treatments')
      .select('id,product_name,applied_at,kind')
      .eq('pet_id', petId)
      .order('applied_at', { ascending: false })
      .limit(limit),
    supabase
      .from('vet_visits')
      .select('id,visited_at,reason,vet_name,clinic_name')
      .eq('pet_id', petId)
      .order('visited_at', { ascending: false })
      .limit(limit),
    supabase
      .from('weight_records')
      .select('id,weight_kg,weighed_at')
      .eq('pet_id', petId)
      .order('weighed_at', { ascending: false })
      .limit(limit),
    supabase
      .from('medications')
      .select('id,name,start_date,dosage')
      .eq('pet_id', petId)
      .order('start_date', { ascending: false })
      .limit(limit),
    supabase
      .from('pet_symptoms')
      .select('id,description,severity,recorded_at,flagged_for_vet')
      .eq('pet_id', petId)
      .order('recorded_at', { ascending: false })
      .limit(limit),
  ]);

  const events: HealthTimelineEvent[] = [];

  // 0: vaccinations
  if (results[0].status === 'fulfilled' && results[0].value.data) {
    for (const v of results[0].value.data as { id: string; name: string; applied_at: string; vet_name: string | null }[]) {
      events.push({
        kind: 'vaccine',
        date: v.applied_at,
        title: `Vacina: ${v.name}`,
        detail: v.vet_name ? `Aplicada por ${v.vet_name}` : null,
        source_id: v.id,
      });
    }
  }

  // 1: parasite_treatments
  if (results[1].status === 'fulfilled' && results[1].value.data) {
    const kindLabels: Record<string, string> = {
      internal: 'Vermífugo',
      external: 'Antipulgas',
      heartworm: 'Anti-heartworm',
      combined: 'Combinado',
    };
    for (const p of results[1].value.data as { id: string; product_name: string; applied_at: string; kind: string }[]) {
      events.push({
        kind: 'parasite',
        date: p.applied_at,
        title: `${kindLabels[p.kind] ?? 'Antiparasitário'}: ${p.product_name}`,
        detail: null,
        source_id: p.id,
      });
    }
  }

  // 2: vet_visits
  if (results[2].status === 'fulfilled' && results[2].value.data) {
    for (const v of results[2].value.data as { id: string; visited_at: string; reason: string; vet_name: string | null; clinic_name: string | null }[]) {
      const place = v.clinic_name ?? v.vet_name ?? null;
      events.push({
        kind: 'vet_visit',
        date: v.visited_at,
        title: `Consulta: ${v.reason}`,
        detail: place,
        source_id: v.id,
      });
    }
  }

  // 3: weight_records
  if (results[3].status === 'fulfilled' && results[3].value.data) {
    for (const w of results[3].value.data as { id: string; weight_kg: number; weighed_at: string }[]) {
      events.push({
        kind: 'weight',
        date: w.weighed_at,
        title: `Pesagem: ${w.weight_kg} kg`,
        detail: null,
        source_id: w.id,
      });
    }
  }

  // 4: medications
  if (results[4].status === 'fulfilled' && results[4].value.data) {
    for (const m of results[4].value.data as { id: string; name: string; start_date: string; dosage: string | null }[]) {
      events.push({
        kind: 'medication_started',
        date: m.start_date,
        title: `Remédio: ${m.name}`,
        detail: m.dosage,
        source_id: m.id,
      });
    }
  }

  // 5: pet_symptoms (registros pro vet) — pra a timeline recente bater com o calendário
  if (results[5].status === 'fulfilled' && results[5].value.data) {
    for (const s of results[5].value.data as {
      id: string; description: string; severity: number; recorded_at: string; flagged_for_vet: boolean;
    }[]) {
      events.push({
        kind: 'symptom',
        date: s.recorded_at,
        title: `Sintoma${s.flagged_for_vet ? ' 🩺' : ''}: ${s.description.slice(0, 60)}${s.description.length > 60 ? '…' : ''}`,
        detail: `Severidade ${s.severity}/5`,
        source_id: s.id,
      });
    }
  }

  // Ordena desc por data e limita
  events.sort((a, b) => (a.date < b.date ? 1 : -1));
  return events.slice(0, limit);
}

/**
 * Carrega TODOS os eventos de saúde dentro de uma janela [startISO, endISO).
 * Limite SUPERIOR é EXCLUSIVO (.lt) — o calendário passa o 1º dia do mês
 * seguinte como `endISO`. As colunas de data são `date`; comparar com limites
 * date-only evita o shift de fuso (UTC-3) que descartava o dia 1 e vazava o
 * dia 1 do mês seguinte. Pega vacinas, parasitas, consultas, peso, remédios e
 * sintomas. Sem limit — assume janela de até ~1 mês.
 */
export async function fetchHealthEventsRange(
  petId: string,
  startISO: string,
  endISO: string,
): Promise<HealthTimelineEvent[]> {
  const results = await Promise.allSettled([
    supabase
      .from('vaccinations')
      .select('id,name,applied_at,vet_name')
      .eq('pet_id', petId)
      .gte('applied_at', startISO)
      .lt('applied_at', endISO),
    supabase
      .from('parasite_treatments')
      .select('id,product_name,applied_at,kind')
      .eq('pet_id', petId)
      .gte('applied_at', startISO)
      .lt('applied_at', endISO),
    supabase
      .from('vet_visits')
      .select('id,visited_at,reason,vet_name,clinic_name')
      .eq('pet_id', petId)
      .gte('visited_at', startISO)
      .lt('visited_at', endISO),
    supabase
      .from('weight_records')
      .select('id,weight_kg,weighed_at')
      .eq('pet_id', petId)
      .gte('weighed_at', startISO)
      .lt('weighed_at', endISO),
    supabase
      .from('medications')
      .select('id,name,start_date,dosage')
      .eq('pet_id', petId)
      .gte('start_date', startISO)
      .lt('start_date', endISO),
    supabase
      .from('pet_symptoms')
      .select('id,description,severity,recorded_at,flagged_for_vet')
      .eq('pet_id', petId)
      .gte('recorded_at', startISO)
      .lt('recorded_at', endISO),
  ]);

  const events: HealthTimelineEvent[] = [];

  if (results[0].status === 'fulfilled' && results[0].value.data) {
    for (const v of results[0].value.data as { id: string; name: string; applied_at: string; vet_name: string | null }[]) {
      events.push({ kind: 'vaccine', date: v.applied_at, title: `Vacina: ${v.name}`, detail: v.vet_name, source_id: v.id });
    }
  }
  if (results[1].status === 'fulfilled' && results[1].value.data) {
    const kindLabel: Record<string, string> = {
      internal: 'Vermífugo',
      external: 'Antipulgas',
      heartworm: 'Anti-heartworm',
      combined: 'Combinado',
    };
    for (const p of results[1].value.data as { id: string; product_name: string; applied_at: string; kind: string }[]) {
      events.push({ kind: 'parasite', date: p.applied_at, title: `Parasitas: ${p.product_name}`, detail: kindLabel[p.kind] ?? null, source_id: p.id });
    }
  }
  if (results[2].status === 'fulfilled' && results[2].value.data) {
    for (const v of results[2].value.data as { id: string; visited_at: string; reason: string; vet_name: string | null; clinic_name: string | null }[]) {
      events.push({
        kind: 'vet_visit',
        date: v.visited_at,
        title: `Consulta: ${v.reason}`,
        detail: v.clinic_name ?? v.vet_name,
        source_id: v.id,
      });
    }
  }
  if (results[3].status === 'fulfilled' && results[3].value.data) {
    for (const w of results[3].value.data as { id: string; weight_kg: number; weighed_at: string }[]) {
      events.push({ kind: 'weight', date: w.weighed_at, title: `Peso: ${w.weight_kg} kg`, detail: null, source_id: w.id });
    }
  }
  if (results[4].status === 'fulfilled' && results[4].value.data) {
    for (const m of results[4].value.data as { id: string; name: string; start_date: string; dosage: string | null }[]) {
      events.push({ kind: 'medication_started', date: m.start_date, title: `Remédio: ${m.name}`, detail: m.dosage, source_id: m.id });
    }
  }
  if (results[5].status === 'fulfilled' && results[5].value.data) {
    for (const s of results[5].value.data as {
      id: string; description: string; severity: number; recorded_at: string; flagged_for_vet: boolean;
    }[]) {
      events.push({
        kind: 'symptom',
        date: s.recorded_at,
        title: `Sintoma${s.flagged_for_vet ? ' 🩺' : ''}: ${s.description.slice(0, 60)}${s.description.length > 60 ? '…' : ''}`,
        detail: `Severidade ${s.severity}/5`,
        source_id: s.id,
      });
    }
  }

  events.sort((a, b) => (a.date < b.date ? 1 : -1));
  return events;
}

// -------- Pet Health Snapshots (histórico do Score de Saúde) --------

export interface PetHealthSnapshot {
  id: string;
  pet_id: string;
  month: string; // 'YYYY-MM'
  score: number;
  components: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export async function fetchHealthSnapshots(
  petId: string,
  limit = 12,
): Promise<PetHealthSnapshot[]> {
  const { data, error } = await supabase
    .from('pet_health_snapshots')
    .select('*')
    .eq('pet_id', petId)
    .order('month', { ascending: false })
    .limit(limit);
  if (error) throw error;
  return (data ?? []) as PetHealthSnapshot[];
}

export async function upsertHealthSnapshot(input: {
  pet_id: string;
  month: string;
  score: number;
  components: Record<string, unknown>;
}): Promise<void> {
  const { error } = await supabase
    .from('pet_health_snapshots')
    .upsert(input, { onConflict: 'pet_id,month' });
  if (error) throw error;
}

// -------- Pet Diet Logs (alimentação) --------

export async function fetchActiveDiet(petId: string): Promise<PetDietLog | null> {
  const { data, error } = await supabase
    .from('pet_diet_logs')
    .select('*')
    .eq('pet_id', petId)
    .eq('active', true)
    .order('started_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return data as PetDietLog | null;
}

export async function fetchDietHistory(petId: string, limit = 20): Promise<PetDietLog[]> {
  const { data, error } = await supabase
    .from('pet_diet_logs')
    .select('*')
    .eq('pet_id', petId)
    .order('started_at', { ascending: false })
    .limit(limit);
  if (error) throw error;
  return (data ?? []) as PetDietLog[];
}

export async function createDietLog(input: {
  pet_id: string;
  food_type: PetDietLog['food_type'];
  brand: string;
  product_name?: string | null;
  daily_amount_g?: number | null;
  daily_servings?: number;
  package_size_g?: number | null;
  package_cost_brl?: number | null;
  notes?: string | null;
  started_at?: string;
}): Promise<PetDietLog> {
  const startedAt = input.started_at ?? new Date().toISOString().slice(0, 10);
  // Arquiva a dieta atual ANTES de criar a nova: senão ficam várias dietas
  // active=true órfãs e o histórico de "Dietas anteriores" some.
  await supabase
    .from('pet_diet_logs')
    .update({ active: false, ended_at: startedAt })
    .eq('pet_id', input.pet_id)
    .eq('active', true);
  const { data, error } = await supabase
    .from('pet_diet_logs')
    .insert({ ...input, started_at: startedAt, active: true })
    .select('*')
    .single();
  if (error) throw error;
  return data as PetDietLog;
}

export async function updateDietLog(
  id: string,
  patch: Partial<Omit<PetDietLog, 'id' | 'pet_id' | 'created_at'>>,
): Promise<void> {
  const { error } = await supabase.from('pet_diet_logs').update(patch).eq('id', id);
  if (error) throw error;
}

export async function deleteDietLog(id: string): Promise<void> {
  const { error } = await supabase.from('pet_diet_logs').delete().eq('id', id);
  if (error) throw error;
}

// ============================================================================
// Free tier limits — posts/dia
// ============================================================================

/**
 * Conta quantos posts o usuário corrente já fez hoje (em todos os seus pets).
 * Reposts NÃO contam. Usado pelo gate do free tier (1 post/dia).
 *
 * Server-side via RPC `count_my_posts_today` — não dá pra burlar no client.
 */
export async function fetchMyPostsTodayCount(): Promise<number> {
  const { data, error } = await supabase.rpc('count_my_posts_today');
  if (error) {
    // RPC ainda não criada → retorna 0 pra não bloquear UX
    return 0;
  }
  return (data as number) ?? 0;
}

/** Limite de posts/dia pro plano gratuito. Hardcode pra consistência com SQL trigger. */
export const FREE_POSTS_PER_DAY = 1;
