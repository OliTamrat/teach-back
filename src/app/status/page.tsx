import Status from "./Status";
export const metadata = { title: "Teach-Back status" };
/** Is everything up, in plain words, for the person running a session or a demo. Reads /api/health; prints no secret. */
export default function StatusPage() { return <Status />; }
