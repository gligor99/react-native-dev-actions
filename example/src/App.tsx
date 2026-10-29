import { useState } from 'react';
import { Text, View, StyleSheet } from 'react-native';
import { useDevAction } from 'react-native-dev-actions';
import { env } from './devTools';

function Home() {
  const { apiUrl } = env.useEnv();
  const [user, setUser] = useState<string | null>('jane@example.com');

  // Needs component state, so it lives in the tree instead of devTools.ts.
  useDevAction({
    id: 'logout',
    title: 'Log out',
    onPress: () => setUser(null),
  });

  return (
    <View style={styles.container}>
      <Text style={styles.title}>{env.name()}</Text>
      <Text>{apiUrl}</Text>
      <Text>{user ? `Signed in as ${user}` : 'Signed out'}</Text>
      <Text style={styles.hint}>Open the dev menu to try the actions.</Text>
    </View>
  );
}

export default function App() {
  return (
    <env.EnvGate>
      <Home />
    </env.EnvGate>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  title: {
    fontSize: 24,
    fontWeight: '600',
  },
  hint: {
    marginTop: 16,
    color: '#666',
  },
});
