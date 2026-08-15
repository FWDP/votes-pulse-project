export interface MeltwaterSentimentValue {
  document_count: number;
  percentage: number;
}

export interface MeltwaterSummary {
  volume: {
    document_count: number;
    per_day: number;
    per_hour: number;
  };

  sentiment: {
    positive: MeltwaterSentimentValue;
    neutral: MeltwaterSentimentValue;
    negative: MeltwaterSentimentValue;
    unknown?: MeltwaterSentimentValue;
  };

  top_countries?: Array<{
    country_code: string;
    document_count: number;
    percentage: number;
  }>;

  top_languages?: Array<{
    language_code: string;
    document_count: number;
    percentage: number;
  }>;
}

export interface MeltwaterTopTerm {
  key: string;
  document_count: number;
  percentage: number;
}

export interface MeltwaterTopTermsResponse {
  start: string;
  end: string;
  tz: string;
  search_id: number;
  result: {
    document_count: number;
    analysis: MeltwaterTopTerm[];
  };
}

export interface MeltwaterCountUniqueResponse {
  start: string;
  end: string;
  tz: string;
  search_id: number;
  result: {
    document_count: number;
    analysis: number;
  };
}

export interface MeltwaterDocumentCountResponse {
  start: string;
  end: string;
  tz: string;
  search_id: number;
  result: {
    document_count: number;
  };
}