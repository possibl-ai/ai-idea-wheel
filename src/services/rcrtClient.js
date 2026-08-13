import { createClient, staticToken } from "@rcrt/sdk";
import { RCRT_BASE_URL, RCRT_SERVICE_KEY, RCRT_TENANT_ID } from "../config.js";

export const client = createClient({
  baseURL: RCRT_BASE_URL,
  tokenProvider: staticToken(RCRT_SERVICE_KEY),
  tenantId: RCRT_TENANT_ID,
});
