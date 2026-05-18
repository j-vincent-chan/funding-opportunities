import type { SimplerSearchBody, SimplerSearchResponse, SimplerOpportunityHit } from "./types";

const DEFAULT_BASE = "https://api.simpler.grants.gov";

export class SimplerGrantsClient {
  constructor(
    private readonly apiKey: string,
    private readonly baseUrl: string = DEFAULT_BASE
  ) {}

  async searchOpportunities(body: SimplerSearchBody): Promise<SimplerSearchResponse> {
    const res = await fetch(`${this.baseUrl}/v1/opportunities/search`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-API-Key": this.apiKey,
      },
      body: JSON.stringify(body),
      cache: "no-store",
    });
    const text = await res.text();
    if (!res.ok) {
      throw new Error(`Simpler search failed: ${res.status} ${text.slice(0, 500)}`);
    }
    return JSON.parse(text) as SimplerSearchResponse;
  }

  async getOpportunity(opportunityId: string): Promise<SimplerOpportunityHit> {
    const res = await fetch(`${this.baseUrl}/v1/opportunities/${opportunityId}`, {
      method: "GET",
      headers: {
        "X-API-Key": this.apiKey,
        Accept: "application/json",
      },
      cache: "no-store",
    });
    const text = await res.text();
    if (!res.ok) {
      throw new Error(`Simpler get opportunity failed: ${res.status} ${text.slice(0, 500)}`);
    }
    const json = JSON.parse(text) as { data?: SimplerOpportunityHit } | SimplerOpportunityHit;
    if (json && typeof json === "object" && "data" in json && json.data) {
      return json.data as SimplerOpportunityHit;
    }
    return json as SimplerOpportunityHit;
  }
}

export function createSimplerGrantsClient(): SimplerGrantsClient | null {
  const key = process.env.SIMPLER_GRANTS_API_KEY?.trim();
  if (!key) return null;
  const base = process.env.SIMPLER_GRANTS_API_BASE_URL?.trim() || DEFAULT_BASE;
  return new SimplerGrantsClient(key, base);
}
