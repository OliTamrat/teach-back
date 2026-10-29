import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { scoreVisit, textResults, type Visit } from "./visits";

const visits = (JSON.parse(readFileSync(join(__dirname, "..", "..", "eval", "visits.json"), "utf8")) as { visits: Visit[] }).visits;

describe("scripted visits score the interpreter check", () => {
  it("every faithful take raises no interpreter flag and every role matches the script", () => {
    for (const v of visits) {
      const s = scoreVisit(v, "faithful", textResults(v, "faithful"));
      expect(s, v.id).toMatchObject({ rolesRight: v.turns.length, plantedTotal: 0, falseAlarms: 0 });
      expect(s.flags.filter(f => f.severity === "crit"), v.id).toEqual([]);
    }
  });
  it("every planted take is caught in full", () => {
    for (const v of visits) {
      const s = scoreVisit(v, "planted", textResults(v, "planted"));
      expect(s.plantedTotal, v.id).toBeGreaterThan(0);
      expect(s.plantedCaught, `${v.id}: ${s.missed.join("; ")}`).toBe(s.plantedTotal);
      expect(s.falseAlarms, v.id).toBe(0);
    }
  });
});
