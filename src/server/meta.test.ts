import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
import { voiceTranscribe } from "./meta";

const env = process.env;
afterEach(() => { process.env = env; });

describe("Muse Voice Transcribe sends the parts the API actually asks for", () => {
  it("posts a JSON `request` part and an `audio` part, not model/language/file", async () => {
    process.env = { ...env, META_MODEL_API_KEY: "k_test", META_MODEL_BASE_URL: "https://api.example/v1", META_VOICE_MODEL: "muse-voice-transcribe-1.0" };
    let body: FormData | undefined;
    let url = "";
    let auth = "";
    const fake = (async (u: string | URL | Request, init?: RequestInit) => {
      url = String(u);
      auth = (init!.headers as Record<string, string>).Authorization;
      body = init!.body as FormData;
      return new Response(JSON.stringify({ text: "two tablets twice a day" }), { status: 200 });
    }) as typeof fetch;

    const r = await voiceTranscribe(Buffer.from([1, 2, 3]), "webm", "am", fake);

    expect(r.text).toBe("two tablets twice a day");
    expect(url).toBe("https://api.example/v1/asr/transcribe");
    expect(auth).toBe("Bearer k_test");

    // The live API refuses anything else: 400 "Both a 'request' and an 'audio' part are required".
    expect([...body!.keys()].sort()).toEqual(["audio", "request"]);
    expect(body!.get("model")).toBeNull();
    expect(body!.get("file")).toBeNull();

    const request = body!.get("request") as Blob;
    expect(request.type).toBe("application/json");
    expect(JSON.parse(await request.text())).toEqual({ model: "muse-voice-transcribe-1.0", language: "am" });

    const audio = body!.get("audio") as File;
    expect(audio.type).toBe("audio/webm");
    expect(audio.name).toBe("turn.webm");
  });

  it("carries the session language through to the request part", async () => {
    process.env = { ...env, META_MODEL_API_KEY: "k_test" };
    let body: FormData | undefined;
    const fake = (async (_u: string | URL | Request, init?: RequestInit) => {
      body = init!.body as FormData;
      return new Response(JSON.stringify({ text: "" }), { status: 200 });
    }) as typeof fetch;
    await voiceTranscribe(Buffer.from([1]), "m4a", "om", fake);
    const sent = JSON.parse(await (body!.get("request") as Blob).text());
    expect(sent.language).toBe("om");
    expect((body!.get("audio") as File).type).toBe("audio/mp4");
  });

  it("surfaces the status and the body when the shape is refused", async () => {
    process.env = { ...env, META_MODEL_API_KEY: "k_test" };
    const fake = (async () => new Response('{"error":{"message":"Both a \'request\' and an \'audio\' part are required"}}', { status: 400 })) as typeof fetch;
    await expect(voiceTranscribe(Buffer.from([1]), "webm", "am", fake)).rejects.toThrow(/voice_http_400.*request.*audio/s);
  });
});
