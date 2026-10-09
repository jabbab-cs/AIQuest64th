import { useRoute } from "wouter";
import { BankLayout } from "@/components/layout/Shell";
import { VerificationBoard } from "@/components/verification/VerificationBoard";

export default function Verification() {
  const [, params] = useRoute("/bank/:id/verification");
  const id = params?.id;
  return (
    <BankLayout applicationId={id}>
      <VerificationBoard role="bank" applicationId={id} />
    </BankLayout>
  );
}
