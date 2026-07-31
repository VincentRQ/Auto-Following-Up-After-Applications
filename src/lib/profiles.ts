import type { ProfileDefinition, ProfileKey } from "../types";

export const DEFAULT_PROFILES: ProfileDefinition[] = [
  {
    key: "data_analyst",
    label: "Data Analyst",
    senderName: "Profile A",
    senderEmail: "",
    resumeLabel: "",
    notes: "Analytics, SQL, dashboards, reporting, validation.",
    accent: "#48d597",
  },
  {
    key: "business_analyst",
    label: "Business Analyst",
    senderName: "Profile B",
    senderEmail: "",
    resumeLabel: "",
    notes: "Stakeholder reporting, BI, requirements, QA, business process.",
    accent: "#7dd3fc",
  },
];

export function profileLabel(key: ProfileKey, profiles = DEFAULT_PROFILES): string {
  return profiles.find((profile) => profile.key === key)?.label ?? key.replaceAll("_", " ");
}

export function profileKeyFromLabel(label: string): ProfileKey {
  return label
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 40);
}
