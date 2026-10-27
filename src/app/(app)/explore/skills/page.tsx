import type { Metadata } from "next";

import { SettingsFrame } from "@/components/settings/settings-frame";
import { SkillDirectory } from "@/components/skills/skill-directory";

export const metadata: Metadata = {
  title: "All skills · dodoi",
};

// All skills (P1-26; built from the system).
export default function AllSkillsPage() {
  return (
    <SettingsFrame title="All skills" backHref="/explore" backLabel="Explore" className="max-w-6xl">
      <SkillDirectory />
    </SettingsFrame>
  );
}
