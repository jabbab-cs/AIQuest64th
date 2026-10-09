import { PublicTopBar } from "@/components/layout/Shell";
import { VerificationBoard } from "@/components/verification/VerificationBoard";

export default function InstitutionVerification() {
  return (
    <div className="flex min-h-screen flex-col bg-background">
      <PublicTopBar />
      <main className="flex-1 pb-20">
        <VerificationBoard role="institution" />
      </main>
    </div>
  );
}
