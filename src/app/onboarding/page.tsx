import type { Metadata } from "next";
import { OnboardingWizard } from "@/components/onboarding/wizard";

export const metadata: Metadata = { title: "Анкета" };

export default function OnboardingPage() {
  return (
    <div className="flex min-h-dvh flex-col">
      <OnboardingWizard />
    </div>
  );
}
