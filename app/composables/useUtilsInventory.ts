import {
  formatCurrency as formatCurrencyUtil,
  formatDateTime as formatDateTimeUtil,
  getMovementColor as getMovementColorUtil,
  getMovementLabel as getMovementLabelUtil,
  getStockTone as getStockToneUtil,
} from "@/utils/inventory";

export const useUtilsInventory = () => {
  const localTimeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;

  const formatCurrency = (value: number) => {
    return formatCurrencyUtil(value);
  };

  const formatDateTime = (value: string | null, timeZone: string = localTimeZone) => {
    return formatDateTimeUtil(value, timeZone);
  };

  const getMovementLabel = (value: "entry" | "exit" | "adjustment" | "transfer_in" | "transfer_out"): string => {
    return getMovementLabelUtil(value);
  };

  const getMovementColor = (value: "entry" | "exit" | "adjustment" | "transfer_in" | "transfer_out"): "success" | "warning" | "error" | "primary" | "neutral" => {
    return getMovementColorUtil(value);
  };

  const getStockTone = (quantity: number, minStock: number | null): "success" | "warning" | "error" | "neutral" => {
    if (minStock === null) {
      return "success";
    }

    return getStockToneUtil(quantity, minStock);
  };

  return {
    localTimeZone,
    formatCurrency,
    formatDateTime,
    getMovementLabel,
    getMovementColor,
    getStockTone,
  };
};
