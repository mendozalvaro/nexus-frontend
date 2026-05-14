import { replaceServiceCoverage, requireServiceAssignmentContext } from "../../utils/service-assignment";

import type { H3Event } from "h3";

export async function updateServiceCoverage(
  event: H3Event,
  serviceId: string,
  coverage: Array<{ branchId: string; userIds: string[] }>,
): Promise<{ success: boolean; serviceId: string }> {
  const context = await requireServiceAssignmentContext(event);
  await replaceServiceCoverage(context, serviceId, coverage);

  return {
    success: true,
    serviceId,
  };
}
