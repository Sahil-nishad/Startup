import type { Provider, NormalizedIssue } from "../../lib/market/models";
import { ServiceError } from "../config";
// Explicit extension points: no unlicensed calls or guessed schema are made.
export class OfficialLicensedExchangeProvider implements Provider {
  id = "official_licensed";
  enabled = false;
  async fetchMaster(): Promise<unknown> {
    throw new ServiceError("LICENSED_FEED_NOT_CONFIGURED");
  }
  async fetchDetail(): Promise<unknown> {
    throw new ServiceError("LICENSED_FEED_NOT_CONFIGURED");
  }
  normalize(): NormalizedIssue[] {
    throw new ServiceError("LICENSED_FEED_SCHEMA_REQUIRED");
  }
}
export class IpoGuruProvider extends OfficialLicensedExchangeProvider {
  override id = "ipoguru";
  // Deliberately disabled until licence + actual account response schema are verified.
}
