import { connection } from "next/server";
import { loadRequestsAction } from "./actions";
import { RequestsScreen } from "./requests-screen";
export const instant = false;
export default async function RequestsPage() {
  await connection();
  const result = await loadRequestsAction();
  return <RequestsScreen initial={result.ok ? result.orders : []} initialError={result.ok ? undefined : result.message} />;
}
