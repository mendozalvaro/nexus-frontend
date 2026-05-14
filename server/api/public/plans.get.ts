import { getPublicPlans } from "../../services/public/plans";

export default defineEventHandler(async (event) => {
  const plans = await getPublicPlans(event);
  return { plans };
});
