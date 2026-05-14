import { getPOSCatalog } from "../../services/pos/catalog";

export default defineEventHandler(async (event) => {
  return getPOSCatalog(event);
});
