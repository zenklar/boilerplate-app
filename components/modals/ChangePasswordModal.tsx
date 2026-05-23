import { useState } from 'react';
import {
  Modal,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { supabase } from '../../lib/supabase';
import { useTheme } from '../../theme';

type Props = { visible: boolean; onClose: () => void };

export default function ChangePasswordModal({ visible, onClose }: Props) {
  const { theme } = useTheme();
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(
    null,
  );

  function reset() {
    setNewPassword('');
    setConfirmPassword('');
    setMessage(null);
    setLoading(false);
  }

  function handleClose() {
    reset();
    onClose();
  }

  async function handleSubmit() {
    if (newPassword.length < 8) {
      setMessage({ type: 'error', text: 'Password must be at least 8 characters.' });
      return;
    }
    if (newPassword !== confirmPassword) {
      setMessage({ type: 'error', text: 'Passwords do not match.' });
      return;
    }
    setLoading(true);
    setMessage(null);
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    setLoading(false);
    if (error) {
      setMessage({ type: 'error', text: error.message });
    } else {
      setMessage({ type: 'success', text: 'Password updated successfully.' });
      setTimeout(handleClose, 1500);
    }
  }

  const inputStyle = [
    styles.input,
    {
      backgroundColor: theme.colors.inputBackground,
      color: theme.colors.inputText,
      borderColor: theme.colors.border,
      borderRadius: theme.radius.md,
      fontSize: theme.fontSize.md,
    },
  ];

  return (
    <Modal visible={visible} animationType="fade" transparent onRequestClose={handleClose}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.outerWrap}
      >
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
          <Text style={[styles.title, { color: theme.colors.text, fontSize: theme.fontSize.xl }]}>
            Change Password
          </Text>
          <Text
            style={[styles.subtitle, { color: theme.colors.textMuted, fontSize: theme.fontSize.sm }]}
          >
            Must be at least 8 characters
          </Text>
          <TextInput
            style={inputStyle}
            placeholder="New password"
            placeholderTextColor={theme.colors.inputPlaceholder}
            secureTextEntry
            value={newPassword}
            onChangeText={setNewPassword}
          />
          <TextInput
            style={[inputStyle, { marginTop: 12 }]}
            placeholder="Confirm new password"
            placeholderTextColor={theme.colors.inputPlaceholder}
            secureTextEntry
            value={confirmPassword}
            onChangeText={setConfirmPassword}
          />
          {message && (
            <Text
              style={[
                styles.msg,
                {
                  color: message.type === 'error' ? theme.colors.danger : theme.colors.success,
                  fontSize: theme.fontSize.sm,
                },
              ]}
            >
              {message.text}
            </Text>
          )}
          <TouchableOpacity
            style={[
              styles.btnWrap,
              { borderRadius: theme.radius.md, opacity: loading ? 0.7 : 1 },
            ]}
            onPress={handleSubmit}
            disabled={loading}
          >
            <LinearGradient
              colors={theme.gradients.primary}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={[styles.btn, { borderRadius: theme.radius.md }]}
            >
              <Text style={[styles.btnText, { color: theme.colors.primaryText, fontSize: theme.fontSize.md }]}>
                {loading ? 'Updating…' : 'Update Password'}
              </Text>
            </LinearGradient>
          </TouchableOpacity>
          <TouchableOpacity style={styles.cancel} onPress={handleClose}>
            <Text style={[{ color: theme.colors.textMuted, fontSize: theme.fontSize.md }]}>
              Cancel
            </Text>
          </TouchableOpacity>
          </View>
        </LinearGradient>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  outerWrap: { flex: 1 },
  overlay: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 },
  dialog: { width: '100%', maxWidth: 380, padding: 24 },
  title: { fontWeight: '700', marginBottom: 4 },
  subtitle: { marginBottom: 20 },
  input: { paddingHorizontal: 14, paddingVertical: 12, borderWidth: 1 },
  msg: { marginTop: 10 },
  btnWrap: { marginTop: 20, overflow: 'hidden' },
  btn: { paddingVertical: 14, alignItems: 'center' },
  btnText: { fontWeight: '600' },
  cancel: { marginTop: 12, alignItems: 'center', paddingVertical: 10 },
});
