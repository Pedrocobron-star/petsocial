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

export type NewsStatus = 'draft' | 'published' | 'scheduled';

export interface NewsArticle {
  id: string;
  slug: string;
  category_id: string | null;
  title: string;
  dek: string | null;
  cover_url: string | null;
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
}

export interface NewsArticleInput {
  slug: string;
  category_id: string | null;
  title: string;
  dek: string | null;
  cover_url: string | null;
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

export async function fetchArticleBySlug(slug: string): Promise<NewsArticle | null> {
  const { data, error } = await supabase
    .from('news_articles')
    .select(ARTICLE_SELECT)
    .eq('slug', slug)
    .maybeSingle();
  if (error) throw error;
  return (data as NewsArticle | null) ?? null;
}

export async function incrementArticleView(id: string): Promise<void> {
  await supabase.rpc('news_increment_view', { p_id: id }).then(undefined, () => {});
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

// ---------- admin (CMS) ----------

export async function fetchAllArticlesAdmin(): Promise<NewsArticle[]> {
  const { data, error } = await supabase
    .from('news_articles')
    .select(ARTICLE_SELECT)
    .order('updated_at', { ascending: false })
    .limit(100);
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

export const qkNews = {
  categories: () => ['news-categories'] as const,
  articles: (categoryId?: string, featured?: boolean) => ['news-articles', categoryId ?? null, !!featured] as const,
  article: (slug: string) => ['news-article', slug] as const,
  related: (id: string) => ['news-related', id] as const,
  adminList: () => ['news-admin-list'] as const,
  adminArticle: (id: string) => ['news-admin-article', id] as const,
};
