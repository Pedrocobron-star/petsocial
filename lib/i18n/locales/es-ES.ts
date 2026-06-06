/**
 * Español — traducciones.
 *
 * Nota: mantener la estructura idéntica al pt-BR. TypeScript detecta llaves
 * faltantes vía el tipo TranslationKeys.
 */
import type { TranslationKeys } from './pt-BR';

export const esES: TranslationKeys = {
  common: {
    cancel: 'Cancelar',
    save: 'Guardar',
    saveChanges: 'Guardar cambios',
    delete: 'Eliminar',
    remove: 'Quitar',
    confirm: 'Confirmar',
    continue: 'Continuar',
    back: 'Volver',
    next: 'Siguiente',
    loading: 'Cargando...',
    sending: 'Enviando...',
    retry: 'Reintentar',
    error: 'Error',
    ok: 'OK',
    yes: 'Sí',
    no: 'No',
  },
  tabs: {
    feed: 'Feed',
    explore: 'Descubrir',
    create: 'Publicar',
    meetups: 'Planes',
    profile: 'Perfil',
  },
  welcome: {
    navbar: {
      signIn: 'Entrar',
      signUp: 'Crear cuenta',
    },
    hero: {
      title: 'Cuida de tu mascota con tranquilidad 🐾',
      subtitle:
        'Vacunas al día, síntomas registrados, carnet digital — y la comunidad de mascotas.',
      cta: 'Empezar gratis',
      secondaryCta: 'Ya tengo cuenta',
    },
    features: {
      title: 'Todo lo que tu mascota necesita en una app',
      health: {
        title: 'Salud bajo control',
        description:
          'Vacunas, síntomas, peso, calendario y más. Recordatorios inteligentes para no olvidar nada.',
      },
      social: {
        title: 'Comunidad que ama a las mascotas',
        description:
          'Comparte momentos, conoce a otros tutores y encuentra amigos de la especie de tu mascota.',
      },
      ai: {
        title: 'Asistente IA',
        description: 'Dudas sobre alimentación, comportamiento, vacunas. Respuesta en segundos.',
      },
    },
    howItWorks: {
      title: 'Cómo funciona',
      step1: 'Crea el perfil de tu mascota en 1 minuto',
      step2: 'Registra vacunas, medicamentos, síntomas',
      step3: 'Comparte con la comunidad o lleva al veterinario',
    },
    finalCta: {
      title: 'Cuida mejor a tu mascota',
      subtitle: 'Gratis para empezar. Sin tarjeta de crédito.',
      button: 'Crear cuenta ahora',
    },
    footer: {
      copyright: 'Pet Social © 2026 · Hecho con 💛 en Brasil',
    },
  },
  auth: {
    signIn: {
      title: 'Bienvenido de vuelta',
      subtitle: 'Entra para seguir cuidando a tus mascotas.',
      emailLabel: 'Email',
      emailPlaceholder: 'tu@email.com',
      passwordLabel: 'Contraseña',
      passwordPlaceholder: 'Tu contraseña',
      submit: 'Entrar',
      forgotPassword: 'Olvidé la contraseña',
      noAccount: '¿Aún no tienes cuenta?',
      goToSignUp: 'Crear cuenta',
      error: 'No pudimos iniciar sesión. Verifica tus datos.',
    },
    signUp: {
      title: 'Crear cuenta',
      subtitle: 'Es gratis. Empieza a cuidar a tu mascota ahora.',
      nameLabel: 'Nombre',
      namePlaceholder: '¿Cómo te podemos llamar?',
      emailLabel: 'Email',
      passwordLabel: 'Contraseña (mín. 6 caracteres)',
      submit: 'Crear cuenta',
      haveAccount: '¿Ya tienes cuenta?',
      goToSignIn: 'Entrar',
      termsPre: 'Al crear cuenta, aceptas nuestros',
      termsLink: 'Términos',
      termsAnd: 'y',
      privacyLink: 'Privacidad',
      error: 'No pudimos crear la cuenta. ¿Intentar de nuevo?',
    },
    resetPassword: {
      title: 'Olvidé la contraseña',
      subtitle: 'Ingresa tu email y enviaremos un link para restablecer.',
      submit: 'Enviar link',
      sent: '¡Listo! Revisa tu bandeja de entrada.',
    },
  },
  empty: {
    nothingHere: 'Aún nada por aquí',
    addFirst: 'Agrega el primero para empezar',
  },
  account: {
    title: 'Mi cuenta',
    plan: {
      label: 'Plan actual',
      free: 'Gratuito',
      freeDescription: 'Limitado a 3 mascotas, 1 publicación/día y carnet con marca de agua',
      pro: 'Pet Pro',
      proDescription: 'Funciones ilimitadas para cuidar a tu mascota sin límites',
      upgradeCta: 'Conocer Pet Pro',
    },
    contact: {
      section: 'Cuenta',
      email: 'Email',
    },
    preferences: {
      section: 'Preferencias',
      notifications: 'Notificaciones',
      notificationsSubtitle: 'Recordatorios de vacunas, parásitos y consultas',
      language: 'Idioma',
      languageSubtitle: 'Portugués, English o Español',
    },
    privacy: {
      section: 'Privacidad y datos',
      export: 'Exportar mis datos',
      exportSubtitle: 'Descarga un JSON con perfil, mascotas, publicaciones, reportes y reseñas',
      delete: 'Eliminar mi cuenta',
      deleteSubtitle: 'Elimina permanentemente tus datos personales. Sin vuelta atrás.',
    },
    signOut: 'Cerrar sesión',
  },
  language: {
    title: 'Idioma',
    'pt-BR': 'Português (Brasil)',
    'en-US': 'English (US)',
    'es-ES': 'Español',
    saved: 'Idioma actualizado',
  },
};
