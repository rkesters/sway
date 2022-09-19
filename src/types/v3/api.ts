import { has } from "lodash";
import { DocumentApi } from "./typedef";



export function isOpenApi3X(doc: unknown): doc is DocumentApi.Document  {
  if (has(doc, 'openapi')) {
      return true;
  }

  return false;
}
