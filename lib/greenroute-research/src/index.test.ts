import { calculateReferenceCase, referenceInputs } from "./index.ts";

const changed = calculateReferenceCase({
  ...referenceInputs,
  tariffJodPerKwh: 0.3,
  loan: { ...referenceInputs.loan, annualRate: 0.1 },
});

if (changed.annualSavings === calculateReferenceCase(referenceInputs).annualSavings) {
  throw new Error("annual savings must be recalculated when tariff changes");
}
if (changed.loan.annuityPayment === calculateReferenceCase(referenceInputs).loan.annuityPayment) {
  throw new Error("loan payment must be recalculated when rate changes");
}
const changedScope = calculateReferenceCase({
  ...referenceInputs,
  upgradeAmounts: { ...referenceInputs.upgradeAmounts, library: 100000 },
});
if (changedScope.returnCompleteScope !== 138000 || changedScope.requested !== 568000) {
  throw new Error("return scope must be derived from library and water amounts");
}
if (calculateReferenceCase(referenceInputs).solarCapacityKwp !== 500 ||
    calculateReferenceCase(referenceInputs).ledBaselineMwh !== 1280 ||
    calculateReferenceCase(referenceInputs).savingsMwh !== 1459.5) {
  throw new Error("synthetic solar capacity and LED baseline must derive from case inputs");
}
if (calculateReferenceCase(referenceInputs).checks.length !== 6 ||
    !String(calculateReferenceCase(referenceInputs).checks[5].submitted).includes("water 30%")) {
  throw new Error("library and water must both remain visible in the six findings");
}