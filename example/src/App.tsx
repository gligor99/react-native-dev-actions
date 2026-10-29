import { useState, type ReactNode } from 'react';
import {
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  useColorScheme,
  View,
} from 'react-native';
import { DevActionsGate, useDevAction } from 'react-native-dev-actions';
import { env, flags } from './devTools';

const ENV_COLORS: Record<string, string> = {
  dev: '#16a34a',
  staging: '#d97706',
  prod: '#dc2626',
};

const lightTheme = {
  background: '#f4f4f5',
  card: '#ffffff',
  text: '#18181b',
  muted: '#71717a',
  border: '#e4e4e7',
  code: '#f4f4f5',
};

const darkTheme: typeof lightTheme = {
  background: '#09090b',
  card: '#18181b',
  text: '#fafafa',
  muted: '#a1a1aa',
  border: '#27272a',
  code: '#27272a',
};

const TRY_ACTIONS = [
  'Env → staging',
  'newCheckout',
  'paywall: v2',
  'Share debug info',
  'Log out',
];

const GATE = [env, flags];

const MENU_SHORTCUT =
  Platform.OS === 'ios' ? '⌘D in the simulator' : '⌘M in the emulator';

function Card({
  label,
  theme,
  children,
}: {
  label: string;
  theme: typeof lightTheme;
  children: ReactNode;
}) {
  return (
    <View
      style={[
        styles.card,
        { backgroundColor: theme.card, borderColor: theme.border },
      ]}
    >
      <Text style={[styles.cardLabel, { color: theme.muted }]}>{label}</Text>
      {children}
    </View>
  );
}

function Home() {
  const theme = useColorScheme() === 'dark' ? darkTheme : lightTheme;
  const { apiUrl } = env.useEnv();
  const envName = env.name();
  const envColor = ENV_COLORS[envName] ?? theme.muted;
  const [user, setUser] = useState<string | null>('jane@example.com');
  const newCheckout = flags.useFlag('newCheckout');
  const paywall = flags.useFlag('paywall');
  const pillTextColor = newCheckout ? '#ffffff' : theme.muted;

  // Needs component state, so it lives in the tree instead of devTools.ts.
  useDevAction({
    id: 'logout',
    title: 'Log out',
    onPress: () => setUser(null),
  });

  return (
    <ScrollView
      style={{ backgroundColor: theme.background }}
      contentContainerStyle={styles.container}
    >
      <Text style={[styles.eyebrow, { color: theme.muted }]}>
        react-native-dev-actions
      </Text>
      <Text style={[styles.title, { color: theme.text }]}>Example app</Text>

      <Card label="ENVIRONMENT" theme={theme}>
        <View style={styles.row}>
          <View style={[styles.badge, { backgroundColor: envColor }]}>
            <Text style={styles.badgeText}>{envName.toUpperCase()}</Text>
          </View>
        </View>
        <Text
          style={[
            styles.code,
            { backgroundColor: theme.code, color: theme.text },
          ]}
        >
          {apiUrl}
        </Text>
      </Card>

      <Card label="SESSION" theme={theme}>
        <View style={styles.row}>
          <View
            style={[
              styles.avatar,
              { backgroundColor: user ? envColor : theme.border },
            ]}
          >
            <Text style={styles.avatarText}>
              {user ? user[0]!.toUpperCase() : '?'}
            </Text>
          </View>
          <View style={styles.sessionText}>
            <Text style={[styles.body, { color: theme.text }]}>
              {user ?? 'Signed out'}
            </Text>
            <Text style={[styles.small, { color: theme.muted }]}>
              {user ? 'Signed in' : 'Use the dev menu to reload'}
            </Text>
          </View>
        </View>
      </Card>

      <Card label="FLAGS" theme={theme}>
        <View style={styles.flagRow}>
          <Text style={[styles.body, { color: theme.text }]}>newCheckout</Text>
          <View
            style={[
              styles.pill,
              { backgroundColor: newCheckout ? ENV_COLORS.dev : theme.border },
            ]}
          >
            <Text style={[styles.pillText, { color: pillTextColor }]}>
              {newCheckout ? 'ON' : 'OFF'}
            </Text>
          </View>
        </View>
        <View style={styles.flagRow}>
          <Text style={[styles.body, { color: theme.text }]}>paywall</Text>
          <View style={[styles.segment, { borderColor: theme.border }]}>
            {flags.flags.paywall.options.map((option) => (
              <Text
                key={option}
                style={[
                  styles.segmentItem,
                  option === paywall
                    ? { backgroundColor: theme.text, color: theme.card }
                    : { color: theme.muted },
                ]}
              >
                {option}
              </Text>
            ))}
          </View>
        </View>
      </Card>

      <Card label="DEV MENU" theme={theme}>
        <Text style={[styles.small, { color: theme.muted }]}>
          Open it with {MENU_SHORTCUT} or by shaking the device.
        </Text>
        <View style={styles.actions}>
          {TRY_ACTIONS.map((title) => (
            <View
              key={title}
              style={[styles.actionChip, { borderColor: theme.border }]}
            >
              <Text style={[styles.small, { color: theme.text }]}>{title}</Text>
            </View>
          ))}
        </View>
      </Card>
    </ScrollView>
  );
}

export default function App() {
  return (
    <DevActionsGate wait={GATE}>
      <Home />
    </DevActionsGate>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 20,
    paddingTop: 80,
    gap: 16,
  },
  eyebrow: {
    fontSize: 13,
    fontWeight: '500',
    fontFamily: Platform.select({ ios: 'Menlo', default: 'monospace' }),
  },
  title: {
    fontSize: 32,
    fontWeight: '700',
    marginBottom: 8,
  },
  card: {
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 16,
    gap: 12,
  },
  cardLabel: {
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 0.8,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  badge: {
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 4,
  },
  badgeText: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  code: {
    fontFamily: Platform.select({ ios: 'Menlo', default: 'monospace' }),
    fontSize: 14,
    borderRadius: 8,
    padding: 10,
    overflow: 'hidden',
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: '700',
  },
  sessionText: {
    gap: 2,
  },
  body: {
    fontSize: 16,
    fontWeight: '500',
  },
  small: {
    fontSize: 13,
  },
  actions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  flagRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  pill: {
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 3,
  },
  pillText: {
    fontSize: 12,
    fontWeight: '700',
  },
  segment: {
    flexDirection: 'row',
    borderWidth: 1,
    borderRadius: 8,
    overflow: 'hidden',
  },
  segmentItem: {
    fontSize: 13,
    fontWeight: '500',
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  actionChip: {
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
});
