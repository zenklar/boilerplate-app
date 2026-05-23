import { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  LayoutAnimation,
  Platform,
  UIManager,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../theme';

interface Props {
  onDeleteAccount?: () => void;
  onPrivacyPolicy?: () => void;
}

if (Platform.OS === 'android') {
  UIManager.setLayoutAnimationEnabledExperimental?.(true);
}

const FAQS = [
  {
    question: 'How do I get started?',
    answer:
      'Replace this with your actual FAQ content. Update FaqAccordion.tsx with questions relevant to your app.',
  },
  {
    question: 'How do I cancel my subscription?',
    answer:
      'Go to Settings → Manage Subscription to cancel at any time. Changes take effect at the end of your billing period.',
  },
  {
    question: 'How do I contact support?',
    answer:
      'Reach us at support@yourdomain.com — replace this with your actual support contact.',
  },
  {
    question: 'How do I delete my account?',
    answer:
      'Deleting your account is permanent and cannot be undone. All your data, including your profile and subscription, will be removed immediately.',
    action: 'delete' as const,
  },
  {
    question: 'Where can I find your Privacy Policy?',
    answer:
      'Our Privacy Policy explains how we collect, use, and protect your personal data.',
    action: 'privacy' as const,
  },
];

export default function FaqAccordion({ onDeleteAccount, onPrivacyPolicy }: Props) {
  const { theme } = useTheme();
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  function toggle(i: number) {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setOpenIndex(openIndex === i ? null : i);
  }

  return (
    <View>
      {FAQS.map((faq, i) => {
        const isOpen = openIndex === i;
        const isLast = i === FAQS.length - 1;
        return (
          <View
            key={i}
            style={
              !isLast
                ? {
                    borderBottomWidth: StyleSheet.hairlineWidth,
                    borderBottomColor: theme.colors.separator,
                  }
                : undefined
            }
          >
            <TouchableOpacity
              style={styles.question}
              onPress={() => toggle(i)}
              activeOpacity={0.7}
            >
              <Text
                style={[
                  styles.questionText,
                  { color: theme.colors.text, fontSize: theme.fontSize.md, flex: 1 },
                ]}
              >
                {faq.question}
              </Text>
              <Ionicons
                name={isOpen ? 'chevron-up' : 'chevron-down'}
                size={16}
                color={theme.colors.textMuted}
              />
            </TouchableOpacity>
            {isOpen && (
              <View>
                <Text
                  style={[
                    styles.answer,
                    { color: theme.colors.textSecondary, fontSize: theme.fontSize.sm },
                  ]}
                >
                  {faq.answer}
                </Text>
                {'action' in faq && faq.action === 'delete' && onDeleteAccount && (
                  <TouchableOpacity
                    style={[styles.actionBtnWrap, { borderRadius: theme.radius.md }]}
                    onPress={onDeleteAccount}
                    activeOpacity={0.8}
                  >
                    <LinearGradient
                      colors={theme.gradients.danger}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 0 }}
                      style={[styles.actionBtn, { borderRadius: theme.radius.md }]}
                    >
                      <Ionicons name="trash-outline" size={16} color="#fff" />
                      <Text style={styles.actionBtnText}>Delete My Account</Text>
                    </LinearGradient>
                  </TouchableOpacity>
                )}
                {'action' in faq && faq.action === 'privacy' && onPrivacyPolicy && (
                  <TouchableOpacity
                    style={[styles.actionBtnWrap, { borderRadius: theme.radius.md }]}
                    onPress={onPrivacyPolicy}
                    activeOpacity={0.8}
                  >
                    <LinearGradient
                      colors={theme.gradients.primary}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 0 }}
                      style={[styles.actionBtn, { borderRadius: theme.radius.md }]}
                    >
                      <Ionicons name="document-text-outline" size={16} color="#fff" />
                      <Text style={styles.actionBtnText}>Open Privacy Policy</Text>
                    </LinearGradient>
                  </TouchableOpacity>
                )}
              </View>
            )}
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  question: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    gap: 12,
  },
  questionText: { fontWeight: '500', lineHeight: 22 },
  answer: { paddingHorizontal: 16, paddingBottom: 12, lineHeight: 20 },
  actionBtnWrap: { overflow: 'hidden', marginHorizontal: 16, marginBottom: 16 },
  actionBtn: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 12, paddingHorizontal: 16, justifyContent: 'center' },
  actionBtnText: { color: '#fff', fontWeight: '700', fontSize: 14 },
});
