import type { PluginAdminExports } from "emdash";
import "./admin.css";
import { InquiryInbox } from "./pages/InquiryInbox";
import { DealerApplications } from "./pages/DealerApplications";
import { DealerAccounts } from "./pages/DealerAccounts";

export const pages: PluginAdminExports["pages"] = {
  "/inquiries": <InquiryInbox />,
  "/dealer-applications": <DealerApplications />,
  "/dealers": <DealerAccounts />
};
