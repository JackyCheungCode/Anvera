import cloudflare from "@astrojs/cloudflare";
import react from "@astrojs/react";
import { d1, r2 } from "@emdash-cms/cloudflare";
import { defineConfig } from "astro/config";
import emdash from "emdash/astro";
import { anveraBusinessPlugin } from "./src/plugins/anvera-business/index";

export default defineConfig({
  output: "server",
  adapter: cloudflare(),
  image: { layout: "constrained", responsiveStyles: true },
  integrations: [
    react(),
    emdash({
      database: d1({ binding: "DB", session: "auto", coalesce: true }),
      storage: r2({ binding: "MEDIA" }),
      migrations: { runtime: "check", dev: "auto" },
      plugins: [anveraBusinessPlugin()]
    })
  ],
  devToolbar: { enabled: false }
});
