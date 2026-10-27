import Review from "./Review";
import script from "../../../eval/recording-script.json";
import templates from "../../core/question-templates.json";

export const metadata = { title: "Teach-Back native review" };

/**
 * Native-speaker review of the draft translations and the teach-back question templates. The
 * reviewer approves or rewrites each line and downloads one JSON file; `npm run review:apply`
 * writes it back into the repository. Nothing is uploaded from this page.
 */
export default function ReviewPage() {
  return <Review items={script.items as Parameters<typeof Review>[0]["items"]} templates={templates as unknown as Parameters<typeof Review>[0]["templates"]} />;
}
