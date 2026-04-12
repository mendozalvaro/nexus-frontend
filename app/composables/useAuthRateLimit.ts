interface AuthRateLimitSnapshot {
  attempts: number;
  lockedUntil: number | null;
}

interface AuthRateLimitOptions {
  warningThreshold?: number;
  maxAttempts?: number;
  lockoutMinutes?: number;
  storageKey?: string;
}

const DEFAULT_WARNING_THRESHOLD = 3;
const DEFAULT_MAX_ATTEMPTS = 5;
const DEFAULT_LOCKOUT_MINUTES = 15;
const DEFAULT_STORAGE_KEY = "nexuspos:auth:rate-limit";

const createInitialSnapshot = (): AuthRateLimitSnapshot => ({
  attempts: 0,
  lockedUntil: null,
});

const isSnapshot = (value: unknown): value is AuthRateLimitSnapshot => {
  if (!value || typeof value !== "object") {
    return false;
  }

  const candidate = value as Record<string, unknown>;
  const attempts = candidate.attempts;
  const lockedUntil = candidate.lockedUntil;

  return typeof attempts === "number" && (typeof lockedUntil === "number" || lockedUntil === null);
};

export const useAuthRateLimit = (options: AuthRateLimitOptions = {}) => {
  const warningThreshold = options.warningThreshold ?? DEFAULT_WARNING_THRESHOLD;
  const maxAttempts = options.maxAttempts ?? DEFAULT_MAX_ATTEMPTS;
  const lockoutMinutes = options.lockoutMinutes ?? DEFAULT_LOCKOUT_MINUTES;
  const storageKey = options.storageKey ?? DEFAULT_STORAGE_KEY;

  const snapshot = useState<AuthRateLimitSnapshot>("auth:rate-limit:snapshot", createInitialSnapshot);
  const now = ref(Date.now());
  let timer: ReturnType<typeof setInterval> | null = null;

  const persistSnapshot = () => {
    if (!import.meta.client) {
      return;
    }

    localStorage.setItem(storageKey, JSON.stringify(snapshot.value));
  };

  const clearStorage = () => {
    if (!import.meta.client) {
      return;
    }

    localStorage.removeItem(storageKey);
  };

  const syncClock = () => {
    now.value = Date.now();

    if (snapshot.value.lockedUntil && snapshot.value.lockedUntil <= now.value) {
      snapshot.value = createInitialSnapshot();
      clearStorage();
    }
  };

  const startTimer = () => {
    if (!import.meta.client || timer) {
      return;
    }

    timer = setInterval(syncClock, 1000);
  };

  const stopTimer = () => {
    if (!timer) {
      return;
    }

    clearInterval(timer);
    timer = null;
  };

  const hydrateSnapshot = () => {
    if (!import.meta.client) {
      return;
    }

    try {
      const rawValue = localStorage.getItem(storageKey);
      if (!rawValue) {
        snapshot.value = createInitialSnapshot();
        return;
      }

      const parsed = JSON.parse(rawValue) as unknown;
      snapshot.value = isSnapshot(parsed) ? parsed : createInitialSnapshot();
      syncClock();
    } catch {
      snapshot.value = createInitialSnapshot();
      clearStorage();
    }
  };

  const isRateLimited = computed(() => {
    return Boolean(snapshot.value.lockedUntil && snapshot.value.lockedUntil > now.value);
  });

  const attemptCount = computed(() => snapshot.value.attempts);
  const remainingAttempts = computed(() => Math.max(maxAttempts - snapshot.value.attempts, 0));
  const remainingSeconds = computed(() => {
    if (!snapshot.value.lockedUntil) {
      return 0;
    }

    return Math.max(Math.ceil((snapshot.value.lockedUntil - now.value) / 1000), 0);
  });

  const shouldShowWarning = computed(() => snapshot.value.attempts >= warningThreshold);
  const shouldShowCaptchaPlaceholder = computed(() => snapshot.value.attempts >= warningThreshold);

  const warningMessage = computed(() => {
    if (!shouldShowWarning.value || isRateLimited.value) {
      return null;
    }

    return `Llevas ${snapshot.value.attempts} intento(s) fallidos. Tras ${maxAttempts} intentos, bloquearemos temporalmente este acceso.`;
  });

  const rateLimitMessage = computed(() => {
    if (!isRateLimited.value) {
      return null;
    }

    return `Demasiados intentos fallidos. Espera ${remainingSeconds.value} segundos antes de intentar de nuevo.`;
  });

  /**
   * Registra un intento fallido y aplica bloqueo temporal cuando se supera el umbral.
   */
  const registerFailure = () => {
    syncClock();

    if (isRateLimited.value) {
      return;
    }

    const nextAttempts = snapshot.value.attempts + 1;
    const shouldLock = nextAttempts >= maxAttempts;

    snapshot.value = {
      attempts: nextAttempts,
      lockedUntil: shouldLock ? Date.now() + lockoutMinutes * 60 * 1000 : null,
    };

    persistSnapshot();
  };

  /**
   * Reinicia el estado de intentos cuando el login fue exitoso o se limpia el formulario.
   */
  const reset = () => {
    snapshot.value = createInitialSnapshot();
    clearStorage();
  };

  if (import.meta.client) {
    onMounted(() => {
      hydrateSnapshot();
      startTimer();
    });

    onBeforeUnmount(() => {
      stopTimer();
    });
  }

  return {
    attemptCount,
    isRateLimited,
    remainingAttempts,
    remainingSeconds,
    shouldShowWarning,
    shouldShowCaptchaPlaceholder,
    warningMessage,
    rateLimitMessage,
    hydrateSnapshot,
    registerFailure,
    reset,
  };
};
