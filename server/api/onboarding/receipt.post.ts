import { z } from "zod";

import { throwApiError } from "../../utils/http-error";
import { requireAuthServerContext } from "../../utils/auth-server";
import { uploadReceipt } from "../../services/onboarding";

const receiptSchema = z.object({
  organizationId: z.string().uuid(),
  amount: z.number().positive(),
  paymentMethod: z.enum(["bank_transfer", "qr_payment", "card", "paypal", "other"]),
  transactionRef: z.string().trim().max(120).optional().or(z.literal("")),
  file: z.object({
    dataBase64: z.string(),
    name: z.string(),
    type: z.string(),
  }),
});

export default defineEventHandler(async (event) => {
  const { userId } = await requireAuthServerContext(event);
  const body = await readBody(event);
  const parsed = receiptSchema.safeParse(body);

  if (!parsed.success) {
    throwApiError(
      400,
      "ONBOARDING_RECEIPT_INVALID_BODY",
      parsed.error.issues[0]?.message ?? "Payload invalido.",
      parsed.error.flatten(),
    );
    return;
  }

  const input = parsed.data;
  const base64Data = input.file.dataBase64.split(",")[1] ?? input.file.dataBase64;
  const fileData = {
    data: Buffer.from(base64Data, "base64"),
    name: input.file.name,
    type: input.file.type,
  };

  const validation = await uploadReceipt(event, {
    organizationId: input.organizationId,
    userId,
    amount: input.amount,
    paymentMethod: input.paymentMethod,
    transactionRef: input.transactionRef,
    file: fileData,
  });

  return { validation };
});
