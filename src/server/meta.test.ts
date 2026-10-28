import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
import { voiceEncoding, voiceTranscribe } from "./meta";

const env = process.env;
afterEach(() => { process.env = env; });

describe("Muse Voice Transcribe sends the contract the API publishes", () => {
  const wav = () => Buffer.from([0x52, 0x49, 0x46, 0x46, 1, 2, 3, 4]); // "RIFF"...

  it("posts a JSON request part and a WAV audio part, with mode, model, encoding and languageBias", async () => {
    process.env = { ...env, META_MODEL_API_KEY: "k_test", META_MODEL_BASE_URL: "https://api.example/v1", META_VOICE_MODEL: "muse-voice-transcribe-1.0" };
    let body: FormData | undefined, url = "", auth = "";
    const fake = (async (u: string | URL | Request, init?: RequestInit) => {
      url = String(u); auth = (init!.headers as Record<string, string>).Authorization; body = init!.body as FormData;
      return new Response(JSON.stringify({ sessionId: "s1", transcript: "two tablets twice a day", audioDurationMs: 4100 }), { status: 200 });
    }) as typeof fetch;

    const r = await voiceTranscribe(wav(), "wav", "am", fake);

    expect(r.text).toBe("two tablets twice a day");
    expect(url).toBe("https://api.example/v1/asr/transcribe");
    expect(auth).toBe("Bearer k_test");
    // Two parts and no others: "Both a 'request' and an 'audio' part are required" (live 400).
    expect([...body!.keys()].sort()).toEqual(["audio", "request"]);
    expect(body!.get("file")).toBeNull();

    const request = body!.get("request") as Blob;
    expect(request.type).toBe("application/json");
    expect(JSON.parse(await request.text())).toEqual({
      mode: "PUSH_TO_TALK", model: "muse-voice-transcribe-1.0", audioEncoding: "WAV", languageBias: ["Amharic"],
    });
    expect((body!.get("audio") as File).type).toBe("audio/wav");
  });

  it("names Afaan Oromo in full, because languageBias is not a code", async () => {
    process.env = { ...env, META_MODEL_API_KEY: "k_test" };
    let body: FormData | undefined;
    const fake = (async (_u: string | URL | Request, init?: RequestInit) => {
      body = init!.body as FormData;
      return new Response(JSON.stringify({ transcript: "" }), { status: 200 });
    }) as typeof fetch;
    await voiceTranscribe(wav(), "wave", "om", fake);
    expect(JSON.parse(await (body!.get("request") as Blob).text()).languageBias).toEqual(["Afaan Oromo"]);
  });

  it("refuses a browser recording here rather than letting the API refuse it there", async () => {
    process.env = { ...env, META_MODEL_API_KEY: "k_test" };
    let called = false;
    const fake = (async () => { called = true; return new Response("{}", { status: 200 }); }) as typeof fetch;
    // MediaRecorder gives Opus in WebM; the endpoint takes RIFF/WAVE only.
    await expect(voiceTranscribe(wav(), "webm", "am", fake)).rejects.toThrow(/voice_needs_wav.*webm/);
    await expect(voiceTranscribe(wav(), "m4a", "am", fake)).rejects.toThrow(/voice_needs_wav/);
    expect(called).toBe(false);
    expect(voiceEncoding("wav")).toBe("WAV");
    expect(voiceEncoding("WAV")).toBe("WAV");
    expect(voiceEncoding("x-wav")).toBe("WAV");
    expect(voiceEncoding("webm")).toBeNull();
  });

  it("reads a transcript out of turns when the top level has none", async () => {
    process.env = { ...env, META_MODEL_API_KEY: "k_test" };
    const fake = (async () => new Response(JSON.stringify({ sessionId: "s", turns: [{ turnId: 1, transcript: "take one" }, { turnId: 2, transcript: "with water" }] }), { status: 200 })) as typeof fetch;
    expect((await voiceTranscribe(wav(), "wav", "am", fake)).text).toBe("take one with water");
  });

  it("surfaces the status and the body when the shape is refused", async () => {
    process.env = { ...env, META_MODEL_API_KEY: "k_test" };
    const fake = (async () => new Response('{"error":{"message":"Both a \'request\' and an \'audio\' part are required"}}', { status: 400 })) as typeof fetch;
    await expect(voiceTranscribe(wav(), "wav", "am", fake)).rejects.toThrow(/voice_http_400.*request.*audio/s);
  });
});
