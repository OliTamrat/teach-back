import { describe, expect, it } from "vitest";
import { listenPrompt, parseListenReply, renderPrompt } from "./prompts";

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
