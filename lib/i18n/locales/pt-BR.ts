/**
 * Português brasileiro — locale primário.
 *
 * Convenção das chaves: `seção.contexto.nome` em camelCase.
 * Interpolação: usar `{name}` que vira `translate(key, { name: 'Bidu' })`.
 * Pluralização: gerenciar com 2 chaves (ex: `n_pets.one` / `n_pets.other`).
 */

/** Estrutura recursiva: cada folha é string. Não usa `as const` pra permitir
 *  que en-US e es-ES sejam atribuídos ao mesmo type sem coerção. */
export interface TranslationDict {
  [key: string]: string | TranslationDict;
}

export const ptBR = {
  common: {
    cancel: 'Cancelar',
    save: 'Salvar',
    saveChanges: 'Salvar alterações',
    delete: 'Apagar',
    remove: 'Remover',
    confirm: 'Confirmar',
    continue: 'Continuar',
    back: 'Voltar',
    next: 'Próximo',
    loading: 'Carregando...',
    sending: 'Enviando...',
    retry: 'Tentar novamente',
    error: 'Erro',
    ok: 'OK',
    yes: 'Sim',
    no: 'Não',
  },
  tabs: {
    feed: 'Feed',
    explore: 'Descobrir',
    create: 'Postar',
    meetups: 'Rolês',
    profile: 'Perfil',
  },
  welcome: {
    navbar: {
      signIn: 'Entrar',
      signUp: 'Criar conta',
    },
    hero: {
      title: 'Cuide do seu pet com tranquilidade 🐾',
      subtitle: 'Vacinas em dia, sintomas registrados, carteirinha digital e a comunidade pet do Brasil.',
      cta: 'Começar grátis',
      secondaryCta: 'Já tenho conta',
    },
    features: {
      title: 'Tudo que seu pet precisa em um app',
      health: {
        title: 'Saúde sob controle',
        description:
          'Vacinas, sintomas, peso, calendário e mais. Lembretes inteligentes pra não esquecer nada.',
      },
      social: {
        title: 'Comunidade que ama pets',
        description:
          'Compartilhe momentos, conheça outros tutores e encontre amigos da espécie do seu pet.',
      },
      ai: {
        title: 'Tira-dúvidas de saúde',
        description: 'Guia de referência sobre alimentação, comportamento, vacinas e sinais de alerta.',
      },
    },
    howItWorks: {
      title: 'Como funciona',
      step1: 'Crie o perfil do seu pet em 1 minuto',
      step2: 'Registre vacinas, remédios, sintomas',
      step3: 'Compartilhe com a comunidade ou levante pro vet',
    },
    finalCta: {
      title: 'Cuide melhor do seu pet',
      subtitle: 'Grátis pra começar. Sem cartão de crédito.',
      button: 'Criar conta agora',
    },
    footer: {
      copyright: 'Maestro Pet © 2026 · Feito com 💛 no Brasil',
    },
  },
  auth: {
    signIn: {
      title: 'Bem-vindo de volta',
      subtitle: 'Entre pra continuar cuidando dos seus pets.',
      emailLabel: 'Email',
      emailPlaceholder: 'seu@email.com',
      passwordLabel: 'Senha',
      passwordPlaceholder: 'Sua senha',
      submit: 'Entrar',
      forgotPassword: 'Esqueci a senha',
      noAccount: 'Ainda não tem conta?',
      goToSignUp: 'Criar conta',
      error: 'Não conseguimos entrar. Verifique seus dados.',
    },
    signUp: {
      title: 'Criar conta',
      subtitle: 'É grátis. Comece a cuidar do seu pet agora.',
      nameLabel: 'Nome',
      namePlaceholder: 'Como podemos te chamar?',
      emailLabel: 'Email',
      passwordLabel: 'Senha (mín. 6 caracteres)',
      submit: 'Criar conta',
      haveAccount: 'Já tem conta?',
      goToSignIn: 'Entrar',
      termsPre: 'Ao criar conta, você concorda com nossos',
      termsLink: 'Termos',
      termsAnd: 'e',
      privacyLink: 'Privacidade',
      error: 'Não conseguimos criar a conta. Tenta de novo?',
    },
    resetPassword: {
      title: 'Esqueci a senha',
      subtitle: 'Digite seu email e enviaremos um link pra redefinir.',
      submit: 'Enviar link',
      sent: 'Pronto! Verifique sua caixa de entrada.',
    },
  },
  empty: {
    nothingHere: 'Nada por aqui ainda',
    addFirst: 'Adicione o primeiro pra começar',
  },
  account: {
    title: 'Minha conta',
    plan: {
      label: 'Plano atual',
      free: 'Gratuito',
      freeDescription: 'Limitado a 3 pets, 1 post/dia e carteirinha com marca d\'água',
      pro: 'Pet Pro',
      proDescription: 'Recursos ilimitados pra cuidar do seu pet sem limites',
      upgradeCta: 'Conhecer Pet Pro',
    },
    contact: {
      section: 'Conta',
      email: 'Email',
    },
    preferences: {
      section: 'Preferências',
      notifications: 'Notificações',
      notificationsSubtitle: 'Lembretes de vacinas, parasitas e consultas',
      language: 'Idioma',
      languageSubtitle: 'Português, English ou Español',
    },
    privacy: {
      section: 'Privacidade & dados (LGPD)',
      export: 'Exportar meus dados',
      exportSubtitle: 'Baixa um JSON com perfil, pets, posts, reportes e reviews',
      delete: 'Excluir minha conta',
      deleteSubtitle: 'Remove permanentemente seus dados pessoais. Sem volta.',
    },
    signOut: 'Sair',
  },
  language: {
    title: 'Idioma',
    'pt-BR': 'Português (Brasil)',
    'en-US': 'English (US)',
    'es-ES': 'Español',
    saved: 'Idioma atualizado',
  },
};

/** Type derived do pt-BR pero com folhas como `string` em vez de literais.
 *  Garante shape igual entre locales sem o ergonomic friction de `as const`. */
export type TranslationKeys = typeof ptBR;
