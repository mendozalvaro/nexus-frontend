import { getRouterParam } from "h3";
import { resumeFromProforma } from "../../../../services/pos/proformas";

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, "id");
  if (!id) {
    throw createError({ statusCode: 400, statusMessage: "Debes indicar la proforma." });
  }
  return resumeFromProforma(event, id);
});
