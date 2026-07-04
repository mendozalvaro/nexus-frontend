import { getQuery } from "h3";
import { getProformas } from "../../../services/pos/proformas";

export default defineEventHandler(async (event) => {
  const query = getQuery(event);
  const status = typeof query.status === "string" ? query.status : null;
  return getProformas(event, status);
});
