<script setup lang="ts">
import { computed, onMounted, reactive, ref, watch } from "vue";

import type {
  RoleModulePermissionRow,
  SystemPlanFormInput,
  SystemPlanRow,
  SystemRoleWithPermissions,
} from "@/composables/useSystemAdmin";

definePageMeta({
  middleware: ["system-only"],
  title: "System Access",
});

const {
  plans,
  plansLoading,
  roles,
  rolesLoading,
  actionLoading,
  error,
  loadPlans,
  loadRoles,
  createPlan,
  updatePlan,
  updateRole,
  updateRolePermissions,
  getDefaultPlanForm,
} = useSystemAdmin();

const MODULE_KEYS = [
  "dashboard",
  "pos",
  "catalog",
  "inventory",
  "service_assignment",
  "appointments",
  "users",
  "branches",
  "reports",
  "settings",
  "billing",
  "profile",
] as const;

type LimitValueType = "number" | "boolean";

interface EditableRolePermission {
  moduleKey: string;
  canView: boolean;
  canCreate: boolean;
  canEdit: boolean;
  canDelete: boolean;
  canExport: boolean;
  canManage: boolean;
  canApprove: boolean;
  canAssign: boolean;
}

interface FeatureEntry {
  value: string;
}

interface PermissionEntry {
  key: string;
  enabled: boolean;
}

interface LimitEntry {
  key: string;
  valueType: LimitValueType;
  numberValue: number;
  booleanValue: boolean;
}

interface BillingModeEntry {
  key: string;
  label: string;
  enabled: boolean;
  discountPercent: number;
}

type PlanPresetKey = "starter" | "growth" | "enterprise";
type RoleModuleFilter = "all" | "with_access" | "without_access";

interface PlanPreset {
  key: PlanPresetKey;
  label: string;
  description: string;
  maxUsers: number;
  maxBranches: number;
  trial: boolean;
  trialDuration: number | null;
  features: FeatureEntry[];
  permissions: PermissionEntry[];
  limits: LimitEntry[];
}

const PLAN_PRESETS: Record<PlanPresetKey, PlanPreset> = {
  starter: {
    key: "starter",
    label: "Emprende",
    description: "Catalogo y operacion base con limites bajos.",
    maxUsers: 3,
    maxBranches: 1,
    trial: true,
    trialDuration: 14,
    features: [
      { value: "catalog.products" },
      { value: "catalog.services" },
      { value: "pos.sales" },
      { value: "reports.cashier" },
    ],
    permissions: [
      { key: "dashboard", enabled: true },
      { key: "catalog", enabled: true },
      { key: "pos", enabled: true },
      { key: "reports", enabled: true },
      { key: "users", enabled: true },
      { key: "inventory", enabled: false },
      { key: "appointments", enabled: false },
      { key: "branches", enabled: false },
      { key: "settings", enabled: true },
    ],
    limits: [
      { key: "products", valueType: "number", numberValue: 120, booleanValue: false },
      { key: "services", valueType: "number", numberValue: 20, booleanValue: false },
      { key: "users", valueType: "number", numberValue: 3, booleanValue: false },
      { key: "roles.manager", valueType: "number", numberValue: 1, booleanValue: false },
      { key: "roles.employee", valueType: "number", numberValue: 2, booleanValue: false },
      { key: "branches", valueType: "number", numberValue: 1, booleanValue: false },
    ],
  },
  growth: {
    key: "growth",
    label: "Crecimiento",
    description: "Incluye inventario y mas capacidad operativa.",
    maxUsers: 12,
    maxBranches: 3,
    trial: true,
    trialDuration: 21,
    features: [
      { value: "catalog.products" },
      { value: "catalog.services" },
      { value: "inventory.movements" },
      { value: "pos.sales" },
      { value: "reports.advanced" },
    ],
    permissions: [
      { key: "dashboard", enabled: true },
      { key: "catalog", enabled: true },
      { key: "pos", enabled: true },
      { key: "reports", enabled: true },
      { key: "users", enabled: true },
      { key: "inventory", enabled: true },
      { key: "appointments", enabled: true },
      { key: "branches", enabled: true },
      { key: "settings", enabled: true },
    ],
    limits: [
      { key: "products", valueType: "number", numberValue: 1200, booleanValue: false },
      { key: "services", valueType: "number", numberValue: 120, booleanValue: false },
      { key: "users", valueType: "number", numberValue: 12, booleanValue: false },
      { key: "roles.manager", valueType: "number", numberValue: 3, booleanValue: false },
      { key: "roles.employee", valueType: "number", numberValue: 9, booleanValue: false },
      { key: "branches", valueType: "number", numberValue: 3, booleanValue: false },
    ],
  },
  enterprise: {
    key: "enterprise",
    label: "Empresarial",
    description: "Operacion completa multi-sucursal y alta capacidad.",
    maxUsers: 100,
    maxBranches: 25,
    trial: false,
    trialDuration: null,
    features: [
      { value: "catalog.products" },
      { value: "catalog.services" },
      { value: "inventory.movements" },
      { value: "appointments.advanced" },
      { value: "reports.advanced" },
      { value: "branches.multi" },
    ],
    permissions: [
      { key: "dashboard", enabled: true },
      { key: "catalog", enabled: true },
      { key: "pos", enabled: true },
      { key: "reports", enabled: true },
      { key: "users", enabled: true },
      { key: "inventory", enabled: true },
      { key: "appointments", enabled: true },
      { key: "branches", enabled: true },
      { key: "settings", enabled: true },
      { key: "billing", enabled: true },
    ],
    limits: [
      { key: "products", valueType: "number", numberValue: 50000, booleanValue: false },
      { key: "services", valueType: "number", numberValue: 5000, booleanValue: false },
      { key: "users", valueType: "number", numberValue: 100, booleanValue: false },
      { key: "roles.manager", valueType: "number", numberValue: 20, booleanValue: false },
      { key: "roles.employee", valueType: "number", numberValue: 80, booleanValue: false },
      { key: "branches", valueType: "number", numberValue: 25, booleanValue: false },
    ],
  },
};

const selectedPlanId = ref<string | null>(null);
const selectedRoleId = ref<string | null>(null);
const planFormError = ref<string | null>(null);
const roleFormError = ref<string | null>(null);
const rolePermissionsError = ref<string | null>(null);
const selectedPlanPresetKey = ref<PlanPresetKey | "">("");
const newPlanPresetKey = ref<PlanPresetKey | "">("");
const roleModuleQuery = ref("");
const roleModuleFilter = ref<RoleModuleFilter>("all");

const isCreatePlanModalOpen = ref(false);
const newPlan = reactive<SystemPlanFormInput>(getDefaultPlanForm());
const createPlanError = ref<string | null>(null);

const selectedPlanFeatures = ref<FeatureEntry[]>([]);
const selectedPlanPermissions = ref<PermissionEntry[]>([]);
const selectedPlanLimits = ref<LimitEntry[]>([]);
const selectedPlanBillingModes = ref<BillingModeEntry[]>([]);

const newPlanFeatures = ref<FeatureEntry[]>([]);
const newPlanPermissions = ref<PermissionEntry[]>([]);
const newPlanLimits = ref<LimitEntry[]>([]);
const newPlanBillingModes = ref<BillingModeEntry[]>([]);

const roleForm = reactive({
  name: "",
  description: "",
  isActive: true,
});

const editableRolePermissions = ref<EditableRolePermission[]>([]);

const selectedPlan = computed<SystemPlanRow | null>(() => {
  if (!selectedPlanId.value) {
    return null;
  }

  return plans.value.find((plan) => plan.id === selectedPlanId.value) ?? null;
});

const selectedRole = computed<SystemRoleWithPermissions | null>(() => {
  if (!selectedRoleId.value) {
    return null;
  }

  return roles.value.find((role) => role.id === selectedRoleId.value) ?? null;
});

const planPresetOptions = computed(() => {
  return Object.values(PLAN_PRESETS).map((preset) => ({
    label: `${preset.label} - ${preset.description}`,
    value: preset.key,
  }));
});

const hasAnyRoleModuleAccess = (permission: EditableRolePermission): boolean => {
  return permission.canView ||
    permission.canCreate ||
    permission.canEdit ||
    permission.canDelete ||
    permission.canExport ||
    permission.canManage ||
    permission.canApprove ||
    permission.canAssign;
};

const filteredEditableRolePermissions = computed(() => {
  const query = roleModuleQuery.value.trim().toLowerCase();

  return editableRolePermissions.value.filter((permission) => {
    if (query && !permission.moduleKey.toLowerCase().includes(query)) {
      return false;
    }

    if (roleModuleFilter.value === "with_access") {
      return hasAnyRoleModuleAccess(permission);
    }

    if (roleModuleFilter.value === "without_access") {
      return !hasAnyRoleModuleAccess(permission);
    }

    return true;
  });
});

const isRecord = (value: unknown): value is Record<string, unknown> => {
  return typeof value === "object" && value !== null && !Array.isArray(value);
};

const toFeatureEntries = (value: unknown): FeatureEntry[] => {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .filter((entry) => typeof entry === "string")
    .map((entry) => ({ value: entry.trim() }));
};

const toPermissionEntries = (value: unknown): PermissionEntry[] => {
  if (!isRecord(value)) {
    return [];
  }

  const entries: PermissionEntry[] = [];
  for (const [key, raw] of Object.entries(value)) {
    if (typeof raw !== "boolean") {
      continue;
    }

    entries.push({
      key,
      enabled: raw,
    });
  }

  return entries;
};

const toLimitEntries = (value: unknown): LimitEntry[] => {
  if (!isRecord(value)) {
    return [];
  }

  const entries: LimitEntry[] = [];
  for (const [key, raw] of Object.entries(value)) {
    if (typeof raw === "number" && Number.isFinite(raw)) {
      entries.push({
        key,
        valueType: "number",
        numberValue: raw,
        booleanValue: false,
      });
      continue;
    }

    if (typeof raw === "boolean") {
      entries.push({
        key,
        valueType: "boolean",
        numberValue: 0,
        booleanValue: raw,
      });
    }
  }

  return entries;
};

const toBillingModeEntries = (value: unknown): BillingModeEntry[] => {
  if (!isRecord(value)) {
    return [];
  }

  const entries: BillingModeEntry[] = [];
  for (const [key, raw] of Object.entries(value)) {
    if (!isRecord(raw)) {
      continue;
    }

    const label = typeof raw.label === "string" && raw.label.trim().length > 0
      ? raw.label.trim()
      : key;

    const enabled = typeof raw.enabled === "boolean" ? raw.enabled : true;

    const discountPercent =
      typeof raw.discount_percent === "number" && Number.isFinite(raw.discount_percent)
        ? raw.discount_percent
        : 0;

    entries.push({
      key,
      label,
      enabled,
      discountPercent,
    });
  }

  return entries;
};

const buildFeaturesPayload = (entries: FeatureEntry[]): string[] => {
  return entries
    .map((entry) => entry.value.trim())
    .filter((entry) => entry.length > 0);
};

const buildPermissionsPayload = (entries: PermissionEntry[]): Record<string, boolean> => {
  const payload: Record<string, boolean> = {};

  for (const entry of entries) {
    const key = entry.key.trim();
    if (!key) {
      continue;
    }

    payload[key] = entry.enabled;
  }

  return payload;
};

const buildLimitsPayload = (entries: LimitEntry[]): Record<string, number | boolean> => {
  const payload: Record<string, number | boolean> = {};

  for (const entry of entries) {
    const key = entry.key.trim();
    if (!key) {
      continue;
    }

    payload[key] = entry.valueType === "number"
      ? Number(entry.numberValue)
      : entry.booleanValue;
  }

  return payload;
};

const buildBillingModesPayload = (
  entries: BillingModeEntry[],
): Record<string, { label: string; enabled: boolean; discount_percent: number }> => {
  const payload: Record<string, { label: string; enabled: boolean; discount_percent: number }> = {};

  for (const entry of entries) {
    const key = entry.key.trim();
    if (!key) {
      continue;
    }

    payload[key] = {
      label: entry.label.trim() || key,
      enabled: entry.enabled,
      discount_percent: Number(entry.discountPercent),
    };
  }

  return payload;
};

const cloneFeatureEntries = (entries: FeatureEntry[]): FeatureEntry[] => {
  return entries.map((entry) => ({ value: entry.value }));
};

const clonePermissionEntries = (entries: PermissionEntry[]): PermissionEntry[] => {
  return entries.map((entry) => ({ key: entry.key, enabled: entry.enabled }));
};

const cloneLimitEntries = (entries: LimitEntry[]): LimitEntry[] => {
  return entries.map((entry) => ({
    key: entry.key,
    valueType: entry.valueType,
    numberValue: entry.numberValue,
    booleanValue: entry.booleanValue,
  }));
};

const findDuplicateKeys = (keys: string[]): string[] => {
  const seen = new Set<string>();
  const duplicates = new Set<string>();

  for (const rawKey of keys) {
    const normalized = rawKey.trim().toLowerCase();
    if (!normalized) {
      continue;
    }

    if (seen.has(normalized)) {
      duplicates.add(rawKey.trim());
      continue;
    }

    seen.add(normalized);
  }

  return [...duplicates];
};

const validatePlanDynamicEntries = (params: {
  featureEntries: FeatureEntry[];
  permissionEntries: PermissionEntry[];
  limitEntries: LimitEntry[];
  billingModeEntries: BillingModeEntry[];
}): string | null => {
  const { featureEntries, permissionEntries, limitEntries, billingModeEntries } = params;

  const hasEmptyFeature = featureEntries.some((entry) => entry.value.trim().length === 0);
  if (hasEmptyFeature) {
    return "Hay features vacias. Completa o elimina esas filas.";
  }

  const emptyPermission = permissionEntries.some((entry) => entry.key.trim().length === 0);
  if (emptyPermission) {
    return "Hay permisos sin clave.";
  }

  const emptyLimit = limitEntries.some((entry) => entry.key.trim().length === 0);
  if (emptyLimit) {
    return "Hay limites sin clave.";
  }

  const invalidNumberLimit = limitEntries.some((entry) => {
    if (entry.valueType !== "number") {
      return false;
    }

    return !Number.isFinite(entry.numberValue);
  });
  if (invalidNumberLimit) {
    return "Hay limites numericos invalidos.";
  }

  const emptyBillingMode = billingModeEntries.some((entry) => entry.key.trim().length === 0);
  if (emptyBillingMode) {
    return "Hay billing modes sin clave.";
  }

  const invalidDiscount = billingModeEntries.some((entry) => !Number.isFinite(entry.discountPercent));
  if (invalidDiscount) {
    return "Hay descuentos invalidos en billing modes.";
  }

  const duplicateFeatures = findDuplicateKeys(featureEntries.map((entry) => entry.value));
  if (duplicateFeatures.length > 0) {
    return `Features duplicadas: ${duplicateFeatures.join(", ")}`;
  }

  const duplicatePermissions = findDuplicateKeys(permissionEntries.map((entry) => entry.key));
  if (duplicatePermissions.length > 0) {
    return `Permisos duplicados: ${duplicatePermissions.join(", ")}`;
  }

  const duplicateLimits = findDuplicateKeys(limitEntries.map((entry) => entry.key));
  if (duplicateLimits.length > 0) {
    return `Limites duplicados: ${duplicateLimits.join(", ")}`;
  }

  const duplicateBillingModes = findDuplicateKeys(billingModeEntries.map((entry) => entry.key));
  if (duplicateBillingModes.length > 0) {
    return `Billing modes duplicados: ${duplicateBillingModes.join(", ")}`;
  }

  return null;
};

const applyPresetToSelectedPlan = () => {
  if (!selectedPlan.value || !selectedPlanPresetKey.value) {
    return;
  }

  const preset = PLAN_PRESETS[selectedPlanPresetKey.value];
  selectedPlan.value.max_users = preset.maxUsers;
  selectedPlan.value.max_branches = preset.maxBranches;
  selectedPlan.value.trial = preset.trial;
  selectedPlan.value.trial_duration = preset.trialDuration;
  selectedPlanFeatures.value = cloneFeatureEntries(preset.features);
  selectedPlanPermissions.value = clonePermissionEntries(preset.permissions);
  selectedPlanLimits.value = cloneLimitEntries(preset.limits);
  planFormError.value = null;
};

const applyPresetToNewPlan = () => {
  if (!newPlanPresetKey.value) {
    return;
  }

  const preset = PLAN_PRESETS[newPlanPresetKey.value];
  newPlan.maxUsers = preset.maxUsers;
  newPlan.maxBranches = preset.maxBranches;
  newPlan.trial = preset.trial;
  newPlan.trialDuration = preset.trialDuration;
  newPlanFeatures.value = cloneFeatureEntries(preset.features);
  newPlanPermissions.value = clonePermissionEntries(preset.permissions);
  newPlanLimits.value = cloneLimitEntries(preset.limits);
  createPlanError.value = null;
};

const addFeatureRow = (target: "selected" | "new") => {
  if (target === "selected") {
    selectedPlanFeatures.value.push({ value: "" });
    return;
  }

  newPlanFeatures.value.push({ value: "" });
};

const removeFeatureRow = (target: "selected" | "new", index: number) => {
  if (target === "selected") {
    selectedPlanFeatures.value.splice(index, 1);
    return;
  }

  newPlanFeatures.value.splice(index, 1);
};

const addPermissionRow = (target: "selected" | "new") => {
  const row: PermissionEntry = { key: "", enabled: true };

  if (target === "selected") {
    selectedPlanPermissions.value.push(row);
    return;
  }

  newPlanPermissions.value.push(row);
};

const removePermissionRow = (target: "selected" | "new", index: number) => {
  if (target === "selected") {
    selectedPlanPermissions.value.splice(index, 1);
    return;
  }

  newPlanPermissions.value.splice(index, 1);
};

const addLimitRow = (target: "selected" | "new") => {
  const row: LimitEntry = {
    key: "",
    valueType: "number",
    numberValue: 0,
    booleanValue: false,
  };

  if (target === "selected") {
    selectedPlanLimits.value.push(row);
    return;
  }

  newPlanLimits.value.push(row);
};

const removeLimitRow = (target: "selected" | "new", index: number) => {
  if (target === "selected") {
    selectedPlanLimits.value.splice(index, 1);
    return;
  }

  newPlanLimits.value.splice(index, 1);
};

const addBillingModeRow = (target: "selected" | "new") => {
  const row: BillingModeEntry = {
    key: "",
    label: "",
    enabled: true,
    discountPercent: 0,
  };

  if (target === "selected") {
    selectedPlanBillingModes.value.push(row);
    return;
  }

  newPlanBillingModes.value.push(row);
};

const removeBillingModeRow = (target: "selected" | "new", index: number) => {
  if (target === "selected") {
    selectedPlanBillingModes.value.splice(index, 1);
    return;
  }

  newPlanBillingModes.value.splice(index, 1);
};

const resetCreatePlanForm = () => {
  const defaults = getDefaultPlanForm();
  Object.assign(newPlan, defaults);
  newPlanFeatures.value = toFeatureEntries(defaults.features);
  newPlanPermissions.value = toPermissionEntries(defaults.permissions);
  newPlanLimits.value = toLimitEntries(defaults.limits);
  newPlanBillingModes.value = toBillingModeEntries(defaults.availableBillingModes);
  newPlanPresetKey.value = "";
  createPlanError.value = null;
};

const openCreatePlanModal = () => {
  resetCreatePlanForm();
  isCreatePlanModalOpen.value = true;
};

const closeCreatePlanModal = () => {
  isCreatePlanModalOpen.value = false;
  resetCreatePlanForm();
};

const mapRolePermissionRows = (
  rows: RoleModulePermissionRow[],
): EditableRolePermission[] => {
  const byModule = rows.reduce<Record<string, RoleModulePermissionRow>>(
    (accumulator, row) => {
      accumulator[row.module_key] = row;
      return accumulator;
    },
    {},
  );

  return MODULE_KEYS.map((moduleKey) => {
    const row = byModule[moduleKey];
    return {
      moduleKey,
      canView: row?.can_view ?? false,
      canCreate: row?.can_create ?? false,
      canEdit: row?.can_edit ?? false,
      canDelete: row?.can_delete ?? false,
      canExport: row?.can_export ?? false,
      canManage: row?.can_manage ?? false,
      canApprove: row?.can_approve ?? false,
      canAssign: row?.can_assign ?? false,
    };
  });
};

const selectPlan = (plan: SystemPlanRow) => {
  selectedPlanId.value = plan.id;
  selectedPlanFeatures.value = toFeatureEntries(plan.features);
  selectedPlanPermissions.value = toPermissionEntries(plan.permissions);
  selectedPlanLimits.value = toLimitEntries(plan.limits);
  selectedPlanBillingModes.value = toBillingModeEntries(plan.available_billing_modes);
  selectedPlanPresetKey.value = "";
  planFormError.value = null;
};

const selectRole = (role: SystemRoleWithPermissions) => {
  selectedRoleId.value = role.id;
  roleForm.name = role.name;
  roleForm.description = role.description;
  roleForm.isActive = role.is_active;
  editableRolePermissions.value = mapRolePermissionRows(role.module_permissions);
  roleModuleQuery.value = "";
  roleModuleFilter.value = "all";
  roleFormError.value = null;
  rolePermissionsError.value = null;
};

const savePlanMeta = async () => {
  if (!selectedPlan.value) {
    return;
  }

  planFormError.value = null;
  const validationError = validatePlanDynamicEntries({
    featureEntries: selectedPlanFeatures.value,
    permissionEntries: selectedPlanPermissions.value,
    limitEntries: selectedPlanLimits.value,
    billingModeEntries: selectedPlanBillingModes.value,
  });
  if (validationError) {
    planFormError.value = validationError;
    return;
  }

  try {
    await updatePlan(selectedPlan.value.id, {
      name: selectedPlan.value.name,
      priceMonthly: Number(selectedPlan.value.price_monthly),
      priceYearly: Number(selectedPlan.value.price_yearly),
      businessOnly: selectedPlan.value.business_only,
      description: selectedPlan.value.description,
      resume: selectedPlan.value.resume,
      features: buildFeaturesPayload(selectedPlanFeatures.value),
      permissions: buildPermissionsPayload(selectedPlanPermissions.value),
      limits: buildLimitsPayload(selectedPlanLimits.value),
      availableBillingModes: buildBillingModesPayload(selectedPlanBillingModes.value),
      trial: selectedPlan.value.trial,
      trialDuration: selectedPlan.value.trial_duration,
      maxBranches: selectedPlan.value.max_branches,
      maxUsers: selectedPlan.value.max_users,
      isActive: selectedPlan.value.is_active ?? true,
    });
  } catch (saveError) {
    planFormError.value = saveError instanceof Error
      ? saveError.message
      : "No se pudo actualizar el plan.";
  }
};

const saveNewPlan = async () => {
  createPlanError.value = null;
  const validationError = validatePlanDynamicEntries({
    featureEntries: newPlanFeatures.value,
    permissionEntries: newPlanPermissions.value,
    limitEntries: newPlanLimits.value,
    billingModeEntries: newPlanBillingModes.value,
  });
  if (validationError) {
    createPlanError.value = validationError;
    return;
  }

  try {
    const created = await createPlan({
      ...newPlan,
      features: buildFeaturesPayload(newPlanFeatures.value),
      permissions: buildPermissionsPayload(newPlanPermissions.value),
      limits: buildLimitsPayload(newPlanLimits.value),
      availableBillingModes: buildBillingModesPayload(newPlanBillingModes.value),
    });

    closeCreatePlanModal();
    if (created?.id) {
      selectPlan(created);
    }
  } catch (saveError) {
    createPlanError.value = saveError instanceof Error
      ? saveError.message
      : "No se pudo crear el plan.";
  }
};

const togglePlanStatus = async (plan: SystemPlanRow) => {
  planFormError.value = null;

  try {
    await updatePlan(plan.id, {
      isActive: !(plan.is_active ?? true),
    });
  } catch (saveError) {
    planFormError.value = saveError instanceof Error
      ? saveError.message
      : "No se pudo actualizar el estado del plan.";
  }
};

const saveRoleMeta = async () => {
  if (!selectedRole.value) {
    return;
  }

  roleFormError.value = null;

  try {
    await updateRole(selectedRole.value.id, {
      name: roleForm.name,
      description: roleForm.description,
      isActive: roleForm.isActive,
    });
  } catch (saveError) {
    roleFormError.value = saveError instanceof Error
      ? saveError.message
      : "No se pudo actualizar el rol.";
  }
};

const saveRolePermissionMatrix = async () => {
  if (!selectedRole.value) {
    return;
  }

  rolePermissionsError.value = null;

  try {
    await updateRolePermissions(selectedRole.value.id, editableRolePermissions.value);
  } catch (saveError) {
    rolePermissionsError.value = saveError instanceof Error
      ? saveError.message
      : "No se pudieron actualizar permisos del rol.";
  }
};

watch(
  () => plans.value,
  (rows) => {
    if (!rows.length) {
      selectedPlanId.value = null;
      return;
    }

    if (!selectedPlanId.value || !rows.some((plan) => plan.id === selectedPlanId.value)) {
      selectPlan(rows[0]!);
    }
  },
  { immediate: true, deep: true },
);

watch(
  () => roles.value,
  (rows) => {
    if (!rows.length) {
      selectedRoleId.value = null;
      return;
    }

    if (!selectedRoleId.value || !rows.some((role) => role.id === selectedRoleId.value)) {
      selectRole(rows[0]!);
    }
  },
  { immediate: true, deep: true },
);

onMounted(async () => {
  await Promise.all([loadPlans(), loadRoles()]);
});
</script>

<template>
  <div class="space-y-6">
    <div class="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
      <div>
        <p class="text-sm uppercase tracking-[0.35em] text-sky-600 dark:text-sky-300">System</p>
        <h1 class="text-3xl font-bold text-slate-950 dark:text-white">Planes y Roles</h1>
        <p class="mt-2 text-sm text-slate-500 dark:text-slate-400">
          Administra catalogo de planes y matriz global de permisos por rol.
        </p>
      </div>
    </div>

    <UTabs :items="[
      { slot: 'plans', label: 'Planes' },
      { slot: 'roles', label: 'Roles' },
    ]">
      <template #plans>
        <div class="grid gap-5 xl:grid-cols-[340px_minmax(0,1fr)]">
          <UCard class="rounded-3xl border border-slate-200/80 dark:border-slate-800">
            <template #header>
              <div class="flex items-center justify-between gap-3">
                <h2 class="font-semibold text-slate-900 dark:text-white">Catalogo</h2>
                <UButton size="sm" icon="i-heroicons-plus" color="primary" @click="openCreatePlanModal">
                  Nuevo
                </UButton>
              </div>
            </template>

            <div v-if="plansLoading" class="py-8 text-center text-sm text-slate-500 dark:text-slate-400">
              Cargando planes...
            </div>
            <div v-else class="space-y-2">
              <button
                v-for="plan in plans"
                :key="plan.id"
                type="button"
                class="w-full rounded-2xl border p-3 text-left transition"
                :class="plan.id === selectedPlanId
                  ? 'border-sky-400 bg-sky-50/70 dark:border-sky-500 dark:bg-sky-950/30'
                  : 'border-slate-200 hover:border-sky-300 dark:border-slate-800 dark:hover:border-sky-700'"
                @click="selectPlan(plan)"
              >
                <div class="flex items-center justify-between gap-2">
                  <p class="font-semibold text-slate-900 dark:text-white">{{ plan.name }}</p>
                  <UBadge :color="plan.is_active ? 'success' : 'neutral'" variant="soft">
                    {{ plan.is_active ? "Activo" : "Inactivo" }}
                  </UBadge>
                </div>
                <p class="mt-1 text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">{{ plan.slug }}</p>
              </button>
            </div>
          </UCard>

          <UCard class="rounded-3xl border border-slate-200/80 dark:border-slate-800">
            <template #header>
              <div class="flex flex-wrap items-center justify-between gap-3">
                <h2 class="font-semibold text-slate-900 dark:text-white">
                  {{ selectedPlan?.name ?? "Selecciona un plan" }}
                </h2>
                <div class="flex gap-2">
                  <UButton
                    v-if="selectedPlan"
                    size="sm"
                    color="neutral"
                    variant="soft"
                    @click="togglePlanStatus(selectedPlan)"
                  >
                    {{ selectedPlan.is_active ? "Desactivar" : "Activar" }}
                  </UButton>
                  <UButton
                    size="sm"
                    color="primary"
                    :loading="actionLoading"
                    :disabled="!selectedPlan"
                    @click="savePlanMeta"
                  >
                    Guardar plan
                  </UButton>
                </div>
              </div>
            </template>

            <div v-if="!selectedPlan" class="py-10 text-center text-sm text-slate-500 dark:text-slate-400">
              Selecciona un plan para editar su configuracion.
            </div>
            <div v-else class="space-y-4">
              <div class="grid gap-3 md:grid-cols-2">
                <UFormField label="Nombre">
                  <UInput v-model="selectedPlan.name" />
                </UFormField>
                <UFormField label="Slug">
                  <UInput v-model="selectedPlan.slug" disabled />
                </UFormField>
                <UFormField label="Precio mensual">
                  <UInput v-model.number="selectedPlan.price_monthly" type="number" />
                </UFormField>
                <UFormField label="Precio anual">
                  <UInput v-model.number="selectedPlan.price_yearly" type="number" />
                </UFormField>
                <UFormField label="Max sucursales">
                  <UInput v-model.number="selectedPlan.max_branches" type="number" />
                </UFormField>
                <UFormField label="Max usuarios">
                  <UInput v-model.number="selectedPlan.max_users" type="number" />
                </UFormField>
                <UFormField label="Dias de trial">
                  <UInput v-model.number="selectedPlan.trial_duration" type="number" />
                </UFormField>
              </div>

              <div class="grid gap-3 md:grid-cols-3">
                <UCheckbox v-model="selectedPlan.business_only" label="Solo business" />
                <UCheckbox v-model="selectedPlan.trial" label="Habilita trial" />
                <UCheckbox v-model="selectedPlan.is_active" label="Plan activo" />
              </div>

              <UFormField label="Resumen">
                <UInput v-model="selectedPlan.resume" />
              </UFormField>

              <UFormField label="Descripcion">
                <UTextarea v-model="selectedPlan.description" :rows="2" />
              </UFormField>

              <UCard>
                <template #header>
                  <h3 class="font-medium">Preset rapido</h3>
                </template>
                <div class="grid gap-3 md:grid-cols-[minmax(0,1fr)_auto] md:items-end">
                  <UFormField label="Aplicar configuracion base">
                    <USelect
                      v-model="selectedPlanPresetKey"
                      :options="planPresetOptions"
                      placeholder="Selecciona un preset"
                    />
                  </UFormField>
                  <UButton
                    color="primary"
                    variant="soft"
                    :disabled="!selectedPlanPresetKey"
                    @click="applyPresetToSelectedPlan"
                  >
                    Aplicar preset
                  </UButton>
                </div>
              </UCard>

              <div class="grid gap-4 xl:grid-cols-2">
                <UCard>
                  <template #header>
                    <div class="flex items-center justify-between">
                      <h3 class="font-medium">Features</h3>
                      <UButton size="xs" color="primary" variant="soft" icon="i-heroicons-plus" @click="addFeatureRow('selected')">
                        Agregar
                      </UButton>
                    </div>
                  </template>

                  <div class="space-y-2">
                    <div v-if="!selectedPlanFeatures.length" class="text-sm text-slate-500">Sin features.</div>
                    <div v-for="(item, index) in selectedPlanFeatures" :key="`feature-selected-${index}`" class="flex gap-2">
                      <UInput v-model="item.value" placeholder="catalog.services" class="flex-1" />
                      <UButton color="error" variant="soft" icon="i-heroicons-trash" @click="removeFeatureRow('selected', index)" />
                    </div>
                  </div>
                </UCard>

                <UCard>
                  <template #header>
                    <div class="flex items-center justify-between">
                      <h3 class="font-medium">Permisos</h3>
                      <UButton size="xs" color="primary" variant="soft" icon="i-heroicons-plus" @click="addPermissionRow('selected')">
                        Agregar
                      </UButton>
                    </div>
                  </template>

                  <div class="space-y-2">
                    <div v-if="!selectedPlanPermissions.length" class="text-sm text-slate-500">Sin permisos.</div>
                    <div
                      v-for="(item, index) in selectedPlanPermissions"
                      :key="`permission-selected-${index}`"
                      class="grid gap-2 md:grid-cols-[minmax(0,1fr)_auto_auto] md:items-center"
                    >
                      <UInput v-model="item.key" placeholder="catalog" />
                      <UCheckbox v-model="item.enabled" label="Habilitado" />
                      <UButton color="error" variant="soft" icon="i-heroicons-trash" @click="removePermissionRow('selected', index)" />
                    </div>
                  </div>
                </UCard>

                <UCard>
                  <template #header>
                    <div class="flex items-center justify-between">
                      <h3 class="font-medium">Limites</h3>
                      <UButton size="xs" color="primary" variant="soft" icon="i-heroicons-plus" @click="addLimitRow('selected')">
                        Agregar
                      </UButton>
                    </div>
                  </template>

                  <div class="space-y-2">
                    <div v-if="!selectedPlanLimits.length" class="text-sm text-slate-500">Sin limites.</div>
                    <div
                      v-for="(item, index) in selectedPlanLimits"
                      :key="`limit-selected-${index}`"
                      class="grid gap-2 md:grid-cols-[minmax(0,1fr)_130px_minmax(0,1fr)_auto] md:items-center"
                    >
                      <UInput v-model="item.key" placeholder="roles.manager" />
                      <USelect
                        v-model="item.valueType"
                        :options="[
                          { label: 'number', value: 'number' },
                          { label: 'boolean', value: 'boolean' },
                        ]"
                      />
                      <UInput
                        v-if="item.valueType === 'number'"
                        v-model.number="item.numberValue"
                        type="number"
                        placeholder="0"
                      />
                      <UCheckbox
                        v-else
                        v-model="item.booleanValue"
                        label="true/false"
                      />
                      <UButton color="error" variant="soft" icon="i-heroicons-trash" @click="removeLimitRow('selected', index)" />
                    </div>
                  </div>
                </UCard>

                <UCard>
                  <template #header>
                    <div class="flex items-center justify-between">
                      <h3 class="font-medium">Billing Modes</h3>
                      <UButton size="xs" color="primary" variant="soft" icon="i-heroicons-plus" @click="addBillingModeRow('selected')">
                        Agregar
                      </UButton>
                    </div>
                  </template>

                  <div class="space-y-2">
                    <div v-if="!selectedPlanBillingModes.length" class="text-sm text-slate-500">Sin modos.</div>
                    <div
                      v-for="(item, index) in selectedPlanBillingModes"
                      :key="`billing-selected-${index}`"
                      class="grid gap-2 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto_130px_auto] md:items-center"
                    >
                      <UInput v-model="item.key" placeholder="monthly" />
                      <UInput v-model="item.label" placeholder="Monthly" />
                      <UCheckbox v-model="item.enabled" label="Activo" />
                      <UInput v-model.number="item.discountPercent" type="number" placeholder="10" />
                      <UButton color="error" variant="soft" icon="i-heroicons-trash" @click="removeBillingModeRow('selected', index)" />
                    </div>
                  </div>
                </UCard>
              </div>

              <UAlert
                v-if="planFormError"
                color="error"
                variant="soft"
                icon="i-heroicons-exclamation-triangle"
                :title="planFormError"
              />
            </div>
          </UCard>
        </div>
      </template>

      <template #roles>
        <div class="grid gap-5 xl:grid-cols-[340px_minmax(0,1fr)]">
          <UCard class="rounded-3xl border border-slate-200/80 dark:border-slate-800">
            <template #header>
              <h2 class="font-semibold text-slate-900 dark:text-white">Roles globales</h2>
            </template>

            <div v-if="rolesLoading" class="py-8 text-center text-sm text-slate-500 dark:text-slate-400">
              Cargando roles...
            </div>
            <div v-else class="space-y-2">
              <button
                v-for="role in roles"
                :key="role.id"
                type="button"
                class="w-full rounded-2xl border p-3 text-left transition"
                :class="role.id === selectedRoleId
                  ? 'border-sky-400 bg-sky-50/70 dark:border-sky-500 dark:bg-sky-950/30'
                  : 'border-slate-200 hover:border-sky-300 dark:border-slate-800 dark:hover:border-sky-700'"
                @click="selectRole(role)"
              >
                <div class="flex items-center justify-between gap-2">
                  <p class="font-semibold text-slate-900 dark:text-white">{{ role.name }}</p>
                  <UBadge :color="role.is_active ? 'success' : 'neutral'" variant="soft">
                    {{ role.is_active ? "Activo" : "Inactivo" }}
                  </UBadge>
                </div>
                <p class="mt-1 text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">{{ role.code }}</p>
              </button>
            </div>
          </UCard>

          <UCard class="rounded-3xl border border-slate-200/80 dark:border-slate-800">
            <template #header>
              <div class="flex flex-wrap items-center justify-between gap-3">
                <h2 class="font-semibold text-slate-900 dark:text-white">
                  {{ selectedRole?.name ?? "Selecciona un rol" }}
                </h2>
                <div class="flex gap-2">
                  <UButton
                    size="sm"
                    color="primary"
                    :loading="actionLoading"
                    :disabled="!selectedRole"
                    @click="saveRoleMeta"
                  >
                    Guardar rol
                  </UButton>
                  <UButton
                    size="sm"
                    color="primary"
                    variant="soft"
                    :loading="actionLoading"
                    :disabled="!selectedRole"
                    @click="saveRolePermissionMatrix"
                  >
                    Guardar permisos
                  </UButton>
                </div>
              </div>
            </template>

            <div v-if="!selectedRole" class="py-10 text-center text-sm text-slate-500 dark:text-slate-400">
              Selecciona un rol para editar.
            </div>
            <div v-else class="space-y-4">
              <div class="grid gap-3 md:grid-cols-2">
                <UFormField label="Nombre">
                  <UInput v-model="roleForm.name" />
                </UFormField>
                <UFormField label="Codigo">
                  <UInput :model-value="selectedRole.code" disabled />
                </UFormField>
              </div>

              <UFormField label="Descripcion">
                <UTextarea v-model="roleForm.description" :rows="2" />
              </UFormField>

              <UCheckbox v-model="roleForm.isActive" label="Rol activo" />

              <div class="grid gap-3 md:grid-cols-[minmax(0,1fr)_220px] md:items-end">
                <UFormField label="Buscar modulo">
                  <UInput
                    v-model="roleModuleQuery"
                    placeholder="Ej: inventory, users, reports"
                  />
                </UFormField>
                <UFormField label="Filtro">
                  <USelect
                    v-model="roleModuleFilter"
                    :options="[
                      { label: 'Todos', value: 'all' },
                      { label: 'Con acceso', value: 'with_access' },
                      { label: 'Sin acceso', value: 'without_access' },
                    ]"
                  />
                </UFormField>
              </div>
              <p class="text-xs text-slate-500 dark:text-slate-400">
                Mostrando {{ filteredEditableRolePermissions.length }} de {{ editableRolePermissions.length }} modulos.
              </p>

              <div class="overflow-x-auto rounded-2xl border border-slate-200 dark:border-slate-800">
                <table class="min-w-full text-sm">
                  <thead class="bg-slate-50 dark:bg-slate-900/60">
                    <tr>
                      <th class="px-3 py-2 text-left">Modulo</th>
                      <th class="px-3 py-2 text-center">View</th>
                      <th class="px-3 py-2 text-center">Create</th>
                      <th class="px-3 py-2 text-center">Edit</th>
                      <th class="px-3 py-2 text-center">Delete</th>
                      <th class="px-3 py-2 text-center">Export</th>
                      <th class="px-3 py-2 text-center">Manage</th>
                      <th class="px-3 py-2 text-center">Approve</th>
                      <th class="px-3 py-2 text-center">Assign</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr
                      v-for="permission in filteredEditableRolePermissions"
                      :key="permission.moduleKey"
                      class="border-t border-slate-100 dark:border-slate-800"
                    >
                      <td class="px-3 py-2 font-medium">{{ permission.moduleKey }}</td>
                      <td class="px-3 py-2 text-center"><UCheckbox v-model="permission.canView" /></td>
                      <td class="px-3 py-2 text-center"><UCheckbox v-model="permission.canCreate" /></td>
                      <td class="px-3 py-2 text-center"><UCheckbox v-model="permission.canEdit" /></td>
                      <td class="px-3 py-2 text-center"><UCheckbox v-model="permission.canDelete" /></td>
                      <td class="px-3 py-2 text-center"><UCheckbox v-model="permission.canExport" /></td>
                      <td class="px-3 py-2 text-center"><UCheckbox v-model="permission.canManage" /></td>
                      <td class="px-3 py-2 text-center"><UCheckbox v-model="permission.canApprove" /></td>
                      <td class="px-3 py-2 text-center"><UCheckbox v-model="permission.canAssign" /></td>
                    </tr>
                  </tbody>
                </table>
              </div>

              <UAlert
                v-if="roleFormError"
                color="error"
                variant="soft"
                icon="i-heroicons-exclamation-triangle"
                :title="roleFormError"
              />
              <UAlert
                v-if="rolePermissionsError"
                color="error"
                variant="soft"
                icon="i-heroicons-exclamation-triangle"
                :title="rolePermissionsError"
              />
            </div>
          </UCard>
        </div>
      </template>
    </UTabs>

    <UModal
      :open="isCreatePlanModalOpen"
      title="Nuevo plan"
      description="Crea un plan con metadatos, limites y permisos iniciales."
      @update:open="isCreatePlanModalOpen = $event"
    >
      <template #body>
        <div class="space-y-3">
          <div class="grid gap-3 md:grid-cols-2">
            <UFormField label="Slug"><UInput v-model="newPlan.slug" /></UFormField>
            <UFormField label="Nombre"><UInput v-model="newPlan.name" /></UFormField>
            <UFormField label="Precio mensual"><UInput v-model.number="newPlan.priceMonthly" type="number" /></UFormField>
            <UFormField label="Precio anual"><UInput v-model.number="newPlan.priceYearly" type="number" /></UFormField>
            <UFormField label="Max sucursales"><UInput v-model.number="newPlan.maxBranches" type="number" /></UFormField>
            <UFormField label="Max usuarios"><UInput v-model.number="newPlan.maxUsers" type="number" /></UFormField>
            <UFormField label="Dias de trial"><UInput v-model.number="newPlan.trialDuration" type="number" /></UFormField>
          </div>

          <div class="grid gap-3 md:grid-cols-3">
            <UCheckbox v-model="newPlan.businessOnly" label="Solo business" />
            <UCheckbox v-model="newPlan.trial" label="Trial" />
            <UCheckbox v-model="newPlan.isActive" label="Activo" />
          </div>

          <UFormField label="Resumen"><UInput v-model="newPlan.resume" /></UFormField>
          <UFormField label="Descripcion"><UTextarea v-model="newPlan.description" :rows="2" /></UFormField>

          <UCard>
            <template #header>
              <h3 class="font-medium">Preset rapido</h3>
            </template>
            <div class="grid gap-3 md:grid-cols-[minmax(0,1fr)_auto] md:items-end">
              <UFormField label="Aplicar configuracion base">
                <USelect
                  v-model="newPlanPresetKey"
                  :options="planPresetOptions"
                  placeholder="Selecciona un preset"
                />
              </UFormField>
              <UButton
                color="primary"
                variant="soft"
                :disabled="!newPlanPresetKey"
                @click="applyPresetToNewPlan"
              >
                Aplicar preset
              </UButton>
            </div>
          </UCard>

          <div class="grid gap-4 xl:grid-cols-2">
            <UCard>
              <template #header>
                <div class="flex items-center justify-between">
                  <h3 class="font-medium">Features</h3>
                  <UButton size="xs" color="primary" variant="soft" icon="i-heroicons-plus" @click="addFeatureRow('new')">Agregar</UButton>
                </div>
              </template>
              <div class="space-y-2">
                <div v-if="!newPlanFeatures.length" class="text-sm text-slate-500">Sin features.</div>
                <div v-for="(item, index) in newPlanFeatures" :key="`feature-new-${index}`" class="flex gap-2">
                  <UInput v-model="item.value" placeholder="catalog.services" class="flex-1" />
                  <UButton color="error" variant="soft" icon="i-heroicons-trash" @click="removeFeatureRow('new', index)" />
                </div>
              </div>
            </UCard>

            <UCard>
              <template #header>
                <div class="flex items-center justify-between">
                  <h3 class="font-medium">Permisos</h3>
                  <UButton size="xs" color="primary" variant="soft" icon="i-heroicons-plus" @click="addPermissionRow('new')">Agregar</UButton>
                </div>
              </template>
              <div class="space-y-2">
                <div v-if="!newPlanPermissions.length" class="text-sm text-slate-500">Sin permisos.</div>
                <div
                  v-for="(item, index) in newPlanPermissions"
                  :key="`permission-new-${index}`"
                  class="grid gap-2 md:grid-cols-[minmax(0,1fr)_auto_auto] md:items-center"
                >
                  <UInput v-model="item.key" placeholder="catalog" />
                  <UCheckbox v-model="item.enabled" label="Habilitado" />
                  <UButton color="error" variant="soft" icon="i-heroicons-trash" @click="removePermissionRow('new', index)" />
                </div>
              </div>
            </UCard>

            <UCard>
              <template #header>
                <div class="flex items-center justify-between">
                  <h3 class="font-medium">Limites</h3>
                  <UButton size="xs" color="primary" variant="soft" icon="i-heroicons-plus" @click="addLimitRow('new')">Agregar</UButton>
                </div>
              </template>
              <div class="space-y-2">
                <div v-if="!newPlanLimits.length" class="text-sm text-slate-500">Sin limites.</div>
                <div
                  v-for="(item, index) in newPlanLimits"
                  :key="`limit-new-${index}`"
                  class="grid gap-2 md:grid-cols-[minmax(0,1fr)_130px_minmax(0,1fr)_auto] md:items-center"
                >
                  <UInput v-model="item.key" placeholder="roles.manager" />
                  <USelect
                    v-model="item.valueType"
                    :options="[
                      { label: 'number', value: 'number' },
                      { label: 'boolean', value: 'boolean' },
                    ]"
                  />
                  <UInput
                    v-if="item.valueType === 'number'"
                    v-model.number="item.numberValue"
                    type="number"
                    placeholder="0"
                  />
                  <UCheckbox
                    v-else
                    v-model="item.booleanValue"
                    label="true/false"
                  />
                  <UButton color="error" variant="soft" icon="i-heroicons-trash" @click="removeLimitRow('new', index)" />
                </div>
              </div>
            </UCard>

            <UCard>
              <template #header>
                <div class="flex items-center justify-between">
                  <h3 class="font-medium">Billing Modes</h3>
                  <UButton size="xs" color="primary" variant="soft" icon="i-heroicons-plus" @click="addBillingModeRow('new')">Agregar</UButton>
                </div>
              </template>
              <div class="space-y-2">
                <div v-if="!newPlanBillingModes.length" class="text-sm text-slate-500">Sin modos.</div>
                <div
                  v-for="(item, index) in newPlanBillingModes"
                  :key="`billing-new-${index}`"
                  class="grid gap-2 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto_130px_auto] md:items-center"
                >
                  <UInput v-model="item.key" placeholder="monthly" />
                  <UInput v-model="item.label" placeholder="Monthly" />
                  <UCheckbox v-model="item.enabled" label="Activo" />
                  <UInput v-model.number="item.discountPercent" type="number" placeholder="10" />
                  <UButton color="error" variant="soft" icon="i-heroicons-trash" @click="removeBillingModeRow('new', index)" />
                </div>
              </div>
            </UCard>
          </div>

          <UAlert
            v-if="createPlanError"
            color="error"
            variant="soft"
            icon="i-heroicons-exclamation-triangle"
            :title="createPlanError"
          />

          <div class="flex justify-end gap-2">
            <UButton color="neutral" variant="soft" @click="closeCreatePlanModal">
              Cancelar
            </UButton>
            <UButton color="primary" :loading="actionLoading" @click="saveNewPlan">
              Crear plan
            </UButton>
          </div>
        </div>
      </template>
    </UModal>

    <UAlert
      v-if="error"
      color="error"
      variant="soft"
      icon="i-heroicons-exclamation-triangle"
      :title="error"
    />
  </div>
</template>
