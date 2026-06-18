import { Redirect } from 'expo-router';

// O joguinho virou o hub "Arena Pet" em /games. Mantém o link antigo vivo.
export default function LegacyGameRedirect() {
  return <Redirect href={'/(app)/games' as never} />;
}
