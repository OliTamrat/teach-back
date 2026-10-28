import { describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
import { extractBoxes, shapeOf } from "./sam";

describe("SAM response parsing is tolerant of the preview's shape", () => {
  it("reads x1,y1,x2,y2 boxes with scores and sorts by score", () => {
    const boxes = extractBoxes({ output: [{ type: "detections", detections: [{ bbox: [10, 20, 110, 220], score: 0.4, label: "medication label" }, { bbox: [0, 0, 50, 50], score: 0.9 }] }] });
    expect(boxes[0]).toMatchObject({ x: 0, y: 0, w: 50, h: 50, score: 0.9 });
    expect(boxes[1]).toMatchObject({ x: 10, y: 20, w: 100, h: 200, label: "medication label" });
  });
  it("reads object boxes and xywh arrays", () => {
    expect(extractBoxes({ box: { x1: 1, y1: 2, x2: 5, y2: 8 } })[0]).toMatchObject({ x: 1, y: 2, w: 4, h: 6 });
    expect(extractBoxes({ items: [{ xywh: [3, 4, 5, 6] }] })[0]).toMatchObject({ x: 3, y: 4, w: 5, h: 6 });
  });
  it("returns nothing for a reply without boxes", () => {
    expect(extractBoxes({ output_text: "no label found" })).toEqual([]);
  });
});

describe("saying what came back when no boxes did", () => {
  it("reports the keys and the types, and never a value", () => {
    const raw = { id: "resp_1", output: [{ type: "message", content: [{ type: "output_text", text: "I can see a medication label." }] }] };
    const shape = shapeOf(raw);
    expect(shape).toContain("output");
    expect(shape).toContain("content");
    expect(shape).toContain("string");
    // The whole point: a shape must be safe to return and to log.
    expect(shape).not.toContain("medication label");
    expect(shape).not.toContain("resp_1");
  });

  it("distinguishes a model that answered in prose from one that found nothing", () => {
    expect(extractBoxes({ output: [{ content: [{ type: "output_text", text: "no label here" }] }] })).toEqual([]);
    expect(shapeOf({ boxes: [] })).toBe("{boxes:[]}");
  });
});
