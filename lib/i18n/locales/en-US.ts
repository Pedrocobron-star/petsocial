/**
 * English (US) translations.
 *
 * Note: keep keys structurally identical to pt-BR. TypeScript will catch
 * missing keys via the `TranslationKeys` type.
 */
import type { TranslationKeys } from './pt-BR';

export const enUS: TranslationKeys = {
  common: {
    cancel: 'Cancel',
    save: 'Save',
    saveChanges: 'Save changes',
    delete: 'Delete',
    remove: 'Remove',
    confirm: 'Confirm',
    continue: 'Continue',
    back: 'Back',
    next: 'Next',
    loading: 'Loading...',
    sending: 'Sending...',
    retry: 'Try again',
    error: 'Error',
    ok: 'OK',
    yes: 'Yes',
    no: 'No',
  },
  tabs: {
    feed: 'Feed',
    explore: 'Discover',
    create: 'Post',
    meetups: 'Outings',
    profile: 'Profile',
  },
  welcome: {
    navbar: {
      signIn: 'Sign in',
      signUp: 'Sign up',
    },
    hero: {
      title: 'Take care of your pet with peace of mind 🐾',
      subtitle: 'Vaccines on schedule, symptoms tracked, digital ID card — plus the pet community.',
      cta: 'Start free',
      secondaryCta: 'I already have an account',
    },
    features: {
      title: 'Everything your pet needs in one app',
      health: {
        title: 'Health on track',
        description:
          'Vaccines, symptoms, weight, calendar and more. Smart reminders so you never forget.',
      },
      social: {
        title: 'Community that loves pets',
        description:
          'Share moments, meet other owners, and find friends for your pet to play with.',
      },
      ai: {
        title: 'Health Q&A',
        description:
          'Reference guide on food, behavior, vaccines and warning signs.',
      },
    },
    howItWorks: {
      title: 'How it works',
      step1: 'Create your pet\'s profile in 1 minute',
      step2: 'Track vaccines, meds, symptoms',
      step3: 'Share with the community or bring to the vet',
    },
    finalCta: {
      title: 'Take better care of your pet',
      subtitle: 'Free to start. No credit card required.',
      button: 'Create account now',
    },
    footer: {
      copyright: 'Maestro Pet © 2026 · Made with 💛 in Brazil',
    },
  },
  auth: {
    signIn: {
      title: 'Welcome back',
      subtitle: 'Sign in to continue caring for your pets.',
      emailLabel: 'Email',
      emailPlaceholder: 'you@email.com',
      passwordLabel: 'Password',
      passwordPlaceholder: 'Your password',
      submit: 'Sign in',
      forgotPassword: 'Forgot password',
      noAccount: 'Don\'t have an account yet?',
      goToSignUp: 'Sign up',
      error: 'We couldn\'t sign you in. Check your credentials.',
    },
    signUp: {
      title: 'Create account',
      subtitle: 'It\'s free. Start caring for your pet now.',
      nameLabel: 'Name',
      namePlaceholder: 'What should we call you?',
      emailLabel: 'Email',
      passwordLabel: 'Password (min. 6 characters)',
      submit: 'Create account',
      haveAccount: 'Already have an account?',
      goToSignIn: 'Sign in',
      termsPre: 'By creating an account, you agree to our',
      termsLink: 'Terms',
      termsAnd: 'and',
      privacyLink: 'Privacy',
      error: 'We couldn\'t create the account. Try again?',
    },
    resetPassword: {
      title: 'Forgot password',
      subtitle: 'Enter your email and we\'ll send a reset link.',
      submit: 'Send link',
      sent: 'Done! Check your inbox.',
    },
  },
  empty: {
    nothingHere: 'Nothing here yet',
    addFirst: 'Add the first to get started',
  },
  account: {
    title: 'My account',
    plan: {
      label: 'Current plan',
      free: 'Free',
      freeDescription: 'Limited to 3 pets, 1 post/day and ID card with watermark',
      pro: 'Pet Pro',
      proDescription: 'Unlimited features to care for your pet without limits',
      upgradeCta: 'Learn about Pet Pro',
    },
    contact: {
      section: 'Account',
      email: 'Email',
    },
    preferences: {
      section: 'Preferences',
      notifications: 'Notifications',
      notificationsSubtitle: 'Vaccine, parasite and vet reminders',
      language: 'Language',
      languageSubtitle: 'Portuguese, English or Spanish',
    },
    privacy: {
      section: 'Privacy & data',
      export: 'Export my data',
      exportSubtitle: 'Download a JSON with profile, pets, posts, reports and reviews',
      delete: 'Delete my account',
      deleteSubtitle: 'Permanently removes your personal data. No going back.',
    },
    signOut: 'Sign out',
  },
  language: {
    title: 'Language',
    'pt-BR': 'Português (Brasil)',
    'en-US': 'English (US)',
    'es-ES': 'Español',
    saved: 'Language updated',
  },
};
