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
  variant?: 'general' | 'games';
  onDeleteAccount?: () => void;
  onPrivacyPolicy?: () => void;
  onGoToShop?: () => void;
}

const isFabric = !!(globalThis as any).nativeFabricUIManager;

if (Platform.OS === 'android' && !isFabric) {
  UIManager.setLayoutAnimationEnabledExperimental?.(true);
}

const GENERAL_FAQS = [
  {
    question: 'How do I cancel my Arcade Pass subscription?',
    answer:
      'You can cancel your Arcade Pass at any time from the Shop page. Tap the button below to go there — your access continues until the end of the current billing period.',
    action: 'shop' as const,
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

const GAME_FAQS = [
  {
    question: 'How do I play Asteroids?',
    answer:
      'Destroy incoming asteroids and enemy saucers before they destroy you. Each asteroid splits into smaller, faster fragments — clear them all to advance a level.\n\nControls (mobile): Touch joystick to steer. HOLD MOVE to thrust. HOLD FIRE to shoot.\n\nControls (web): Mouse aim. Hold LMB thrust. Space fire. Arrow keys/WASD steer.',
  },
  {
    question: 'How do I play Pong?',
    answer:
      'Face off against a CPU opponent in a best-of-5 match. Score goals by getting the ball past the CPU\'s paddle. First to win 3 rounds wins the match.\n\nControls (mobile): Touch + drag to move paddle. Double tap to BOOST.\n\nControls (web): Move mouse to control paddle. Click/Shift/W to BOOST.',
  },
  {
    question: 'How do I play Snake?',
    answer:
      'Guide your snake to eat the food pellets and grow as long as possible without running into yourself. The snake wraps around walls Nokia-style and speeds up with each level.\n\nControls (mobile): Tap the on-screen arrows to steer.\n\nControls (web): Arrow keys or WASD to steer.',
  },
  {
    question: 'How do I play Tetris?',
    answer:
      'Stack the falling tetrominoes to complete full horizontal lines, which then clear and score points. The game ends when pieces stack to the top.\n\nControls (mobile): Touch controls: ◀ ▶ move. ⟳ rotate. ▼ soft drop. DOWN hard drop.\n\nControls (web): Mouse move. Click rotate. Arrow keys/WASD move. ↓ soft drop. Space hard drop.',
  },
];

export default function FaqAccordion({ variant = 'general', onDeleteAccount, onPrivacyPolicy, onGoToShop }: Props) {
  const { theme } = useTheme();
  const [openIndex, setOpenIndex] = useState<number | null>(null);
  const faqs = variant === 'games' ? GAME_FAQS : GENERAL_FAQS;

  function toggle(i: number) {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setOpenIndex(openIndex === i ? null : i);
  }

  return (
    <View>
      {faqs.map((faq, i) => {
        const isOpen = openIndex === i;
        const isLast = i === faqs.length - 1;
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
                {'action' in faq && faq.action === 'shop' && onGoToShop && (
                  <TouchableOpacity
                    style={[styles.actionBtnWrap, { borderRadius: theme.radius.md }]}
                    onPress={onGoToShop}
                    activeOpacity={0.8}
                  >
                    <LinearGradient
                      colors={theme.gradients.primary}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 0 }}
                      style={[styles.actionBtn, { borderRadius: theme.radius.md }]}
                    >
                      <Ionicons name="storefront-outline" size={16} color="#fff" />
                      <Text style={styles.actionBtnText}>Manage Arcade Pass</Text>
                    </LinearGradient>
                  </TouchableOpacity>
                )}
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
