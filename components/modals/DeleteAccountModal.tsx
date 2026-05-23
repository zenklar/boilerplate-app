import { useState } from 'react';
import {
  Modal, View, Text, TextInput, TouchableOpacity, StyleSheet,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { supabase } from '../../lib/supabase';
import { useProfileStore } from '../../store/profileStore';
import { useTheme } from '../../theme';

type Props = { visible: boolean; onClose: () => void };

export default function DeleteAccountModal({ visible, onClose }: Props) {
  const { theme } = useTheme();
  const clearProfile = useProfileStore((s) => s.clearProfile);
  const [confirmText, setConfirmText] = useState('');
  const [loading, setLoading] = useState(false);

  const isConfirmed = confirmText === 'DELETE';

  async function handleDelete() {
    if (!isConfirmed) return;
    setLoading(true);
    // Call your Supabase Edge Function to delete the account.
    // The client-side cannot delete auth users directly (requires service role key).
    // Replace this with: await supabase.functions.invoke('delete-account')
    await supabase.auth.signOut();
    clearProfile();
    setLoading(false);
    setConfirmText('');
    onClose();
    router.replace('/(auth)/login');
  }

  function handleClose() {
    setConfirmText('');
    onClose();
  }

  return (
    <Modal visible={visible} animationType="fade" transparent onRequestClose={handleClose}>
      <LinearGradient
        colors={['rgba(0,0,0,0.18)', 'rgba(0,0,0,0.52)']}
        start={{ x: 0, y: 0 }}
        end={{ x: 0, y: 1 }}
        style={styles.overlay}
      >
        <View style={[styles.dialog, { backgroundColor: theme.colors.surface, borderRadius: theme.radius.xl }]}>
          <Text style={[styles.title, { color: theme.colors.danger, fontSize: theme.fontSize.xl }]}>
            Delete Account
          </Text>
          <Text style={[styles.body, { color: theme.colors.textSecondary, fontSize: theme.fontSize.md }]}>
            This action is permanent and cannot be undone. All your data will be deleted.
          </Text>
          <Text style={[styles.label, { color: theme.colors.text, fontSize: theme.fontSize.sm }]}>
            Type DELETE to confirm:
          </Text>
          <TextInput
            style={[
              styles.input,
              {
                backgroundColor: theme.colors.inputBackground,
                color: theme.colors.inputText,
                borderColor: isConfirmed ? theme.colors.danger : theme.colors.border,
                borderRadius: theme.radius.md,
                fontSize: theme.fontSize.md,
              },
            ]}
            placeholder="DELETE"
            placeholderTextColor={theme.colors.inputPlaceholder}
            value={confirmText}
            onChangeText={setConfirmText}
            autoCapitalize="characters"
            autoCorrect={false}
          />
          {isConfirmed ? (
            <TouchableOpacity
              style={[styles.btnWrap, { borderRadius: theme.radius.md, opacity: loading ? 0.7 : 1 }]}
              onPress={handleDelete}
              disabled={loading}
            >
              <LinearGradient
                colors={theme.gradients.danger}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={[styles.btn, { borderRadius: theme.radius.md }]}
              >
                <Text style={[styles.btnText, { color: '#FFFFFF', fontSize: theme.fontSize.md }]}>
                  {loading ? 'Deleting…' : 'Delete My Account'}
                </Text>
              </LinearGradient>
            </TouchableOpacity>
          ) : (
            <View
              style={[
                styles.btn,
                { backgroundColor: theme.colors.backgroundSecondary, borderRadius: theme.radius.md, marginBottom: 12 },
              ]}
            >
              <Text style={[styles.btnText, { color: theme.colors.textMuted, fontSize: theme.fontSize.md }]}>
                Delete My Account
              </Text>
            </View>
          )}
          <TouchableOpacity style={styles.cancel} onPress={handleClose}>
            <Text style={[styles.cancelText, { color: theme.colors.textMuted, fontSize: theme.fontSize.md }]}>Cancel</Text>
          </TouchableOpacity>
        </View>
      </LinearGradient>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 },
  dialog: { width: '100%', maxWidth: 380, padding: 24 },
  title: { fontWeight: '700', marginBottom: 10 },
  body: { marginBottom: 20, lineHeight: 22 },
  label: { marginBottom: 8, fontWeight: '500' },
  input: { paddingHorizontal: 14, paddingVertical: 12, borderWidth: 1, marginBottom: 16 },
  btnWrap: { overflow: 'hidden', marginBottom: 12 },
  btn: { paddingVertical: 14, alignItems: 'center', marginBottom: 12 },
  btnText: { fontWeight: '600' },
  cancel: { alignItems: 'center', paddingVertical: 10 },
  cancelText: {},
});
