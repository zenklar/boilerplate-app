# Branding Customization Checklist

When starting a new project from this boilerplate, update the following files:

## App Identity

- [ ] `constants/social.ts` — Update `APP_NAME`, `APP_SLOGAN`, all `SOCIAL_URLS`, and `PRIVACY_POLICY_URL`
- [ ] `app.json` — Update `name`, `slug`, `scheme`, `ios.bundleIdentifier`, `android.package`
- [ ] `package.json` — Update `name`

## Assets

- [ ] `assets/icon.png` — App icon (1024x1024 PNG)
- [ ] `assets/adaptive-icon.png` — Android adaptive icon foreground (1024x1024 PNG)
- [ ] `assets/favicon.png` — Web favicon (196x196 PNG)
- [ ] `assets/splash-icon.png` — Splash screen logo

## Colors & Theme

- [ ] `theme/index.ts` — Update `lightColors.primary` and `darkColors.primary` to your brand color
- [ ] `theme/index.ts` — Update `lightGradients.primary` and `darkGradients.primary` to match your brand (default is `['#1A8FFF', '#0055CC']`)
- [ ] `theme/index.ts` — Update `lightGradients.avatar` / `darkGradients.avatar` for profile/logo circles (default is `['#5AC8FA', '<primaryColor>']`)
- [ ] `app.json` — Update `android.adaptiveIcon.backgroundColor` to match your brand

## Authentication

- [ ] `app/(auth)/login.tsx` — Update redirect scheme if you changed `app.json` scheme
- [ ] `app/(auth)/signup.tsx` — Update redirect scheme if you changed `app.json` scheme
- [ ] Supabase dashboard — Add your new app's redirect URL under Authentication > URL Configuration

## Content

- [ ] `components/settings/FaqAccordion.tsx` — Replace placeholder FAQ items with real questions
- [ ] `app/(app)/home.tsx` — Replace placeholder card content with your app's main feature
- [ ] `components/modals/DeleteAccountModal.tsx` — Wire up `supabase.functions.invoke('delete-account')` edge function

## Legal

- [ ] `constants/social.ts` — Set `PRIVACY_POLICY_URL` to your real privacy policy URL
- [ ] Supabase SQL — Customize the `profiles` table if you need additional fields

## Environment

- [ ] `.env` — Fill in `EXPO_PUBLIC_SUPABASE_URL` and `EXPO_PUBLIC_SUPABASE_ANON_KEY`
- [ ] Supabase — Enable the OAuth providers you need (Google, Facebook, Apple)

---

## Visual Style Guide

This app follows an Apple-inspired design language. Apply these rules consistently when building new screens and components.

### Core Principles

- **Layered backgrounds**: Screen backgrounds use `theme.colors.background` (`#F2F2F7` light / `#000000` dark). Cards and surfaces use `theme.colors.card` (`#FFFFFF` light / `#1C1C1E` dark). This creates natural depth without heavy shadows.
- **Restrained color**: Default to grays (`textMuted`, `backgroundSecondary`, `separator`). Reserve `primary` blue for interactive elements only.
- **Rounded, not bubbly**: Use `theme.radius.md` (10) for buttons and inputs, `theme.radius.lg` (14) for cards, `theme.radius.xl` (20) for modals/sheets.

### Gradients

Always use gradients from `theme.gradients` (powered by `expo-linear-gradient`). Never hardcode gradient colors.

| Gradient | Usage |
|---|---|
| `theme.gradients.primary` | All primary CTA buttons (horizontal, left→right) |
| `theme.gradients.avatar` | Profile/avatar circles, logo circles (diagonal) |
| `theme.gradients.danger` | Destructive action buttons (horizontal, left→right) |
| `theme.gradients.card` | Optional: subtle card backgrounds (vertical, top→bottom) |
| `theme.gradients.header` | App header / navigation bars (vertical, top→bottom) |
| `theme.gradients.tabBar` | Bottom tab bar (vertical, top→bottom) |

**Button pattern** — always wrap `LinearGradient` inside `TouchableOpacity` with `overflow: 'hidden'`:

```tsx
<TouchableOpacity
  style={[{ borderRadius: theme.radius.md, overflow: 'hidden', opacity: disabled ? 0.7 : 1 }]}
  onPress={onPress}
  activeOpacity={0.85}
>
  <LinearGradient
    colors={theme.gradients.primary}
    start={{ x: 0, y: 0 }}
    end={{ x: 1, y: 0 }}
    style={{ paddingVertical: 14, alignItems: 'center', borderRadius: theme.radius.md }}
  >
    <Text style={{ color: theme.colors.primaryText, fontWeight: '600', fontSize: theme.fontSize.md }}>
      Label
    </Text>
  </LinearGradient>
</TouchableOpacity>
```

**Avatar/icon circle pattern** — diagonal gradient:

```tsx
<LinearGradient
  colors={theme.gradients.avatar}
  start={{ x: 0, y: 0 }}
  end={{ x: 1, y: 1 }}
  style={{ width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center' }}
>
  <Text style={{ color: '#FFFFFF', fontWeight: '700' }}>JK</Text>
</LinearGradient>
```

### Cards & Sections

Use `SettingsSection` for all grouped list content — it already applies the correct card background, border, border-radius, and shadow.

For standalone cards, apply:
```tsx
{
  backgroundColor: theme.colors.card,
  borderRadius: theme.radius.lg,
  borderWidth: StyleSheet.hairlineWidth,
  borderColor: theme.colors.cardBorder,
  // light mode shadow:
  ...(theme.mode === 'light' ? {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.07,
    shadowRadius: 4,
    elevation: 2,
  } : {}),
}
```

### Typography

| Role | Size token | Weight |
|---|---|---|
| Large title | `theme.fontSize.xxl` (24) | `700` |
| Section heading | `theme.fontSize.xl` (20) | `700` |
| Body / row label | `theme.fontSize.md` (15) | `400` |
| Button label | `theme.fontSize.md` (15) | `600` |
| Caption / section title | `theme.fontSize.xs` (11) | `600`, `letterSpacing: 0.5`, UPPERCASE |
| Muted value / secondary | `theme.fontSize.sm` (13) | `400`, color: `textMuted` |

### Spacing

Always use `theme.spacing.*` tokens: `xs` (4), `sm` (8), `md` (16), `lg` (24), `xl` (32), `xxl` (48).

Standard screen padding: `paddingHorizontal: theme.spacing.md` (16).

### Light vs Dark Mode

- Never hardcode `'#FFFFFF'` or `'#000000'` for background/text — always use theme tokens.
- The one exception is button text on gradient backgrounds: use `theme.colors.primaryText` (`#FFFFFF`) or hardcode `'#FFFFFF'` only when the background is a non-theme gradient (e.g. Facebook blue, Apple black).
- In dark mode, inputs use `inputBackground: '#2C2C2E'` — elevated above the `#1C1C1E` surface.
- Danger gradients adapt automatically: `#FF5C52→#FF3B30` (light) / `#FF6058→#FF453A` (dark).
