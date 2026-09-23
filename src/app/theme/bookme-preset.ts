import { definePreset } from '@primeuix/themes';
import Aura from '@primeuix/themes/aura';

// Aura's default dark feedback uses saturated 500 text; use lighter text on its tinted surfaces.
const feedback = {
  error: { color: '{red.300}' },
  info: { color: '{blue.300}' },
  warn: { color: '{yellow.300}' },
  success: { color: '{green.300}' },
};

/** One explicit dark theme, including overlays mounted outside the shell. */
export const BookMePreset = definePreset(Aura, {
  semantic: {
    focusRing: { width: '3px', offset: '3px' },
    primary: {
      color: 'var(--bm-accent)',
      contrastColor: 'var(--bm-bg)',
      hoverColor: 'var(--bm-accent-hover)',
      activeColor: 'var(--bm-accent-active)',
    },
    surface: {
      400: 'var(--bm-muted)',
      500: 'var(--bm-input-border)',
      600: 'var(--bm-input-border)',
      700: 'var(--bm-border)',
      800: 'var(--bm-raised)',
      900: 'var(--bm-panel)',
      950: 'var(--bm-bg)',
    },
    text: {
      color: 'var(--bm-text)',
      hoverColor: 'var(--bm-text)',
      mutedColor: 'var(--bm-muted)',
      hoverMutedColor: 'var(--bm-text)',
    },
    highlight: {
      background: 'var(--bm-accent)',
      focusBackground: 'var(--bm-accent-hover)',
      color: 'var(--bm-bg)',
      focusColor: 'var(--bm-bg)',
    },
    formField: {
      color: 'var(--bm-text)',
      hoverBorderColor: 'var(--bm-text)',
      focusRing: { width: '3px', style: 'solid', color: '{primary.color}', offset: '3px' },
    },
  },
  components: {
    message: feedback,
    toast: feedback,
    button: {
      root: {
        borderRadius: '0.5rem',
        secondary: {
          borderColor: 'var(--bm-input-border)',
          hoverBorderColor: 'var(--bm-text)',
          activeBackground: 'var(--bm-border)',
        },
      },
      outlined: {
        primary: { borderColor: 'var(--bm-accent)' },
        secondary: { borderColor: 'var(--bm-input-border)' },
        danger: { borderColor: '{red.400}' },
      },
    },
    togglebutton: {
      root: {
        borderColor: 'var(--bm-input-border)',
        checkedBorderColor: 'var(--bm-accent)',
        checkedColor: 'var(--bm-bg)',
      },
      content: { checkedBackground: 'var(--bm-accent)' },
    },
  },
});
