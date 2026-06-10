import { useEffect } from 'react';
import { Platform } from 'react-native';

import { setMetaTags, type MetaTagsInput } from '@/lib/meta-tags';

/**
 * Componente declarativo pra setar meta tags numa rota específica.
 *
 * Uso:
 *   <MetaTags
 *     title="Bidu — Maestro Pet"
 *     description="Conheça o Bidu, vira-lata adorável de São Paulo"
 *     image={pet.avatar_url}
 *     type="profile"
 *   />
 *
 * Atualiza sempre que as props mudam (ex: dados do pet carregam async).
 */
export function MetaTags(props: MetaTagsInput) {
  useEffect(() => {
    if (Platform.OS !== 'web') return;
    setMetaTags(props);
  }, [props]);

  return null;
}
