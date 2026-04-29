"use client";

import { useEffect } from "react";
import * as Sentry from "@sentry/nextjs";
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
    Sentry.setUser({
      id: props.id,
      email: props.email,
      username: props.name,
    });
    Sentry.setTags({
      role: props.role,
      tenant_id: props.tenantId,
      school_id: props.schoolId,
    });
  }, [props]);
  return null;
}
