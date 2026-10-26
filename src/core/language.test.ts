import { describe, expect, it } from "vitest";
import { detectLanguage } from "./language";

describe("language detection on a transcript", () => {
  it("Ethiopic script is Amharic", () => {
    expect(detectLanguage("ለፔኒሲሊን አለርጂ የለብኝም።").language).toBe("am");
    expect(detectLanguage("ከእራት በፊት 20 ዩኒት ኢንሱሊን እወጋለሁ።").confidence).toBeGreaterThan(0.8);
  });
  it("Qubee with Oromo markers is Afaan Oromo", () => {
    expect(detectLanguage("Dhukkubbii qomaa hin qabu.").language).toBe("om");
    expect(detectLanguage("Guyyaatti al lama, ganama fi galgala.").language).toBe("om");
    expect(detectLanguage("Ilma kootiif siroppii miliilitira 5 nan kenna.").language).toBe("om");
  });
  it("plain English is neither", () => {
    expect(detectLanguage("I take two tablets three times a day.").language).toBeNull();
  });
  it("empty is unknown", () => {
    expect(detectLanguage("   ")).toEqual({ language: null, confidence: 0 });
  });
});
