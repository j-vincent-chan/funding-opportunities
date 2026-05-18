export type SimplerPagination = {
  page_offset: number;
  page_size: number;
  sort_order: { order_by: string; sort_direction: "ascending" | "descending" }[];
};

export type SimplerSearchBody = {
  query?: string;
  query_operator?: "AND" | "OR";
  filters?: Record<string, unknown>;
  pagination: SimplerPagination;
  format?: "json" | "csv";
};

/**
 * Simpler nests deadlines, awards, instruments, and applicant types on the opportunity under
 * `summary` (object). Legacy payloads may use a string `summary` instead.
 */
export type SimplerOpportunitySummary = Record<string, unknown>;

export type SimplerOpportunityHit = {
  opportunity_id: string;
  opportunity_number?: string | null;
  opportunity_title: string;
  agency_code?: string | null;
  agency_name?: string | null;
  post_date?: string | null;
  close_date?: string | null;
  opportunity_status?: string | null;
  funding_instrument?: string | null;
  funding_category?: string | null;
  award_floor?: number | null;
  award_ceiling?: number | null;
  applicant_types?: string[] | null;
  summary?: string | SimplerOpportunitySummary | null;
  is_cost_sharing?: boolean | null;
  [key: string]: unknown;
};

export type SimplerSearchResponse = {
  message?: string;
  data: SimplerOpportunityHit[];
  pagination_info?: {
    page_offset: number;
    page_size: number;
    total_pages?: number;
    total_records?: number;
  };
};
