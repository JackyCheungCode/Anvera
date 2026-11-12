import { definePlugin } from "emdash";

export function anveraBusinessPlugin() {
  return definePlugin({
    id: "anvera-business",
    displayName: "ANVERA Business",
    description: "Inquiry and dealer operations for ANVERA.",
    version: "0.1.0",
    capabilities: [],
    routes: {},
    admin: {
      entry: "./src/plugins/anvera-business/admin.tsx",
      pages: [
        { path: "/inquiries", label: "Inquiry Inbox", icon: "inbox", group: "ANVERA Business" },
        { path: "/dealer-applications", label: "Dealer Applications", icon: "building-2", group: "ANVERA Business" },
        { path: "/dealers", label: "Dealer Accounts", icon: "users", group: "ANVERA Business" }
      ]
    }
  });
}

export default anveraBusinessPlugin;
