import { getServiceAssignmentOverview } from "../../services/service-assignment/overview";

export default defineEventHandler(async (event) => {
  return getServiceAssignmentOverview(event);
});
