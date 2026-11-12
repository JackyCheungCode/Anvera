import { handle } from "@astrojs/cloudflare/handler";
import { createScheduledHandler, PluginBridge } from "@emdash-cms/cloudflare/worker";

export { PluginBridge };

export default {
  fetch: handle,
  scheduled: createScheduledHandler()
} satisfies ExportedHandler;
