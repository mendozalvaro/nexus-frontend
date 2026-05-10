import {
  getUsersList,
} from "../../../services/users/list";
import { requireAdminContext } from "../../../utils/admin-users";

export default defineEventHandler(async (event) => {
  const context = await requireAdminContext(event);

  const { users, branches } = await getUsersList(context);

  return {
    organizationId: context.organizationId,
    users,
    branches,
  };
});
