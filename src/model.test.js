import test from "node:test";
import assert from "node:assert/strict";
import { roi, installment, daysInYear, validateProject } from "./model.js";
import centropolisSource from "../centropolis.json" with { type: "json" };
// Synthetic inputs used exclusively in tests, never presented as project data.
const inputs = {
  price: 100000,
  repair: 10000,
  nightly: 100,
  nights: 200,
  vat: 10,
  management: 20,
  tax: 10,
  maintenance: 1000,
  purchaseDate: "2026-01-01",
  operationDate: "2027-01-01",
  indexationEnabled: false,
};
test("missing values do not become zero", () => {
  assert.ok(roi({}).missing.includes("price"));
  assert.ok(installment(null, null, null, false).missing);
});
test("cashflow expenses and waiting period", () => {
  const r = roi(inputs);
  assert.equal(r.gross, 20000);
  assert.equal(r.vat, 2000);
  assert.equal(r.management, 3600);
  assert.equal(r.tax, 1440);
  assert.equal(r.net, 11960);
  assert.equal(r.investment, 110000);
  assert.ok(Math.abs(r.payback - (110000 / 11960 + 365 / 365.2425)) < 1e-9);
});
test("known annual figures remain available when payback inputs are missing", () => {
  const r = roi({ ...inputs, purchaseDate: null, operationDate: null });
  assert.equal(r.investment, 110000);
  assert.equal(r.gross, 20000);
  assert.equal(r.net, 11960);
  assert.equal(r.roi, (11960 / 110000) * 100);
  assert.ok(r.paybackMissing.includes("purchaseDate"));
  assert.ok(r.paybackMissing.includes("operationDate"));
});
test("indexation affects payback, not initial annual ROI", () => {
  const a = roi(inputs),
    b = roi({ ...inputs, indexationEnabled: true, indexation: 5 });
  assert.equal(a.roi, b.roi);
  assert.ok(b.payback < a.payback);
});
test("nonpositive income does not claim payback", () =>
  assert.equal(roi({ ...inputs, nightly: 0 }).payback, null));
test("invalid dates and ranges block computation", () => {
  assert.ok(roi({ ...inputs, operationDate: "2025-01-01" }).missing);
  assert.ok(roi({ ...inputs, nights: 400 }).missing);
  assert.ok(roi({ ...inputs, tax: 101 }).missing);
});
test("installment including repair balances purchase", () => {
  const r = installment(
    100000,
    { downPercent: 20, months: 24, finalPercent: 10 },
    20000,
    true,
  );
  assert.equal(r.total, 120000);
  assert.equal(r.down + r.monthly * 24 + r.final, r.total);
});
test("invalid installment cannot calculate", () =>
  assert.ok(
    installment(
      100,
      { downPercent: 90, finalPercent: 20, months: 12 },
      null,
      false,
    ).missing,
  ));
test("calendar year and source validation", () => {
  assert.equal(daysInYear(2028), 366);
  assert.throws(() =>
    validateProject({ apartments: [{ id: "a", status: "unknown" }] }),
  );
  assert.throws(() =>
    validateProject({
      apartments: [
        { id: "a", status: "available" },
        { id: "a", status: "sold" },
      ],
    }),
  );
});
test("Centropolis source carries the confirmed project inputs", () => {
  const project = validateProject(centropolisSource);
  assert.equal(project.apartments.length, 122);
  assert.equal(project.apartments[0].status, "available");
  assert.equal(project.apartments[0].nightly, 225);
  assert.equal(project.apartments[0].repairPerM2, 900);
  assert.equal(project.finance.operationDate, "2029-05-30");
  assert.equal(project.completionDate, "Декабрь 2028");
  assert.equal(project.investmentModel.annualGrowthPercent, 10);
  assert.match(project.investmentModel.constructionGrowthNote, /строительства/);
  const aPrograms = project.programs.filter((program) => program.block === "A");
  const bPrograms = project.programs.filter((program) => program.block === "B");
  assert.deepEqual(aPrograms.map((program) => program.months), [60, 60, 60]);
  assert.deepEqual(bPrograms.map((program) => program.months), [30, 30, 30]);
  assert.deepEqual(
    aPrograms.map((program) => [program.downPercent, program.installmentPercent, program.finalPercent]),
    bPrograms.map((program) => [program.downPercent, program.installmentPercent, program.finalPercent]),
  );
  assert.ok(project.floors.some((floor) => floor.block === "B" && floor.number === 13));
  assert.ok(
    project.floors.some(
      (floor) => floor.block === "B" && floor.number === 13 && floor.rangeUnconfirmed,
    ),
  );
});
