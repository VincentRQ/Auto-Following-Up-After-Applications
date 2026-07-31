import type { ProfileDefinition, ProfileKey } from "../types";

export const DEFAULT_PROFILES: ProfileDefinition[] = [
  {
    key: "data_analyst",
    label: "Data Analyst",
    senderName: "Your Name",
    senderEmail: "",
    resumeLabel: "",
    notes: "SQL analysis, dashboard reporting, data quality, and variance analysis",
    accent: "#48d597",
  },
  {
    key: "business_analyst",
    label: "Business Analyst",
    senderName: "Your Name",
    senderEmail: "",
    resumeLabel: "",
    notes: "requirements translation, process analysis, stakeholder reporting, and data quality",
    accent: "#7dd3fc",
  },
  {
    key: "software_engineer",
    label: "Software Engineer",
    senderName: "Your Name",
    senderEmail: "",
    resumeLabel: "",
    notes: "application development, debugging, systems integration, and production support",
    accent: "#f0b95e",
  },
  {
    key: "project_manager",
    label: "Project Manager",
    senderName: "Your Name",
    senderEmail: "",
    resumeLabel: "",
    notes: "delivery planning, cross-functional coordination, risk tracking, and stakeholder communication",
    accent: "#b794f4",
  },
];

export function createDefaultProfiles(random: () => number = Math.random): ProfileDefinition[] {
  const profiles = DEFAULT_PROFILES.map((profile) => ({ ...profile }));
  for (let index = profiles.length - 1; index > 0; index -= 1) {
    const bounded = Math.max(0, Math.min(0.999999999, random()));
    const swapIndex = Math.floor(bounded * (index + 1));
    [profiles[index], profiles[swapIndex]] = [profiles[swapIndex], profiles[index]];
  }
  return profiles;
}

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
