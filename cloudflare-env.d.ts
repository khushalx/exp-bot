declare namespace Cloudflare {
  interface Env {
    GROQ_API_KEY?: string;
    DB?: D1Database;
    BUCKET?: R2Bucket;
  }
}
