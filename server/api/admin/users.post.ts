import {
  assertAdminModuleAccess,
  createUserSchema,
  readValidatedAdminBody,
  requireAdminContext,
  sanitizeEmail,
} from "../../utils/admin-users";
import { createManagedUser } from "../../services/users/create";

export default defineEventHandler(async (event) => {
  const context = await requireAdminContext(event);
  const body = await readValidatedAdminBody(event, createUserSchema);

  await assertAdminModuleAccess(context, "users", "can_create");

  return createManagedUser(context, {
    ...body,
    email: sanitizeEmail(body.email),
  });
});
