import type { InventoryContext, InventoryModuleAction } from "./inventory";
import { requireInventoryContext } from "./inventory";
import { assertTenantModuleAccess } from "./tenant-module-access";

import type { H3Event } from "h3";

export const requireInventoryContextStrict = async (
  event: H3Event,
  action: InventoryModuleAction = "can_view",
): Promise<InventoryContext> => {
  const context = await requireInventoryContext(event);

  await assertTenantModuleAccess({
    adminClient: context.adminClient,
    organizationId: context.organizationId,
    role: context.role,
    roleId: context.profile.role_id,
    moduleKey: "inventory",
    action,
  });

  return context;
};

export const assertInventoryModuleAccessStrict = async (
  context: InventoryContext,
  action: InventoryModuleAction,
) => {
  await assertTenantModuleAccess({
    adminClient: context.adminClient,
    organizationId: context.organizationId,
    role: context.role,
    roleId: context.profile.role_id,
    moduleKey: "inventory",
    action,
  });
};
