import {
  Modal, View, Text, ScrollView, TouchableOpacity, StyleSheet,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../theme';
import { APP_NAME } from '../../constants/social';

type Props = { visible: boolean; onClose: () => void };

const LAST_UPDATED = 'May 23, 2026';

export default function PrivacyPolicyModal({ visible, onClose }: Props) {
  const { theme } = useTheme();

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
            styles.sheet,
            { backgroundColor: theme.colors.surface, borderRadius: theme.radius.xl },
          ]}
        >
          {/* Header */}
          <View style={[styles.header, { borderBottomColor: theme.colors.separator, borderBottomWidth: StyleSheet.hairlineWidth }]}>
            <Text style={[styles.title, { color: theme.colors.text, fontSize: theme.fontSize.lg }]}>
              Privacy Policy
            </Text>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn} hitSlop={8}>
              <View style={[styles.closeCircle, { backgroundColor: theme.colors.backgroundSecondary }]}>
                <Ionicons name="close" size={16} color={theme.colors.textMuted} />
              </View>
            </TouchableOpacity>
          </View>

          {/* Scrollable content */}
          <ScrollView
            style={styles.scroll}
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
          >
            <Text style={[styles.meta, { color: theme.colors.textMuted, fontSize: theme.fontSize.xs }]}>
              Last updated: {LAST_UPDATED}
            </Text>

            <Section title="1. Introduction" theme={theme}>
              Welcome to {APP_NAME}. We are committed to protecting your personal information and your right to privacy. This Privacy Policy explains how we collect, use, and share information about you when you use our application.
            </Section>

            <Section title="2. Information We Collect" theme={theme}>
              We collect information you provide directly to us, such as when you create an account, including your name, email address, and password. We may also collect usage data, device information, and other information you choose to provide.
            </Section>

            <Section title="3. How We Use Your Information" theme={theme}>
              We use the information we collect to operate and improve our services, communicate with you, process transactions, and send you technical notices and support messages. We do not sell your personal information to third parties.
            </Section>

            <Section title="4. Data Storage & Security" theme={theme}>
              Your data is stored securely using industry-standard encryption. We use Supabase for authentication and data storage, which applies best-in-class security practices. Despite our efforts, no security measures are perfect and we cannot guarantee absolute security.
            </Section>

            <Section title="5. Sharing of Information" theme={theme}>
              We do not share your personal information with third parties except as necessary to provide our services (e.g., cloud infrastructure providers), comply with the law, or protect the rights and safety of our users.
            </Section>

            <Section title="6. Data Retention" theme={theme}>
              We retain your personal information for as long as your account is active or as needed to provide our services. You may request deletion of your account and associated data at any time through the Settings screen.
            </Section>

            <Section title="7. Your Rights" theme={theme}>
              Depending on your location, you may have rights regarding your personal data, including the right to access, correct, or delete your data. To exercise these rights, please contact us using the information below.
            </Section>

            <Section title="8. Children's Privacy" theme={theme}>
              Our service is not directed to children under the age of 13. We do not knowingly collect personal information from children. If we become aware that a child has provided us with personal information, we will take steps to delete such information.
            </Section>

            <Section title="9. Changes to This Policy" theme={theme}>
              We may update this Privacy Policy from time to time. We will notify you of any changes by updating the "Last updated" date at the top of this policy. Your continued use of the app after changes constitutes acceptance of the updated policy.
            </Section>

            <Section title="10. Contact Us" theme={theme}>
              {'If you have any questions about this Privacy Policy, please contact us at:\n\nsupport@yourdomain.com\n\nReplace this with your actual support contact information.'}
            </Section>
          </ScrollView>

          {/* Footer close button */}
          <View style={[styles.footer, { borderTopColor: theme.colors.separator, borderTopWidth: StyleSheet.hairlineWidth }]}>
            <TouchableOpacity
              onPress={onClose}
              style={[styles.doneBtn, { backgroundColor: theme.colors.backgroundSecondary, borderRadius: theme.radius.md }]}
              activeOpacity={0.7}
            >
              <Text style={[styles.doneBtnText, { color: theme.colors.text, fontSize: theme.fontSize.md }]}>
                Close
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </LinearGradient>
    </Modal>
  );
}

function Section({ title, children, theme }: { title: string; children: string; theme: ReturnType<typeof useTheme>['theme'] }) {
  return (
    <View style={styles.section}>
      <Text style={[styles.sectionTitle, { color: theme.colors.text, fontSize: theme.fontSize.sm }]}>
        {title}
      </Text>
      <Text style={[styles.sectionBody, { color: theme.colors.textSecondary, fontSize: theme.fontSize.sm }]}>
        {children}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, justifyContent: 'flex-end', padding: 12, paddingBottom: 16 },
  sheet: { maxHeight: '92%', overflow: 'hidden' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  title: { fontWeight: '700' },
  closeBtn: { padding: 2 },
  closeCircle: {
    width: 28, height: 28, borderRadius: 14,
    alignItems: 'center', justifyContent: 'center',
  },
  scroll: { flexGrow: 0 },
  scrollContent: { paddingHorizontal: 20, paddingTop: 12, paddingBottom: 8 },
  meta: { marginBottom: 16, fontStyle: 'italic' },
  section: { marginBottom: 20 },
  sectionTitle: { fontWeight: '700', marginBottom: 6 },
  sectionBody: { lineHeight: 21 },
  footer: { paddingHorizontal: 20, paddingVertical: 14 },
  doneBtn: { paddingVertical: 13, alignItems: 'center' },
  doneBtnText: { fontWeight: '600' },
});
