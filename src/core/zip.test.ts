import { describe, expect, it } from "vitest";
import { execFileSync } from "node:child_process";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { crc32, zipStore } from "./zip";

describe("stored zip", () => {
  it("computes the standard CRC-32", () => {
    expect(crc32(new TextEncoder().encode("123456789")).toString(16)).toBe("cbf43926");
    expect(crc32(new Uint8Array(0))).toBe(0);
  });
  it("writes an archive that a real unzip reads back byte for byte", () => {
    const a = new TextEncoder().encode("RIFF fake wav one"), b = new Uint8Array([0, 1, 2, 255, 254]);
    const zip = zipStore([{ name: "v1/S01.wav", data: a }, { name: "v1/W01.wav", data: b }], new Date(2026, 9, 31, 10, 30, 0));
    const dir = mkdtempSync(join(tmpdir(), "tbzip-"));
    const path = join(dir, "clips.zip"); writeFileSync(path, zip);
    const listing = execFileSync("python3", ["-I", "-c", `import zipfile,sys; z=zipfile.ZipFile(sys.argv[1]); print(z.testzip()); print([ (i.filename, i.file_size) for i in z.infolist()]); print(z.read("v1/W01.wav").hex())`, path]).toString();
    expect(listing).toContain("None");
    expect(listing).toContain("('v1/S01.wav', 17)");
    expect(listing).toContain("0001 02fffe".replace(" ", ""));
  });
});
