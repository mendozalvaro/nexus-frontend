export type AppTheme = "light" | "dark" | "system";

const STORAGE_KEY = "nexuspos-theme";

/**
 * Sincroniza el tema local con Nuxt Color Mode y persistencia en localStorage.
 */
export const useTheme = () => {
  const colorMode = useColorMode();
  const theme = useState<AppTheme>("app:theme", () => {
    const preference = colorMode.preference;
    return preference === "light" || preference === "dark" ? preference : "system";
  });

  const resolvedTheme = computed<Exclude<AppTheme, "system">>(() => {
    return colorMode.value === "dark" ? "dark" : "light";
  });

  const applyTheme = (value: AppTheme) => {
    theme.value = value;
    colorMode.preference = value;

    if (import.meta.client) {
      window.localStorage.setItem(STORAGE_KEY, value);
    }
  };

  /**
   * Alterna entre tema claro y oscuro.
   */
  const toggle = () => {
    applyTheme(resolvedTheme.value === "dark" ? "light" : "dark");
  };

  /**
   * Establece el tema explicitamente.
   */
  const setTheme = (value: AppTheme) => {
    applyTheme(value);
  };

  /**
   * Obtiene la preferencia actual persistida.
   */
  const getTheme = () => theme.value;

  if (import.meta.client) {
    onMounted(() => {
      const stored = window.localStorage.getItem(STORAGE_KEY);

      if (stored === "light" || stored === "dark" || stored === "system") {
        applyTheme(stored);
        return;
      }

      window.localStorage.setItem(STORAGE_KEY, theme.value);
    });
  }

  return {
    theme: readonly(theme),
    resolvedTheme,
    toggle,
    setTheme,
    getTheme,
  };
};
