/// <reference types="@cloudflare/workers-types" />

declare namespace Cloudflare {
  interface Env {
    DB: D1Database;
    ANVERA_BUSINESS_API_ENABLED?: string;
  }
}
