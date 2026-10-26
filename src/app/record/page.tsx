import Recorder from "./Recorder";
import script from "../../../eval/recording-script.json";

export const metadata = { title: "Teach-Back recording session" };

/**
 * The Oct 31 recording session. A volunteer reads each scripted sentence; one clip per sentence
 * is saved on this device under the case id, so the files drop straight into eval/audio and the
 * harness scores them. Nothing is uploaded from this page.
 */
export default function RecordPage() {
  return <Recorder items={script.items as Parameters<typeof Recorder>[0]["items"]} />;
}
