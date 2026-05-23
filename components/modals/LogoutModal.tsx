import { Modal, View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { supabase } from '../../lib/supabase';
import { useProfileStore } from '../../store/profileStore';
import { useTheme } from '../../theme';

type Props = { visible: boolean; onClose: () => void };

export default function LogoutModal({ visible, onClose }: Props) {
  const { theme } = useTheme();
  const clearProfile = useProfileStore((s) => s.clearProfile);

  async function handleLogout() {
    try {
      await supabase.auth.signOut();
    } catch {
      // Ignore sign-out errors — proceed with local cleanup regardless
    }
    clearProfile();
    onClose();
    router.replace('/(auth)/login');
  }

  return (
    <Modal visible={visible} animationType="fade" transparent onRequestClose={onClose}>
      <LinearGradient
        colors={['rgba(0,0,0,0.18)', 'rgba(0,0,0,0.52)']}
        start={{ x: 0, y: 0 }}
        end={{ x: 0, y: 1 }}
        style={styles.overlay}
      >
        <View
          style={[
            styles.dialog,
            { backgroundColor: theme.colors.surface, borderRadius: theme.radius.xl },
          ]}
        >
          <Text style={[styles.title, { color: theme.colors.text, fontSize: theme.fontSize.lg }]}>
            Log Out
          </Text>
          <Text
            style={[
              styles.body,
              { color: theme.colors.textSecondary, fontSize: theme.fontSize.md },
            ]}
          >
            Are you sure you want to log out?
          </Text>
          <TouchableOpacity
            style={[styles.btnWrap, { borderRadius: theme.radius.md }]}
            onPress={handleLogout}
          >
            <LinearGradient
              colors={theme.gradients.danger}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={[styles.btn, { borderRadius: theme.radius.md }]}
            >
              <Text style={[styles.btnText, { color: '#FFFFFF', fontSize: theme.fontSize.md }]}>
                Log Out
              </Text>
            </LinearGradient>
          </TouchableOpacity>
          <TouchableOpacity
            style={[
              styles.btn,
              {
                backgroundColor: theme.colors.backgroundSecondary,
                borderRadius: theme.radius.md,
              },
            ]}
            onPress={onClose}
          >
            <Text style={[styles.btnText, { color: theme.colors.text, fontSize: theme.fontSize.md }]}>
              Cancel
            </Text>
          </TouchableOpacity>
        </View>
      </LinearGradient>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  dialog: { width: '100%', maxWidth: 340, padding: 24 },
  title: { fontWeight: '700', marginBottom: 8 },
  body: { marginBottom: 24, lineHeight: 22 },
  btnWrap: { overflow: 'hidden', marginBottom: 10 },
  btn: { paddingVertical: 14, alignItems: 'center', marginBottom: 10 },
  btnText: { fontWeight: '600' },
});
