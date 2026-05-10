import { getRouterParam } from "h3";

import {
  getBranchDetails,
} from "../../../services/branches/details";
import { setCacheHeaders } from "../../../utils/cache";
import { requireInventoryContext } from "../../../utils/inventory";

export default defineEventHandler(async (event) => {
  const context = await requireInventoryContext(event);
  const branchId = getRouterParam(event, "id");

  if (!branchId) {
    throw createError({ statusCode: 400, statusMessage: "Debes indicar la sucursal." });
  }

  const { branch, destinationBranches, inventory } = await getBranchDetails(context, branchId);

  setCacheHeaders(event, { sMaxAge: 60, staleWhileRevalidate: 30, visibility: "private" });

  return {
    branch,
    destinationBranches,
    inventory,
  };
});
