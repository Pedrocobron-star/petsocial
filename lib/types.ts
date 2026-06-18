export type Species = 'dog' | 'cat' | 'bird' | 'rabbit' | 'reptile' | 'rodent' | 'fish' | 'other';
export type MediaType = 'image' | 'video';
export type RsvpStatus = 'going' | 'maybe' | 'not_going';
export type SocialTemperament = 'sociable' | 'shy' | 'needs_space' | 'mixed';
export type MeetupCategory = 'walk' | 'social' | 'training' | 'play' | 'birthday' | 'bath' | 'other';

export interface PetMilestone {
  id: string;
  pet_id: string;
  title: string;
  description: string | null;
  happened_at: string;
  emoji: string | null;
  photo_url: string | null;
  created_at: string;
}

export interface Vaccination {
  id: string;
  pet_id: string;
  name: string;
  applied_at: string;
  next_dose_at: string | null;
  vet_name: string | null;
  notes: string | null;
  photo_urls: string[] | null;
  created_at: string;
  updated_at: string;
}

export type ParasiteKind = 'internal' | 'external' | 'heartworm' | 'combined';

export type PetEventKind =
  | 'bath'
  | 'grooming'
  | 'school'
  | 'walk'
  | 'vet_visit'
  | 'feeding'
  | 'training'
  | 'playdate'
  | 'nail_trim'
  | 'ear_cleaning'
  | 'tooth_brushing'
  | 'custom';

/**
 * Regras de recorrência simples (serializadas como string).
 * Examples:
 *   "weekly:monday,wednesday"  → toda segunda e quarta
 *   "monthly"                   → todo mês mesmo dia
 *   "every:30d"                 → a cada 30 dias
 *   "every:14d"                 → a cada 14 dias
 *   null                        → ocorrência única
 */
export type RecurrenceRule = string;

export interface PetEvent {
  id: string;
  pet_id: string;
  kind: PetEventKind;
  title: string;
  description: string | null;
  location: string | null;
  emoji: string | null;
  starts_at: string;
  duration_minutes: number | null;
  all_day: boolean;
  recurrence_rule: RecurrenceRule | null;
  recurrence_end_at: string | null;
  reminder_minutes: number[];
  estimated_cost: number | null;
  color: string | null;
  linked_meetup_id: string | null;
  active: boolean;
  created_at: string;
  updated_at: string;
}

export interface PetEventLog {
  id: string;
  event_id: string;
  pet_id: string;
  occurrence_date: string;
  status: 'done' | 'skipped';
  completed_at: string | null;
  mood: number | null;
  notes: string | null;
  photo_url: string | null;
  actual_cost: number | null;
  created_at: string;
  updated_at: string;
}

/**
 * Item agregado pra agenda: pode vir de pet_events,
 * vaccinations.next_dose_at, parasite_treatments.next_due_at,
 * vet_visits.next_visit_at, ou meetups.
 */
export type AgendaItemSource =
  | 'event'
  | 'vaccination'
  | 'parasite'
  | 'vet_visit'
  | 'meetup';

export type CaretakerRole = 'viewer' | 'caregiver';
export type CaretakerStatus = 'pending' | 'accepted' | 'declined' | 'revoked';

export interface PetCaretaker {
  id: string;
  pet_id: string;
  user_id: string | null;
  invited_email: string | null;
  invite_token: string;
  role: CaretakerRole;
  invited_by: string;
  status: CaretakerStatus;
  accepted_at: string | null;
  nickname: string | null;
  created_at: string;
  updated_at: string;
}

export interface PetCaretakerWithProfile extends PetCaretaker {
  /** Perfil do caretaker quando aceito (null se status=pending) */
  profile: { id: string; display_name: string; avatar_url: string | null } | null;
}

export interface AgendaItem {
  /** Composite ID: `${source}:${refId}:${occurrenceDate}` */
  key: string;
  source: AgendaItemSource;
  /** ID original do registro fonte (pet_event, vaccination, etc) */
  ref_id: string;
  pet_id: string;
  kind: PetEventKind | 'vaccination' | 'parasite' | 'vet_visit' | 'meetup';
  title: string;
  description: string | null;
  emoji: string;
  /** Cor tonal para UI (bg + text). */
  tint: { bg: string; text: string };
  /** Quando acontece (ISO). */
  occurs_at: string;
  all_day: boolean;
  /** Se vem de pet_events e tem log de conclusão */
  log: PetEventLog | null;
  /** Editável (false para itens read-only oriundos de vacinas/parasitas/vet/meetups) */
  editable: boolean;
}

export interface ParasiteTreatment {
  id: string;
  pet_id: string;
  kind: ParasiteKind;
  product_name: string;
  /** Slug do catálogo frontend (lib/parasite-products.ts), opcional. */
  product_slug: string | null;
  applied_at: string;
  next_due_at: string | null;
  /** Intervalo em dias usado pra calcular next_due_at — preservado pra histórico. */
  interval_days: number | null;
  vet_name: string | null;
  dose: string | null;
  weight_kg_at_treatment: number | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export type LostReportKind = 'lost' | 'found';
export type LostReportStatus = 'open' | 'resolved';

export interface LostReport {
  id: string;
  pet_id: string | null;
  reporter_user_id: string;
  kind: LostReportKind;
  status: LostReportStatus;
  pet_name: string | null;
  species: Species | null;
  breed: string | null;
  color: string | null;
  last_seen_location: string;
  latitude: number | null;
  longitude: number | null;
  last_seen_at: string | null;
  description: string | null;
  contact_info: string;
  photo_url: string | null;
  image_urls?: string[] | null;
  video_url?: string | null;
  created_at: string;
  updated_at: string;
}

export interface LostReportWithPet extends LostReport {
  pet: Pet | null;
}

export interface Profile {
  id: string;
  display_name: string;
  avatar_url: string | null;
  bio: string | null;
  created_at: string;
  updated_at: string;
}

export interface Pet {
  id: string;
  owner_id: string;
  name: string;
  species: Species;
  breed: string | null;
  birthdate: string | null;
  bio: string | null;
  avatar_url: string | null;
  social_temperament: SocialTemperament | null;
  memorial_at: string | null;
  memorial_note: string | null;
  personality_type: PersonalityType | null;
  personality_taken_at: string | null;
  // Campos do Pet ID Card (todos opcionais, declarados pelo tutor)
  microchip_number?: string | null;
  rga_number?: string | null;
  blood_type?: string | null;
  allergies?: string | null;
  known_conditions?: string | null;
  emergency_contact_name?: string | null;
  emergency_contact_phone?: string | null;
  preferred_vet_name?: string | null;
  preferred_vet_phone?: string | null;
  /** Número de registro no SinPatinhas (RG federal do MMA). Voluntário. */
  sinpatinhas_id?: string | null;
  id_card_token?: string | null;
  created_at: string;
  updated_at: string;
}

/**
 * Campos sensíveis da carteirinha (PII médica) — vivem na tabela-filha
 * `pet_private` com RLS dono-only, NÃO em `pets`. Qualquer logado lia tudo de
 * pets antes; agora visitante não acessa. Carteirinha pública usa o RPC definer
 * `public_pet_card`. Ver supabase/pet-private-pii.sql.
 */
export interface PetPrivate {
  pet_id: string;
  microchip_number: string | null;
  rga_number: string | null;
  blood_type: string | null;
  allergies: string | null;
  known_conditions: string | null;
  emergency_contact_name: string | null;
  emergency_contact_phone: string | null;
  preferred_vet_name: string | null;
  preferred_vet_phone: string | null;
  sinpatinhas_id: string | null;
  id_card_token: string;
  created_at: string;
  updated_at: string;
}

/** Subconjunto editável do pet_private (sem pet_id/token/timestamps). */
export type PetPrivatePatch = Partial<
  Pick<
    PetPrivate,
    | 'microchip_number'
    | 'rga_number'
    | 'blood_type'
    | 'allergies'
    | 'known_conditions'
    | 'emergency_contact_name'
    | 'emergency_contact_phone'
    | 'preferred_vet_name'
    | 'preferred_vet_phone'
    | 'sinpatinhas_id'
  >
>;

// ============================================================================
// HUMAN AVATAR — avatar simplificado do tutor (pessoa, não pet)
// ============================================================================

export type HumanSkinTone =
  | '#FCD9B6'
  | '#E9B587'
  | '#C18454'
  | '#92561F'
  | '#5C3317'
  | '#FFE0BD'; // pasty

export type HumanHairStyle =
  | 'short'      // curto/buzz
  | 'medium'    // médio liso
  | 'long'       // longo/cabelo escorrido
  | 'curly'      // cacheado
  | 'bald'       // careca
  | 'bun'        // coque
  | 'ponytail';  // rabo

export type HumanHairColor =
  | '#1A1410' // preto
  | '#5C3317' // castanho escuro
  | '#92561F' // castanho médio
  | '#C18454' // castanho claro
  | '#FBBF24' // loiro
  | '#EF4444' // ruivo
  | '#A8A29E'; // grisalho

export type HumanAccessory = 'none' | 'glasses' | 'sunglasses' | 'cap' | 'earring';

export interface HumanAvatarConfig {
  skin_tone: HumanSkinTone | string;
  hair_style: HumanHairStyle;
  hair_color: HumanHairColor | string;
  eye_color: string;
  shirt_color: string;
  accessory: HumanAccessory;
  background_color: string;
}

export interface Post {
  id: string;
  pet_id: string;
  caption: string | null;
  created_at: string;
  /** Timestamp da última edição. Null se nunca foi editado. */
  updated_at: string | null;
  /** Se é um repost, ID do post original. Null se é post original. */
  reposted_from: string | null;
}

export interface PostMedia {
  id: string;
  post_id: string;
  url: string;
  media_type: MediaType;
  position: number;
  created_at: string;
}

export interface Meetup {
  id: string;
  host_pet_id: string;
  title: string;
  description: string | null;
  location_name: string;
  /** Lugar pet-friendly vinculado (guia de Lugares). Null = local livre. */
  place_id: string | null;
  latitude: number | null;
  longitude: number | null;
  starts_at: string;
  category: MeetupCategory;
  created_at: string;
}

export interface MeetupRsvp {
  meetup_id: string;
  pet_id: string;
  status: RsvpStatus;
  created_at: string;
}

export interface Comment {
  id: string;
  post_id: string;
  pet_id: string;
  content: string;
  created_at: string;
  /** Timestamp da última edição. Null se nunca editado. */
  updated_at: string | null;
  /** Se for reply, ID do comentário pai. Null se for comentário raiz. */
  parent_id: string | null;
}

/** Comment hidratado com pet, likes count, replies count e liked_by_me */
export interface CommentWithDetails extends Comment {
  pet: Pet;
  likes_count: number;
  replies_count: number;
  liked_by_me: boolean;
}

/** Entrada do histórico de edições (Pro feature) */
export interface PostEditHistory {
  id: string;
  post_id: string;
  previous_caption: string | null;
  edited_at: string;
}

export type NotificationKind = 'like' | 'comment' | 'follow' | 'mention' | 'pet_tagged' | 'broadcast';

export interface Notification {
  id: string;
  user_id: string;
  kind: NotificationKind;
  actor_pet_id: string | null;
  target_pet_id: string | null;
  post_id: string | null;
  comment_id: string | null;
  read: boolean;
  created_at: string;
  /** Broadcast (admin): título/corpo/link da mensagem. */
  title?: string | null;
  body?: string | null;
  url?: string | null;
}

export interface NotificationWithDetails extends Notification {
  actor: Pet | null;
  target_pet: Pet | null;
}

export interface PostWithDetails extends Post {
  pet: Pet;
  media: PostMedia[];
  likes_count: number;
  comments_count: number;
  liked_by_me: boolean;
  /** Pets mencionados (tags) no post */
  pet_tags?: Pet[];
  /**
   * Dono do pet é Pet Pro? Renderiza selo dourado ao lado do nome.
   * Hidratado via lookup em profiles.is_pro.
   */
  owner_is_pro?: boolean;
  /** Quando é repost, os dados do post original ficam aqui */
  original_post?: {
    id: string;
    pet: Pet;
    caption: string | null;
    media: PostMedia[];
  } | null;
}

export interface MeetupWithDetails extends Meetup {
  host_pet: Pet;
  rsvps_count: number;
  my_rsvp_status: RsvpStatus | null;
}

// ====================
// Chat / DM
// ====================

export interface Conversation {
  id: string;
  created_at: string;
  last_message_at: string;
}

export interface ConversationParticipant {
  conversation_id: string;
  user_id: string;
  last_read_at: string;
  created_at: string;
}

export interface Message {
  id: string;
  conversation_id: string;
  sender_id: string;
  content: string;
  created_at: string;
}

export interface ConversationSummary {
  id: string;
  last_message_at: string;
  last_message: Message | null;
  other_user: Profile;
  unread_count: number;
}

// ====================
// Pet Health
// ====================

export type MedicationFrequency = 'daily' | 'twice_daily' | 'weekly' | 'monthly' | 'as_needed';

export interface Medication {
  id: string;
  pet_id: string;
  name: string;
  dosage: string | null;
  frequency: MedicationFrequency;
  time_of_day: string | null;
  start_date: string;
  end_date: string | null;
  notes: string | null;
  active: boolean;
  created_at: string;
  updated_at: string;
}

export interface MedicationLog {
  id: string;
  medication_id: string;
  administered_at: string;
  notes: string | null;
  created_at: string;
}

export interface MedicationWithLogs extends Medication {
  last_log: MedicationLog | null;
  doses_today: number;
}

export interface VetVisit {
  id: string;
  pet_id: string;
  visited_at: string;
  vet_name: string | null;
  clinic_name: string | null;
  reason: string;
  diagnosis: string | null;
  treatment: string | null;
  weight_kg: number | null;
  next_visit_at: string | null;
  notes: string | null;
  photo_urls: string[] | null;
  created_at: string;
  updated_at: string;
}

export interface WeightRecord {
  id: string;
  pet_id: string;
  weighed_at: string;
  weight_kg: number;
  notes: string | null;
  created_at: string;
}

export type DietFoodType =
  | 'dry_food'
  | 'wet_food'
  | 'natural'
  | 'mixed'
  | 'puppy'
  | 'senior'
  | 'special';

/**
 * Registro da alimentação do pet — ração atual + histórico de mudanças.
 *
 * Apenas UM log por pet pode ter active=true. Inserir novo log ativo
 * automaticamente desativa o anterior (via trigger no DB).
 *
 * Custo mensal é calculado client-side:
 *   monthlyCost = (daily_amount_g * 30 / package_size_g) * package_cost_brl
 */
export interface PetDietLog {
  id: string;
  pet_id: string;
  food_type: DietFoodType;
  brand: string;
  product_name: string | null;
  daily_amount_g: number | null;
  daily_servings: number;
  package_size_g: number | null;
  package_cost_brl: number | null;
  notes: string | null;
  active: boolean;
  started_at: string; // YYYY-MM-DD
  ended_at: string | null;
  created_at: string;
  updated_at: string;
}

/**
 * Sintoma registrado pelo tutor pra mostrar pro veterinário.
 *
 * IMPORTANTE: o Maestro Pet NUNCA dá diagnóstico ou recomendação médica.
 * pet_symptoms são REGISTROS — o veterinário decide o que significam.
 * Severidade é a percepção do tutor, não classificação clínica.
 */
export interface PetSymptom {
  id: string;
  pet_id: string;
  /** Quando o sintoma foi observado (ISO). */
  recorded_at: string;
  /** Descrição livre do que aconteceu. */
  description: string;
  /** Severidade percebida pelo tutor: 1=leve, 5=grave. */
  severity: number;
  /** Parte do corpo afetada (opcional). */
  body_part: string | null;
  /** Fotos do sintoma (opcional). */
  photo_urls: string[] | null;
  /** Notas adicionais. */
  notes: string | null;
  /** Marcado pra levar ao vet. */
  flagged_for_vet: boolean;
  /** Quando o sintoma foi resolvido (null = ainda ativo). */
  resolved_at: string | null;
  created_at: string;
}

export interface HealthSummary {
  next_vaccine: { name: string; due_at: string; days_until: number } | null;
  /** Total de vacinas já registradas (pro score reconhecer o registro). */
  vaccinations_count: number;
  active_medications_count: number;
  due_medications_today: number;
  last_vet_visit: VetVisit | null;
  next_vet_visit: VetVisit | null;
  latest_weight: WeightRecord | null;
}

// ====================
// Privacy & Moderation
// ====================

export type ReportTargetKind =
  | 'post'
  | 'comment'
  | 'user'
  | 'pet'
  | 'message'
  | 'lost_report'
  | 'adoption_listing';
export type ReportReason =
  | 'spam'
  | 'harassment'
  | 'inappropriate'
  | 'animal_abuse'
  | 'impersonation'
  | 'misinformation'
  | 'other';

export interface BlockedUser {
  blocker_id: string;
  blocked_id: string;
  created_at: string;
}

export interface Report {
  id: string;
  reporter_user_id: string;
  target_kind: ReportTargetKind;
  target_id: string;
  reason: ReportReason;
  notes: string | null;
  status: 'open' | 'reviewed' | 'dismissed' | 'actioned';
  created_at: string;
}

// ====================
// Places (Pet Shops & Vets)
// ====================

/**
 * Subconjunto SEGURO de campos do pet exposto publicamente na carteirinha
 * (rota /id/[token]) via RPC `public_pet_card`. NÃO inclui owner_id nem campos
 * internos — só o que o tutor escolheu colocar no cartão.
 */
export interface PublicPetCard {
  id: string;
  name: string;
  species: Species;
  breed?: string | null;
  birthdate?: string | null;
  avatar_url?: string | null;
  microchip_number?: string | null;
  rga_number?: string | null;
  sinpatinhas_id?: string | null;
  blood_type?: string | null;
  allergies?: string | null;
  known_conditions?: string | null;
  emergency_contact_name?: string | null;
  emergency_contact_phone?: string | null;
  preferred_vet_name?: string | null;
  preferred_vet_phone?: string | null;
  id_card_token?: string | null;
}

export interface PublicPetCardResult {
  pet: PublicPetCard;
  tutor: { display_name: string | null; avatar_url: string | null };
  /** Selo de endosso assinado mais recente (só nome + CRMV + data). */
  endorsement?: {
    vet_name: string | null;
    crmv_number: string | null;
    crmv_state: string | null;
    signed_at: string | null;
  } | null;
}

export type PlaceKind =
  | 'vet'
  | 'pet_shop'
  | 'hotel'
  | 'daycare'
  | 'park'
  | 'grooming'
  | 'training'
  | 'restaurant'
  | 'cafe'
  | 'event'
  | 'beach'
  | 'other';

export type PlaceSpecies = 'all' | 'dog' | 'cat' | 'other';

export interface Place {
  id: string;
  name: string;
  kind: PlaceKind;
  /** Espécie que o lugar atende. 'all' = pra todos. (default 'all' no banco) */
  species?: PlaceSpecies;
  description: string | null;
  address: string;
  city: string | null;
  state: string | null;
  latitude: number | null;
  longitude: number | null;
  phone: string | null;
  website: string | null;
  hours: string | null;
  photo_url: string | null;
  added_by_user_id: string | null;
  verified: boolean;
  created_at: string;
  updated_at: string;
}

export interface PlaceWithStats extends Place {
  avg_rating: number;
  review_count: number;
}

export interface PlacePhoto {
  id: string;
  place_id: string;
  user_id: string;
  url: string;
  storage_path: string;
  caption: string | null;
  created_at: string;
}

export interface PlaceReview {
  id: string;
  place_id: string;
  user_id: string;
  rating: number;
  comment: string | null;
  photo_urls: string[];
  rating_service: number | null;
  rating_price: number | null;
  rating_cleanliness: number | null;
  rating_petfriendly: number | null;
  created_at: string;
  updated_at: string;
}

export interface PlaceReviewWithProfile extends PlaceReview {
  profile: Profile;
}

// ====================
// Subscriptions / Pet Pro
// ====================

export type SubscriptionStatus =
  | 'free'
  | 'active'
  | 'trialing'
  | 'past_due'
  | 'canceled'
  | 'incomplete';

export type SubscriptionPlan = 'monthly' | 'yearly' | 'founder';

export interface Subscription {
  id: string;
  user_id: string;
  status: SubscriptionStatus;
  plan: SubscriptionPlan | null;
  stripe_customer_id: string | null;
  stripe_subscription_id: string | null;
  mp_customer_id: string | null;
  mp_subscription_id: string | null;
  current_period_start: string | null;
  current_period_end: string | null;
  cancel_at_period_end: boolean;
  trial_ends_at: string | null;
  created_at: string;
  updated_at: string;
}

export const FREE_TIER_LIMITS = {
  maxPets: 1,
  maxPostsPerDay: 1,
  diaryHistoryDays: 30,
  pdfHasWatermark: true,
  maxVideoLengthSeconds: 30,
  maxPhotoBackupMb: 100,
} as const;

/** Tetos do Pet Pro (pago). Pets limitados a 6 (não mais "ilimitado"). */
export const PRO_TIER_LIMITS = {
  maxPets: 6,
} as const;

export const PRICING = {
  monthlyBRL: 14.9,
  yearlyBRL: 99.9,
  yearlyMonthlyEquivalent: 99.9 / 12, // ~R$ 8,32/mês
  yearlyDiscountPercent: Math.round((1 - 99.9 / 12 / 14.9) * 100), // ~44%
} as const;

// ====================
// Mega 17: Memorial / Personality / AI
// ====================

export interface MemorialMessage {
  id: string;
  pet_id: string;
  author_user_id: string;
  message: string;
  created_at: string;
}

export interface MemorialMessageWithProfile extends MemorialMessage {
  profile: Profile;
}

export type PersonalityType =
  | 'adventurer'
  | 'cuddler'
  | 'playful'
  | 'shy'
  | 'independent'
  | 'royal';

export interface PersonalityInfo {
  type: PersonalityType;
  emoji: string;
  title: string;
  description: string;
  color: string;
  bgColor: string;
}

export const PERSONALITIES: Record<PersonalityType, PersonalityInfo> = {
  adventurer: {
    type: 'adventurer',
    emoji: '🌄',
    title: 'Aventureiro',
    description: 'Curioso, sempre pronto pra explorar. Vai pra todo lugar com você.',
    color: '#9A3412',
    bgColor: '#FED7AA',
  },
  cuddler: {
    type: 'cuddler',
    emoji: '🤗',
    title: 'Mimoso',
    description: 'Vive pra fazer carinho. Cobertor + colo é o paraíso.',
    color: '#9D174D',
    bgColor: '#FCE7F3',
  },
  playful: {
    type: 'playful',
    emoji: '🎾',
    title: 'Brincalhão',
    description: 'Energia infinita! Brinquedo, bola, corrida — adora tudo.',
    color: '#9333EA',
    bgColor: '#F3E8FF',
  },
  shy: {
    type: 'shy',
    emoji: '🌸',
    title: 'Tímido',
    description: 'Observa antes de agir. Discreto, calmo e cheio de personalidade.',
    color: '#1E40AF',
    bgColor: '#DBEAFE',
  },
  independent: {
    type: 'independent',
    emoji: '🦅',
    title: 'Independente',
    description: 'Faz seu próprio horário. Adora ter espaço pra ser livre.',
    color: '#166534',
    bgColor: '#DCFCE7',
  },
  royal: {
    type: 'royal',
    emoji: '👑',
    title: 'Realeza',
    description: 'Sabe que é o centro do universo. Exige o melhor — e merece.',
    color: '#92400E',
    bgColor: '#FEF3C7',
  },
};

export interface AiConversation {
  id: string;
  user_id: string;
  pet_id: string | null;
  title: string | null;
  created_at: string;
  updated_at: string;
}

export interface AiMessage {
  id: string;
  conversation_id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  tokens_used: number | null;
  /** true quando é resposta automática local (IA fora do ar). Não conta na cota. */
  is_fallback?: boolean;
  created_at: string;
}

type Partialize<T, K extends keyof T> = Omit<T, K> & Partial<Pick<T, K>>;

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: Profile;
        Insert: Partialize<Profile, 'created_at' | 'updated_at' | 'avatar_url' | 'bio'>;
        Update: Partial<Omit<Profile, 'id' | 'created_at'>>;
        Relationships: [];
      };
      pets: {
        Row: Pet;
        Insert: Partialize<
          Pet,
          'id' | 'created_at' | 'updated_at' | 'breed' | 'birthdate' | 'bio' | 'avatar_url'
        >;
        Update: Partial<Omit<Pet, 'id' | 'owner_id' | 'created_at'>>;
        Relationships: [];
      };
      posts: {
        Row: Post;
        Insert: Partialize<Post, 'id' | 'created_at' | 'caption'>;
        Update: Partial<Omit<Post, 'id' | 'pet_id' | 'created_at'>>;
        Relationships: [];
      };
      post_media: {
        Row: PostMedia;
        Insert: Partialize<PostMedia, 'id' | 'created_at' | 'position'>;
        Update: Partial<Omit<PostMedia, 'id' | 'created_at'>>;
        Relationships: [];
      };
      follows: {
        Row: { follower_pet_id: string; followed_pet_id: string; created_at: string };
        Insert: { follower_pet_id: string; followed_pet_id: string; created_at?: string };
        Update: Partial<{ follower_pet_id: string; followed_pet_id: string }>;
        Relationships: [];
      };
      likes: {
        Row: { post_id: string; pet_id: string; created_at: string };
        Insert: { post_id: string; pet_id: string; created_at?: string };
        Update: Partial<{ post_id: string; pet_id: string }>;
        Relationships: [];
      };
      comments: {
        Row: Comment;
        Insert: Partialize<Comment, 'id' | 'created_at'>;
        Update: Partial<Pick<Comment, 'content'>>;
        Relationships: [];
      };
      meetups: {
        Row: Meetup;
        Insert: Partialize<Meetup, 'id' | 'created_at' | 'description' | 'latitude' | 'longitude'>;
        Update: Partial<Omit<Meetup, 'id' | 'host_pet_id' | 'created_at'>>;
        Relationships: [];
      };
      meetup_rsvps: {
        Row: MeetupRsvp;
        Insert: Partialize<MeetupRsvp, 'created_at' | 'status'>;
        Update: Partial<Pick<MeetupRsvp, 'status'>>;
        Relationships: [];
      };
    };
    Views: {
      pet_stats: {
        Row: { pet_id: string; posts_count: number; followers_count: number; following_count: number };
        Relationships: [];
      };
      post_stats: {
        Row: { post_id: string; likes_count: number; comments_count: number };
        Relationships: [];
      };
    };
    Functions: Record<string, never>;
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
}
