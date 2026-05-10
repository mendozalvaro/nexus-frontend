import {
  getBranchesList,
} from "../../../services/branches/list";
import { setCacheHeaders } from "../../../utils/cache";
import { requireInventoryContext } from "../../../utils/inventory";

export default defineEventHandler(async (event) => {
  const context = await requireInventoryContext(event);

  const branches = await getBranchesList(context);

  setCacheHeaders(event, { sMaxAge: 60, staleWhileRevalidate: 30, visibility: "private" });

  return {
    branches,
  };
});
