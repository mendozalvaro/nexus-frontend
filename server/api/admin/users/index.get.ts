import {
  getUsersList,
} from "../../../services/users/list";
import { assertAdminModuleAccess, requireAdminContext } from "../../../utils/admin-users";

export default defineEventHandler(async (event) => {
  const context = await requireAdminContext(event);
  await assertAdminModuleAccess(context, "users", "can_view");

  const { users, branches } = await getUsersList(context);

  return {
    organizationId: context.organizationId,
    users,
    branches,
  };
});
