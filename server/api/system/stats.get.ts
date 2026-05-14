import { getSystemDashboardStats } from "../../services/system/stats";

export default defineEventHandler(async (event) => {
  const stats = await getSystemDashboardStats(event);
  return { stats };
});
