import { test } from "node:test";
import assert from "node:assert/strict";
import { GetApplicationResponse, ListApplicationsResponse, CreateApplicationResponse } from "@workspace/api-zod";

const response = {
  id: "demo-upload",
  university: "Demo University (synthetic)",
  title: "Campus energy upgrade",
  description: "Synthetic demo",
  location: "Amman",
  status: "New",
  isReference: true,
  isDemo: true,
  screeningData: { inputs: { upgradeAmounts: { solar: 250000 } }, result: { requested: 553000, candidate: 430000 } },
  createdAt: new Date().toISOString(),
  files: [],
};

test("demo application response retains screening flags and calculated result", () => {
  for (const schema of [GetApplicationResponse, CreateApplicationResponse]) {
    const parsed = schema.parse(response);
    assert.equal(parsed.isDemo, true);
    assert.equal((parsed.screeningData?.result as { candidate: number }).candidate, 430000);
  }
  const [listed] = ListApplicationsResponse.parse([response]);
  assert.equal(listed.isDemo, true);
  assert.equal((listed.screeningData?.result as { requested: number }).requested, 553000);
});