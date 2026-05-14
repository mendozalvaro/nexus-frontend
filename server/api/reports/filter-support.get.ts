import { requireReportsContext, getReportsFilterSupport } from "../../services/reports/context";

export default defineEventHandler(async (event) => {
  const context = await requireReportsContext(event);
  return getReportsFilterSupport(event, context);
});
