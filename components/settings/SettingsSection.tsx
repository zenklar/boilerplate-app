import { View, Text, StyleSheet } from 'react-native';
import { useTheme } from '../../theme';

type Props = {
  title: string;
  children: React.ReactNode;
};

export default function SettingsSection({ title, children }: Props) {
  const { theme } = useTheme();

  const cardShadow = theme.mode === 'light'
    ? {
        boxShadow: '0px 1px 4px rgba(0, 0, 0, 0.07)',
        elevation: 2,
      }
    : {};

  return (
    <View style={styles.section}>
      <Text
        style={[
          styles.title,
          { color: theme.colors.textMuted, fontSize: theme.fontSize.xs },
        ]}
      >
        {title.toUpperCase()}
      </Text>
      <View
        style={[
          styles.card,
          { backgroundColor: theme.colors.card, borderColor: theme.colors.cardBorder },
          cardShadow,
        ]}
      >
        {children}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  section: { marginBottom: 32, paddingHorizontal: 16 },
  title: {
    fontWeight: '600',
    letterSpacing: 0.5,
    marginBottom: 8,
    marginLeft: 4,
  },
  card: {
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
  },
});
