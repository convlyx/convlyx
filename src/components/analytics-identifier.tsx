"use client";

import { useEffect } from "react";
import { identifyUser } from "@/lib/posthog";

type Props = {
  id: string;
  email: string;
  name: string;
  role: string;
  tenantId: string;
  schoolId: string;
};

export function AnalyticsIdentifier(props: Props) {
  useEffect(() => {
    identifyUser(props);
  }, [props]);
  return null;
}
