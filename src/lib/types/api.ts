// API contract types shared by route handlers and the browser API client (API_SPECIFICATION §1).

export type ApiErrorBody = {
  error: {
    code: string;
    message: string;
    fields?: Record<string, string>;
    requestId: string;
  };
};

export type Paginated<TItem> = {
  items: TItem[];
  nextCursor: string | null;
};
