import { TouchableOpacity, View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../theme';

type Props = {
  icon?: keyof typeof Ionicons.glyphMap;
  label: string;
  value?: string;
  onPress?: () => void;
  showChevron?: boolean;
  labelColor?: string;
  rightElement?: React.ReactNode;
  isLast?: boolean;
};

export default function SettingsRow({
  icon,
  label,
  value,
  onPress,
  showChevron = true,
  labelColor,
  rightElement,
  isLast,
}: Props) {
  const { theme } = useTheme();

  const inner = (
    <View
      style={[
        styles.row,
        !isLast && {
          borderBottomWidth: StyleSheet.hairlineWidth,
          borderBottomColor: theme.colors.separator,
        },
      ]}
    >
      {icon && (
        <View style={styles.iconWrap}>
          <Ionicons name={icon} size={18} color={theme.colors.text} />
        </View>
      )}
      <Text
        style={[
          styles.label,
          { color: labelColor ?? theme.colors.text, fontSize: theme.fontSize.md },
        ]}
        numberOfLines={1}
      >
        {label}
      </Text>
      <View style={styles.right}>
        {value ? (
          <Text
            style={[styles.value, { color: theme.colors.textMuted, fontSize: theme.fontSize.sm }]}
            numberOfLines={1}
          >
            {value}
          </Text>
        ) : null}
        {rightElement}
        {showChevron && onPress && (
          <Ionicons name="chevron-forward" size={16} color={theme.colors.textMuted} />
        )}
      </View>
    </View>
  );

  if (onPress) {
    return (
      <TouchableOpacity onPress={onPress} activeOpacity={0.7}>
        {inner}
      </TouchableOpacity>
    );
  }
  return inner;
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    gap: 12,
    minHeight: 50,
  },
  iconWrap: {
    width: 32,
    height: 32,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: { flex: 1, fontWeight: '400' },
  right: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  value: {},
});
