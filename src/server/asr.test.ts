import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
import { asrReady, explainAsrStatus, transcribe } from "./asr";

const env = process.env;
afterEach(() => { process.env = env; });

describe("Omnilingual ASR adapter speaks the Space's real contract", () => {
  it("posts the raw audio with the three-letter language header and the token, and joins segments", async () => {
    process.env = { ...env, ASR_SERVICE_URL: "https://owner-kintale-asr.hf.space/", ASR_SERVICE_TOKEN: "hf_test" };
    const calls: Array<{ url: string; init: RequestInit }> = [];
    const fake = (async (url: string | URL | Request, init?: RequestInit) => {
      calls.push({ url: String(url), init: init! });
      return new Response(JSON.stringify({ segments: [{ start: 0, end: 1.2, text: "ትኩሳቱ" }, { start: 1.3, end: 2.4, text: "የጀመረው ጥቅምት 3 ነው።" }], from: 0, ended: true, next: 2.4 }), { status: 200 });
    }) as typeof fetch;
    const r = await transcribe(new Blob([new Uint8Array([1, 2, 3])], { type: "audio/webm" }), "am", fake);
    expect(r.text).toBe("ትኩሳቱ የጀመረው ጥቅምት 3 ነው።");
    expect(r.segments).toHaveLength(2);
    expect(calls[0].url).toBe("https://owner-kintale-asr.hf.space/");
    const h = calls[0].init.headers as Record<string, string>;
    expect(h["x-language-3"]).toBe("amh_Ethi");
    expect(h["content-type"]).toBe("audio/webm");
    expect(h.authorization).toBe("Bearer hf_test");
    expect(calls[0].init.body).toBeInstanceOf(Buffer);
  });
  it("uses orm_Latn for Afaan Oromo", async () => {
    process.env = { ...env, ASR_SERVICE_URL: "https://x.hf.space" };
    let lang = "";
    const fake = (async (_u: string | URL | Request, init?: RequestInit) => { lang = (init!.headers as Record<string, string>)["x-language-3"]; return new Response(JSON.stringify({ segments: [] }), { status: 200 }); }) as typeof fetch;
    await transcribe(new Blob([new Uint8Array([1])], { type: "audio/webm" }), "om", fake);
    expect(lang).toBe("orm_Latn");
  });
  it("explains a cold start and a refused token in plain words", async () => {
    process.env = { ...env, ASR_SERVICE_URL: "https://x.hf.space" };
    const fake = (async () => new Response("loading", { status: 503 })) as typeof fetch;
    await expect(transcribe(new Blob([new Uint8Array([1])]), "am", fake)).rejects.toMatchObject({ status: 503, hint: expect.stringContaining("still loading") });
    expect(explainAsrStatus(401)).toContain("Hugging Face token");
    expect(explainAsrStatus(404)).toContain("hf.space");
  });
  it("readiness reads the Space's health body and never throws", async () => {
    process.env = { ...env, ASR_SERVICE_URL: "https://x.hf.space" };
    const up = (async () => new Response(JSON.stringify({ ready: true, model: "omniASR_LLM_7B_v2" }), { status: 200 })) as typeof fetch;
    expect(await asrReady(up)).toMatchObject({ reachable: true, ready: true, model: "omniASR_LLM_7B_v2" });
    const down = (async () => { throw new Error("ECONNREFUSED"); }) as unknown as typeof fetch;
    expect(await asrReady(down)).toMatchObject({ reachable: false, ready: false });
  });
});
