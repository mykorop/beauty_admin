import { definePreset } from '@primeuix/themes';
import Aura from '@primeuix/themes/aura';

// Aura's default dark feedback uses saturated 500 text; use lighter text on its tinted surfaces.
const feedback = {
  error: { color: 'light-dark({red.600}, {red.300})' },
  info: { color: 'light-dark({blue.600}, {blue.300})' },
  warn: { color: 'light-dark({yellow.600}, {yellow.300})' },
  success: { color: 'light-dark({green.600}, {green.300})' },
};

/** Keep Aura's light values during the staged migration (remove with ticket 05).
 * Dark values also reach body-mounted overlays through the document's route scope.
 */
export const BookMePreset = definePreset(Aura, {
  semantic: {
    focusRing: { width: '3px', offset: '3px' },
    primary: {
      color: 'light-dark({emerald.500}, var(--bm-accent))',
      contrastColor: 'light-dark(#ffffff, var(--bm-bg))',
      hoverColor: 'light-dark({emerald.600}, var(--bm-accent-hover))',
      activeColor: 'light-dark({emerald.700}, var(--bm-accent-active))',
    },
    surface: {
      400: 'light-dark({slate.400}, var(--bm-muted))',
      500: 'light-dark({slate.500}, var(--bm-input-border))',
      600: 'light-dark({slate.600}, var(--bm-input-border))',
      700: 'light-dark({slate.700}, var(--bm-border))',
      800: 'light-dark({slate.800}, var(--bm-raised))',
      900: 'light-dark({slate.900}, var(--bm-panel))',
      950: 'light-dark({slate.950}, var(--bm-bg))',
    },
    text: {
      color: 'light-dark({surface.700}, var(--bm-text))',
      hoverColor: 'light-dark({surface.800}, var(--bm-text))',
      mutedColor: 'light-dark({surface.500}, var(--bm-muted))',
      hoverMutedColor: 'light-dark({surface.600}, var(--bm-text))',
    },
    highlight: {
      background: 'light-dark({primary.50}, var(--bm-accent))',
      focusBackground: 'light-dark({primary.100}, var(--bm-accent-hover))',
      color: 'light-dark({primary.700}, var(--bm-bg))',
      focusColor: 'light-dark({primary.800}, var(--bm-bg))',
    },
    formField: {
      color: 'light-dark({surface.700}, var(--bm-text))',
      hoverBorderColor: 'light-dark({surface.400}, var(--bm-text))',
      focusRing: { width: '3px', style: 'solid', color: '{primary.color}', offset: '3px' },
    },
  },
  components: {
    message: feedback,
    toast: feedback,
    button: {
      root: {
        secondary: {
          borderColor: 'light-dark({surface.100}, var(--bm-input-border))',
          hoverBorderColor: 'light-dark({surface.200}, var(--bm-text))',
          activeBackground: 'light-dark({surface.300}, var(--bm-border))',
        },
      },
    },
    togglebutton: {
      root: {
        borderColor: 'light-dark({surface.100}, var(--bm-input-border))',
        checkedBorderColor: 'light-dark({surface.100}, var(--bm-accent))',
        checkedColor: 'light-dark({surface.900}, var(--bm-bg))',
      },
      content: { checkedBackground: 'light-dark({surface.0}, var(--bm-accent))' },
    },
  },
});
