<script setup lang="ts">
import { z } from "zod";

const props = withDefaults(defineProps<{
  open: boolean;
  slug: string;
  primaryColor: string;
  businessName: string;
}>(), {
  open: false,
});

const emit = defineEmits<{
  close: [];
  "login-success": [];
}>();

type ActiveTab = "login" | "register";

const { signInWithEmail, signInWithProvider, registerClient, isLoading, error: storefrontError, successMessage } = useStorefrontAuth();
const { user } = useAuth();

const activeTab = ref<ActiveTab>("login");
const loginEmail = ref("");
const loginPassword = ref("");
const registerName = ref("");
const registerEmail = ref("");
const registerPassword = ref("");
const localError = ref<string | null>(null);
const showPassword = ref(false);

const isLoggedIn = computed(() => !!user.value);

const loginSchema = z.object({
  email: z.string().email("Ingresa un email valido"),
  password: z.string().min(8, "La contrasena debe tener al menos 8 caracteres"),
});

const registerSchema = z.object({
  name: z.string().min(2, "El nombre debe tener al menos 2 caracteres"),
  email: z.string().email("Ingresa un email valido"),
  password: z.string().min(8, "La contrasena debe tener al menos 8 caracteres"),
});

const errorMessage = computed(() => localError.value || storefrontError.value);

const switchTab = (tab: ActiveTab) => {
  activeTab.value = tab;
  localError.value = null;
  loginEmail.value = "";
  loginPassword.value = "";
  registerName.value = "";
  registerEmail.value = "";
  registerPassword.value = "";
  showPassword.value = false;
};

const handleLogin = async () => {
  localError.value = null;
  const parsed = loginSchema.safeParse({ email: loginEmail.value, password: loginPassword.value });
  if (!parsed.success) {
    localError.value = parsed.error.issues[0]?.message ?? "Datos invalidos";
    return;
  }
  const result = await signInWithEmail(parsed.data.email, parsed.data.password);
  if (!result.success) {
    localError.value = result.error ?? null;
    return;
  }
  emit("login-success");
};

const handleOAuth = async (provider: "google") => {
  await signInWithProvider(provider, props.slug);
};

const handleRegister = async () => {
  localError.value = null;
  const parsed = registerSchema.safeParse({
    name: registerName.value,
    email: registerEmail.value,
    password: registerPassword.value,
  });
  if (!parsed.success) {
    localError.value = parsed.error.issues[0]?.message ?? "Datos invalidos";
    return;
  }
  const result = await registerClient(parsed.data.name, parsed.data.email, parsed.data.password, props.slug);
  if (!result.success) {
    localError.value = result.error ?? null;
  }
};

watchEffect(() => {
  if (isLoggedIn.value) {
    emit("login-success");
  }
});

watchEffect(() => {
  if (props.open) {
    localError.value = null;
    loginEmail.value = "";
    loginPassword.value = "";
    registerName.value = "";
    registerEmail.value = "";
    registerPassword.value = "";
    showPassword.value = false;
    activeTab.value = "login";
  }
});

const handleClose = () => {
  emit("close");
};

const handleOverlayClick = () => {
  handleClose();
};

const handleEscape = (e: KeyboardEvent) => {
  if (e.key === "Escape") handleClose();
};

onMounted(() => {
  window.addEventListener("keydown", handleEscape);
});

onBeforeUnmount(() => {
  window.removeEventListener("keydown", handleEscape);
});
</script>

<template>
  <Teleport to="body">
    <div
      v-if="open"
      class="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 px-4 backdrop-blur-sm"
      @click.self="handleOverlayClick"
    >
      <div class="w-full max-w-sm overflow-hidden rounded-2xl bg-white shadow-xl">
        <div class="flex items-center justify-between border-b border-slate-200 px-5 py-4">
          <h3 class="text-sm font-semibold text-slate-900">{{ businessName }}</h3>
          <button
            class="rounded-lg p-1 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600"
            @click="handleClose"
          >
            <UIcon name="i-lucide-x" class="h-4 w-4" />
          </button>
        </div>

        <div class="flex border-b border-slate-200">
          <button
            class="flex-1 py-3 text-sm font-medium transition-colors"
            :class="activeTab === 'login' ? 'border-b-2 text-slate-900' : 'text-slate-500 hover:text-slate-700'"
            :style="activeTab === 'login' ? { borderColor: primaryColor } : {}"
            @click="switchTab('login')"
          >
            Iniciar sesion
          </button>
          <button
            class="flex-1 py-3 text-sm font-medium transition-colors"
            :class="activeTab === 'register' ? 'border-b-2 text-slate-900' : 'text-slate-500 hover:text-slate-700'"
            :style="activeTab === 'register' ? { borderColor: primaryColor } : {}"
            @click="switchTab('register')"
          >
            Crear cuenta
          </button>
        </div>

        <div class="space-y-4 px-5 py-5">
          <UAlert
            v-if="errorMessage"
            color="error"
            variant="soft"
            icon="i-lucide-octagon-alert"
            :title="errorMessage"
          />

          <UAlert
            v-if="successMessage"
            color="success"
            variant="soft"
            icon="i-lucide-badge-check"
            :title="successMessage"
          />

          <template v-if="activeTab === 'login'">
            <UInput
              v-model="loginEmail"
              type="email"
              size="lg"
              autocomplete="email"
              placeholder="tu@email.com"
              icon="i-lucide-mail"
              class="w-full"
              :disabled="isLoading"
            />

            <UInput
              v-model="loginPassword"
              :type="showPassword ? 'text' : 'password'"
              size="lg"
              autocomplete="current-password"
              placeholder="Tu contrasena"
              icon="i-lucide-lock-keyhole"
              class="w-full"
              :disabled="isLoading"
            >
              <template #trailing>
                <UButton
                  color="neutral"
                  variant="ghost"
                  size="sm"
                  :icon="showPassword ? 'i-lucide-eye-off' : 'i-lucide-eye'"
                  :aria-label="showPassword ? 'Ocultar contrasena' : 'Mostrar contrasena'"
                  @click="showPassword = !showPassword"
                />
              </template>
            </UInput>

            <NuxtLink
              to="/auth/reset-password"
              class="block text-right text-xs font-medium text-primary-700 hover:text-primary-600"
            >
              Olvidaste tu contrasena?
            </NuxtLink>

            <UButton
              block
              size="lg"
              :loading="isLoading"
              :disabled="isLoading"
              @click="handleLogin"
            >
              Iniciar sesion
            </UButton>

            <div class="flex items-center gap-3 py-1">
              <div class="h-px flex-1 bg-slate-200" />
              <span class="text-xs font-medium text-slate-400">O</span>
              <div class="h-px flex-1 bg-slate-200" />
            </div>

            <div class="grid gap-3">
              <UButton
                color="neutral"
                variant="soft"
                size="lg"
                icon="i-lucide-chrome"
                block
                :disabled="isLoading"
                @click="handleOAuth('google')"
              >
                Continuar con Google
              </UButton>
            </div>
          </template>

          <template v-if="activeTab === 'register'">
            <UInput
              v-model="registerName"
              type="text"
              size="lg"
              autocomplete="name"
              placeholder="Tu nombre completo"
              icon="i-lucide-user"
              class="w-full"
              :disabled="isLoading"
            />

            <UInput
              v-model="registerEmail"
              type="email"
              size="lg"
              autocomplete="email"
              placeholder="tu@email.com"
              icon="i-lucide-mail"
              class="w-full"
              :disabled="isLoading"
            />

            <UInput
              v-model="registerPassword"
              :type="showPassword ? 'text' : 'password'"
              size="lg"
              autocomplete="new-password"
              placeholder="Crea una contrasena"
              icon="i-lucide-lock-keyhole"
              class="w-full"
              :disabled="isLoading"
            >
              <template #trailing>
                <UButton
                  color="neutral"
                  variant="ghost"
                  size="sm"
                  :icon="showPassword ? 'i-lucide-eye-off' : 'i-lucide-eye'"
                  :aria-label="showPassword ? 'Ocultar contrasena' : 'Mostrar contrasena'"
                  @click="showPassword = !showPassword"
                />
              </template>
            </UInput>

            <UButton
              block
              size="lg"
              :loading="isLoading"
              :disabled="isLoading"
              @click="handleRegister"
            >
              Crear cuenta
            </UButton>
          </template>
        </div>
      </div>
    </div>
  </Teleport>
</template>
