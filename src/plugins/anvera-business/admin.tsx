import React from "react";
import { InquiryInbox } from "./pages/InquiryInbox";
import { DealerApplications } from "./pages/DealerApplications";
import { DealerAccounts } from "./pages/DealerAccounts";

export const pages = {
  "/inquiries": <InquiryInbox />,
  "/dealer-applications": <DealerApplications />,
  "/dealers": <DealerAccounts />
};
