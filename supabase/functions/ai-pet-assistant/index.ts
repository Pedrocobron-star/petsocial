// Supabase Edge Function — ai-pet-assistant
//
// Chat com IA treinada em saúde pet. Salva conversas em ai_messages.
// Deploy: supabase functions deploy ai-pet-assistant
// Secrets: ANTHROPIC_API_KEY (ou OPENAI_API_KEY)

import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0';

const SYSTEM_PROMPT = `Você é a IA do Pet Social, uma assistente virtual amigável especializada em cuidados com pets (cachorros, gatos, pássaros, coelhos, etc.).

Seu papel:
- Responder dúvidas sobre saúde, comportamento, alimentação e cuidados gerais.
- Ser carinhosa, em português brasileiro informal mas profissional.
- SEMPRE recomendar consulta com veterinário em casos de:
  * Sintomas persistentes (>24h)
  * Vômito com sangue, convulsões, dificuldade respiratória
  * Acidentes, envenenamentos suspeitos
  * Qualquer emergência

Limitações importantes:
- Você NÃO substitui um veterinário. Deixe isso claro.
- Não prescreva medicamentos específicos com dose. Pode mencionar tratamentos comuns ("seu vet pode receitar X").
- Se a pergunta não é sobre pets, redirecione gentilmente.

Estilo:
- Respostas curtas e práticas (2-4 parágrafos máximo).
- Use emojis com moderação (🐾 quando faz sentido).
- Quando relevante, sugira ações específicas: "Anote o peso", "Filme o sintoma", etc.

Quando o usuário mencionar o pet pelo nome, use o nome na resposta pra ser pessoal.`;

interface Anthropic_MessagesResponse {
  content: Array<{ type: 'text'; text: string }>;
  usage: { input_tokens: number; output_tokens: number };
}

serve(async (req) => {
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  };

  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: req.headers.get('Authorization')! } } },
    );
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return new Response(JSON.stringify({ error: 'not authenticated' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { conversationId, petId } = await req.json();
    if (!conversationId) {
      return new Response(JSON.stringify({ error: 'conversationId required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Carrega histórico (últimas 20 mensagens)
    const { data: history } = await supabase
      .from('ai_messages')
      .select('role, content')
      .eq('conversation_id', conversationId)
      .order('created_at', { ascending: true })
      .limit(20);

    // Carrega contexto do pet (se especificado)
    let petContext = '';
    if (petId) {
      const { data: pet } = await supabase
        .from('pets')
        .select('name, species, breed, birthdate, social_temperament')
        .eq('id', petId)
        .maybeSingle();
      if (pet) {
        petContext = `\n\nContexto: o usuário tá perguntando sobre o pet "${pet.name}" (${pet.species}${pet.breed ? `, ${pet.breed}` : ''}${pet.birthdate ? `, nasceu em ${pet.birthdate}` : ''}).`;
      }
    }

    // Chama Anthropic Claude
    const anthropicKey = Deno.env.get('ANTHROPIC_API_KEY');
    if (!anthropicKey) {
      throw new Error('ANTHROPIC_API_KEY not configured');
    }

    const messages = (history ?? [])
      .filter((m) => m.role !== 'system')
      .map((m) => ({ role: m.role as 'user' | 'assistant', content: m.content }));

    const resp = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': anthropicKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-3-5-sonnet-20241022',
        max_tokens: 600,
        system: SYSTEM_PROMPT + petContext,
        messages,
      }),
    });

    if (!resp.ok) {
      const errText = await resp.text();
      console.error('anthropic error:', errText);
      throw new Error('anthropic api error');
    }

    const data = (await resp.json()) as Anthropic_MessagesResponse;
    const aiText = data.content[0]?.text ?? 'Desculpa, não consegui responder agora.';

    const { data: savedMsg, error: saveErr } = await supabase
      .from('ai_messages')
      .insert({
        conversation_id: conversationId,
        role: 'assistant',
        content: aiText,
        tokens_used: data.usage.input_tokens + data.usage.output_tokens,
      })
      .select('*')
      .single();
    if (saveErr) throw saveErr;

    // Atualiza updated_at da conversa
    await supabase
      .from('ai_conversations')
      .update({ updated_at: new Date().toISOString() })
      .eq('id', conversationId);

    return new Response(JSON.stringify({ message: savedMsg }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    console.error('ai-pet-assistant error:', err);
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : 'unknown' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  }
});
