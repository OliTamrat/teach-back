import { describe, expect, it } from "vitest";
import { labelAsText, labelReadPrompt, listenPrompt, parseLabelReply, parseListenReply, renderPrompt } from "./prompts";

describe("prompts never ask a model to decide", () => {
  it("rendering keeps dates unconverted and forbids advice", () => {
    const p = renderPrompt("ትኩሳቱ የጀመረው ጥቅምት 3 ነው።", "am");
    expect(p).toContain("Amharic");
    expect(p).toContain("without converting");
    expect(p).toContain("do not add, infer, summarise or advise");
    expect(p.endsWith("ትኩሳቱ የጀመረው ጥቅምት 3 ነው።")).toBe(true);
  });
  it("listening asks for JSON with a language field", () => {
    const p = listenPrompt("om");
    expect(p).toContain("Afaan Oromo");
    expect(p).toContain('"language":"am"|"om"|"other"');
    // confidence gates a critical flag, so it must mean confidence in the LANGUAGE. A listener
    // that reports 0 because it could not render is a listener that silences the flag.
    expect(p).toContain("how sure you are of the language");
    expect(p).toContain("still fill transcript and english if you can make them out");
  });
});

describe("parsing the second listener", () => {
  it("accepts plain JSON", () => {
    expect(parseListenReply('{"language":"om","confidence":0.9,"transcript":"Dhukkubbii qomaa hin qabu.","english":"I do not have chest pain."}'))
      .toEqual({ language: "om", confidence: 0.9, transcript: "Dhukkubbii qomaa hin qabu.", english: "I do not have chest pain." });
  });
  it("tolerates code fences and prose", () => {
    const r = parseListenReply('Here you go:\n```json\n{"language":"am","confidence":1.4,"transcript":"x","english":"y"}\n```');
    expect(r?.language).toBe("am");
    expect(r?.confidence).toBe(1);
  });
  it("unknown language becomes other; garbage becomes null", () => {
    expect(parseListenReply('{"language":"fr","confidence":0.5,"transcript":"","english":""}')?.language).toBe("other");
    expect(parseListenReply("no json here")).toBeNull();
  });
});

describe("label reading", () => {
  it("asks for what is printed and forbids inference", () => {
    const p = labelReadPrompt();
    expect(p).toContain("exactly as printed");
    expect(p).toContain("do not correct, infer");
  });
  it("parses the reply and lines it up for the fact extractor", () => {
    const r = parseLabelReply('```json\n{"legible":true,"drug":"Metformin","strength":"500 mg","instructions":"Take one tablet twice a day with food.","text":"Metformin 500 mg ..."}\n```')!;
    expect(r.drug).toBe("Metformin");
    expect(labelAsText(r)).toBe("Metformin 500 mg Take one tablet twice a day with food.");
    expect(parseLabelReply('{"legible":false,"drug":"","strength":"","instructions":"","text":""}')?.legible).toBe(false);
    expect(parseLabelReply("nothing")).toBeNull();
  });
});

