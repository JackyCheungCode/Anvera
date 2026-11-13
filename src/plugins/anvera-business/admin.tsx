import type { PluginAdminExports } from "emdash";
import "../../styles/carbon.scss";
import "./admin.css";
import { InquiryInbox } from "./pages/InquiryInbox";
import { DealerApplications } from "./pages/DealerApplications";
import { DealerAccounts } from "./pages/DealerAccounts";
import { ProductIntelligence } from "./pages/ProductIntelligence";
import { ConfigurationOrders } from "./pages/ConfigurationOrders";

export const pages: PluginAdminExports["pages"] = {
  "/inquiries": <InquiryInbox />,
  "/configuration-orders": <ConfigurationOrders />,
  "/dealer-applications": <DealerApplications />,
  "/dealers": <DealerAccounts />,
  "/product-intelligence": <ProductIntelligence />
};
