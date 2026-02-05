/// <reference types="@sveltejs/kit" />

declare global {
  namespace App {
    interface Platform {
      env: {
        DB: D1Database;
        JWT_SECRET: string;
        JWT_ISSUER: string;
        JWT_AUD: string;
        BOOTSTRAP_TOKEN: string;
        BOT_TOKEN_KEY: string;
        [key: string]: any;
      };
    }

    interface Locals {
      admin?: { id: string; email: string; role: string };
    }
  }
}

export {};
