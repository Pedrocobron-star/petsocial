import { logAdminAction } from './admin-audit';
import { supabase } from './supabase';

/**
 * Camada de dados do Portal de Notícias (Jornal Pet).
 * Leitura pública das matérias publicadas; escrita (admin) via RLS is_admin().
 */

export type AffiliateStore = 'shopee' | 'mercadolivre' | 'amazon' | 'outro';

export interface AffiliateProduct {
  label: string;
  url: string;
  store: AffiliateStore;
  price?: string;
  image_url?: string;
}

export interface NewsCategory {
  id: string;
  slug: string;
  name: string;
  emoji: string;
  color: string;
  sort_order: number;
}

/** Tag fixa por tema/animal (N:N com matérias via news_article_tags). */
export interface NewsTag {
  id: string;
  slug: string;
  name: string;
  sort_order: number;
}

export type NewsStatus = 'draft' | 'published' | 'scheduled';

export interface NewsArticle {
  id: string;
  slug: string;
  category_id: string | null;
  title: string;
  dek: string | null;
  cover_url: string | null;
  cover_caption: string | null;
  body: string;
  author_name: string;
  status: NewsStatus;
  is_featured: boolean;
  affiliate_products: AffiliateProduct[];
  view_count: number;
  published_at: string | null;
  scheduled_at: string | null;
  notify_on_publish: boolean;
  created_at: string;
  updated_at: string;
  category?: NewsCategory | null;
  /** Tags fixas vinculadas (populado no detalhe via fetchArticleBySlug). */
  tags?: NewsTag[];
}

export interface NewsArticleInput {
  slug: string;
  category_id: string | null;
  title: string;
  dek: string | null;
  cover_url: string | null;
  cover_caption: string | null;
  body: string;
  author_name?: string;
  status: NewsStatus;
  is_featured: boolean;
  affiliate_products: AffiliateProduct[];
  /** ISO — quando status='scheduled'. */
  scheduled_at?: string | null;
  /** dispara push pra base toda quando a matéria for publicada. */
  notify_on_publish?: boolean;
}

const ARTICLE_SELECT = '*, category:news_categories(*)';

/** Slug a partir do título (sem acento, kebab-case). */
export function slugify(input: string): string {
  return (
    input
      .toLowerCase()
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 70) || 'materia'
  );
}

// ---------- leitura pública ----------

export async function fetchCategories(): Promise<NewsCategory[]> {
  const { data, error } = await supabase
    .from('news_categories')
    .select('*')
    .order('sort_order', { ascending: true });
  if (error) throw error;
  return (data as NewsCategory[] | null) ?? [];
}

export async function fetchArticles(opts?: {
  categoryId?: string;
  featured?: boolean;
  limit?: number;
}): Promise<NewsArticle[]> {
  let q = supabase
    .from('news_articles')
    .select(ARTICLE_SELECT)
    .eq('status', 'published')
    .order('published_at', { ascending: false })
    .limit(opts?.limit ?? 20);
  if (opts?.categoryId) q = q.eq('category_id', opts.categoryId);
  if (opts?.featured) q = q.eq('is_featured', true);
  const { data, error } = await q;
  if (error) throw error;
  return (data as NewsArticle[] | null) ?? [];
}

/**
 * Busca matérias publicadas por título/linha-fina (ilike). Sanitiza o termo
 * (tira vírgula/parênteses/curingas) pra não quebrar o filtro `.or()` do
 * PostgREST nem injetar wildcards.
 */
export async function searchArticles(query: string, limit = 30): Promise<NewsArticle[]> {
  const clean = query.trim().replace(/[,()%_*]/g, ' ').trim();
  if (clean.length < 2) return [];
  const pattern = `%${clean}%`;
  const { data, error } = await supabase
    .from('news_articles')
    .select(ARTICLE_SELECT)
    .eq('status', 'published')
    .or(`title.ilike.${pattern},dek.ilike.${pattern}`)
    .order('published_at', { ascending: false })
    .limit(limit);
  if (error) throw error;
  return (data as NewsArticle[] | null) ?? [];
}

export async function fetchArticleBySlug(slug: string): Promise<NewsArticle | null> {
  const { data, error } = await supabase
    .from('news_articles')
    .select(ARTICLE_SELECT)
    .eq('slug', slug)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  const article = data as NewsArticle;
  article.tags = await fetchArticleTags(article.id);
  return article;
}

// ---------- tags ----------

export async function fetchTags(): Promise<NewsTag[]> {
  const { data, error } = await supabase
    .from('news_tags')
    .select('*')
    .order('sort_order', { ascending: true });
  if (error) throw error;
  return (data as NewsTag[] | null) ?? [];
}

export async function fetchTagBySlug(slug: string): Promise<NewsTag | null> {
  const { data, error } = await supabase
    .from('news_tags')
    .select('*')
    .eq('slug', slug)
    .maybeSingle();
  if (error) throw error;
  return (data as NewsTag | null) ?? null;
}

/** Tags de UMA matéria (ordenadas), via a junção. */
async function fetchArticleTags(articleId: string): Promise<NewsTag[]> {
  const { data, error } = await supabase
    .from('news_article_tags')
    .select('tag:news_tags(*)')
    .eq('article_id', articleId);
  if (error) throw error;
  // o supabase-js tipa o embed como array; em runtime é objeto (FK to-one).
  const rows = (data ?? []) as unknown as { tag: NewsTag | NewsTag[] | null }[];
  const tags = rows
    .map((r) => (Array.isArray(r.tag) ? r.tag[0] : r.tag))
    .filter((t): t is NewsTag => !!t);
  return tags.sort((a, b) => a.sort_order - b.sort_order);
}

/** Matérias publicadas com uma tag (inner join na junção). */
export async function fetchArticlesByTag(tagId: string, limit = 30): Promise<NewsArticle[]> {
  const { data, error } = await supabase
    .from('news_articles')
    .select(`${ARTICLE_SELECT}, news_article_tags!inner(tag_id)`)
    .eq('status', 'published')
    .eq('news_article_tags.tag_id', tagId)
    .order('published_at', { ascending: false })
    .limit(limit);
  if (error) throw error;
  return (data as NewsArticle[] | null) ?? [];
}

export async function incrementArticleView(id: string): Promise<void> {
  await supabase.rpc('news_increment_view', { p_id: id }).then(undefined, () => {});
}

/**
 * As matérias mais lidas sobre o ACERVO INTEIRO (por view_count), não só sobre
 * as 30 mais recentes — senão um evergreen antigo nunca entra em "Mais lidas".
 */
export async function fetchMostReadArticles(limit = 5): Promise<NewsArticle[]> {
  const { data, error } = await supabase
    .from('news_articles')
    .select(ARTICLE_SELECT)
    .eq('status', 'published')
    .gt('view_count', 0)
    .order('view_count', { ascending: false })
    .limit(limit);
  if (error) throw error;
  return (data as NewsArticle[] | null) ?? [];
}

/**
 * Matérias relacionadas pro fim do artigo: prioriza a MESMA categoria (mais
 * recentes), e completa com as últimas publicadas se faltar — pra nunca ficar
 * vazio quando a categoria tem só esse texto. Mantém o leitor no portal.
 */
export async function fetchRelatedArticles(opts: {
  excludeId: string;
  categoryId?: string | null;
  limit?: number;
}): Promise<NewsArticle[]> {
  const limit = opts.limit ?? 4;
  const base = () =>
    supabase
      .from('news_articles')
      .select(ARTICLE_SELECT)
      .eq('status', 'published')
      .neq('id', opts.excludeId)
      .order('published_at', { ascending: false });

  const out: NewsArticle[] = [];
  const seen = new Set<string>([opts.excludeId]);
  const push = (rows: NewsArticle[] | null) => {
    for (const a of rows ?? []) {
      if (out.length >= limit) break;
      if (!seen.has(a.id)) {
        seen.add(a.id);
        out.push(a);
      }
    }
  };

  if (opts.categoryId) {
    const { data } = await base().eq('category_id', opts.categoryId).limit(limit);
    push(data as NewsArticle[] | null);
  }
  if (out.length < limit) {
    const { data } = await base().limit(limit + 1);
    push(data as NewsArticle[] | null);
  }
  return out.slice(0, limit);
}

/**
 * "Veja também" por TAG: matérias que compartilham TAGS com a atual, ordenadas
 * por nº de tags em comum (mais relacionadas primeiro) e depois por recência.
 * Diferente de fetchRelatedArticles (que é por categoria).
 */
export async function fetchRelatedByTag(opts: {
  excludeId: string;
  tagIds: string[];
  limit?: number;
}): Promise<NewsArticle[]> {
  const limit = opts.limit ?? 4;
  if (!opts.tagIds.length) return [];

  const { data: links } = await supabase
    .from('news_article_tags')
    .select('article_id')
    .in('tag_id', opts.tagIds)
    .neq('article_id', opts.excludeId);

  // conta tags em comum por matéria (mais tags em comum = mais relacionada)
  const shared = new Map<string, number>();
  for (const r of (links ?? []) as { article_id: string }[]) {
    if (r.article_id === opts.excludeId) continue;
    shared.set(r.article_id, (shared.get(r.article_id) ?? 0) + 1);
  }
  const ids = [...shared.keys()];
  if (!ids.length) return [];

  const { data } = await supabase
    .from('news_articles')
    .select(ARTICLE_SELECT)
    .eq('status', 'published')
    .in('id', ids.slice(0, limit * 4))
    .order('published_at', { ascending: false });

  const rows = (data as NewsArticle[] | null) ?? [];
  rows.sort((a, b) => {
    const sa = shared.get(a.id) ?? 0;
    const sb = shared.get(b.id) ?? 0;
    if (sb !== sa) return sb - sa;
    return (b.published_at ?? '').localeCompare(a.published_at ?? '');
  });
  return rows.slice(0, limit);
}

// ---------- selo "Novo" (item 5) ----------

/** Janela do selo "Novo": matérias publicadas nas últimas 48h. */
export const NEW_ARTICLE_WINDOW_MS = 48 * 60 * 60 * 1000;

export function isRecentArticle(publishedAt: string | null | undefined): boolean {
  if (!publishedAt) return false;
  const t = new Date(publishedAt).getTime();
  if (Number.isNaN(t)) return false;
  return Date.now() - t < NEW_ARTICLE_WINDOW_MS;
}

// ---------- salvar / ler depois (item 3) ----------

/** Lista as matérias que o usuário salvou (mais recentes primeiro). RLS dono-only. */
export async function fetchSavedArticles(limit = 50): Promise<NewsArticle[]> {
  const { data, error } = await supabase
    .from('saved_articles')
    .select(`created_at, article:news_articles(${ARTICLE_SELECT})`)
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) throw error;
  const rows = (data ?? []) as unknown as { article: NewsArticle | NewsArticle[] | null }[];
  return rows
    .map((r) => (Array.isArray(r.article) ? r.article[0] : r.article))
    .filter((a): a is NewsArticle => !!a);
}

/** A matéria está salva? (RLS já restringe ao próprio usuário.) */
export async function isArticleSaved(articleId: string): Promise<boolean> {
  const { data, error } = await supabase
    .from('saved_articles')
    .select('article_id')
    .eq('article_id', articleId)
    .maybeSingle();
  if (error) throw error;
  return !!data;
}

/** Salva (true) ou remove (false) o bookmark da matéria. */
export async function toggleSaveArticle(articleId: string, save: boolean): Promise<void> {
  if (save) {
    const { data: u } = await supabase.auth.getUser();
    const uid = u.user?.id;
    if (!uid) throw new Error('Faça login pra salvar matérias.');
    const { error } = await supabase.from('saved_articles').insert({ user_id: uid, article_id: articleId });
    if (error && error.code !== '23505') throw error; // 23505 = já salvo, ignora
  } else {
    const { error } = await supabase.from('saved_articles').delete().eq('article_id', articleId);
    if (error) throw error;
  }
}

// ---------- seguir editoria (item 4) ----------

/** IDs das editorias que o usuário segue. RLS dono-only. */
export async function fetchFollowedCategoryIds(): Promise<string[]> {
  const { data, error } = await supabase.from('category_follows').select('category_id');
  if (error) throw error;
  return ((data ?? []) as { category_id: string }[]).map((r) => r.category_id);
}

/** Segue (true) ou deixa de seguir (false) uma editoria. */
export async function setCategoryFollow(categoryId: string, follow: boolean): Promise<void> {
  if (follow) {
    const { data: u } = await supabase.auth.getUser();
    const uid = u.user?.id;
    if (!uid) throw new Error('Faça login pra seguir editorias.');
    const { error } = await supabase.from('category_follows').insert({ user_id: uid, category_id: categoryId });
    if (error && error.code !== '23505') throw error;
  } else {
    const { error } = await supabase.from('category_follows').delete().eq('category_id', categoryId);
    if (error) throw error;
  }
}

// ---------- admin (CMS) ----------

/** Teto generoso pra um CMS curado à mão. Se um dia passar disso, paginar. */
export const ADMIN_ARTICLES_LIMIT = 500;
export async function fetchAllArticlesAdmin(): Promise<NewsArticle[]> {
  const { data, error } = await supabase
    .from('news_articles')
    .select(ARTICLE_SELECT)
    .order('updated_at', { ascending: false })
    .limit(ADMIN_ARTICLES_LIMIT);
  if (error) throw error;
  return (data as NewsArticle[] | null) ?? [];
}

export async function fetchArticleByIdAdmin(id: string): Promise<NewsArticle | null> {
  const { data, error } = await supabase
    .from('news_articles')
    .select(ARTICLE_SELECT)
    .eq('id', id)
    .maybeSingle();
  if (error) throw error;
  return (data as NewsArticle | null) ?? null;
}

function toRow(input: NewsArticleInput) {
  return {
    slug: input.slug,
    category_id: input.category_id,
    title: input.title,
    dek: input.dek,
    cover_url: input.cover_url,
    cover_caption: input.cover_caption,
    body: input.body,
    author_name: input.author_name?.trim() || 'Redação Maestro Pet',
    status: input.status,
    is_featured: input.is_featured,
    affiliate_products: input.affiliate_products,
    notify_on_publish: !!input.notify_on_publish,
    scheduled_at: input.status === 'scheduled' ? (input.scheduled_at ?? null) : null,
    published_at: input.status === 'published' ? new Date().toISOString() : null,
    updated_at: new Date().toISOString(),
  };
}

export async function adminCreateArticle(input: NewsArticleInput): Promise<NewsArticle> {
  const { data, error } = await supabase.from('news_articles').insert(toRow(input)).select(ARTICLE_SELECT).single();
  if (error) throw error;
  return data as NewsArticle;
}

export async function adminUpdateArticle(id: string, input: NewsArticleInput): Promise<NewsArticle> {
  // preserva published_at original se já era publicado e continua publicado
  const existing = await fetchArticleByIdAdmin(id);
  const row = toRow(input);
  if (input.status === 'published' && existing?.published_at) row.published_at = existing.published_at;
  const { data, error } = await supabase.from('news_articles').update(row).eq('id', id).select(ARTICLE_SELECT).single();
  if (error) throw error;
  return data as NewsArticle;
}

export async function adminDeleteArticle(id: string): Promise<void> {
  const existing = await fetchArticleByIdAdmin(id).catch(() => null);
  const { error } = await supabase.from('news_articles').delete().eq('id', id);
  if (error) throw error;
  void logAdminAction('delete', 'news_article', id, { title: existing?.title ?? null });
}

/** IDs das tags de uma matéria (pra pré-selecionar no form de edição). */
export async function fetchArticleTagIds(articleId: string): Promise<string[]> {
  const { data, error } = await supabase
    .from('news_article_tags')
    .select('tag_id')
    .eq('article_id', articleId);
  if (error) throw error;
  return ((data ?? []) as { tag_id: string }[]).map((r) => r.tag_id);
}

/** Seta as tags da matéria atomicamente (RPC admin, delete+insert no servidor). */
export async function setArticleTags(articleId: string, tagIds: string[]): Promise<void> {
  const { error } = await supabase.rpc('admin_set_article_tags', {
    p_article_id: articleId,
    p_tag_ids: tagIds,
  });
  if (error) throw error;
}

export const qkNews = {
  categories: () => ['news-categories'] as const,
  articles: (categoryId?: string, featured?: boolean) => ['news-articles', categoryId ?? null, !!featured] as const,
  article: (slug: string) => ['news-article', slug] as const,
  mostRead: () => ['news-most-read'] as const,
  search: (q: string) => ['news-search', q] as const,
  related: (id: string) => ['news-related', id] as const,
  relatedByTag: (id: string) => ['news-related-tag', id] as const,
  tags: () => ['news-tags'] as const,
  tag: (slug: string) => ['news-tag', slug] as const,
  articlesByTag: (tagId: string) => ['news-articles-by-tag', tagId] as const,
  saved: () => ['news-saved'] as const,
  articleSaved: (id: string) => ['news-article-saved', id] as const,
  followedCategories: () => ['news-followed-categories'] as const,
  adminList: () => ['news-admin-list'] as const,
  adminArticle: (id: string) => ['news-admin-article', id] as const,
  adminArticleTagIds: (id: string) => ['news-admin-article-tagids', id] as const,
};
