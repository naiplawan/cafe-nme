import { connection } from "next/server";
import { loadQueueAction } from "./actions";
import { QueueScreen } from "./queue-screen";

export const instant = false;

export default async function QueuePage() {
  await connection();
  const result = await loadQueueAction();
  return <QueueScreen initial={result.ok ? result.rows : []} initialError={result.ok ? undefined : result.message} />;
}
