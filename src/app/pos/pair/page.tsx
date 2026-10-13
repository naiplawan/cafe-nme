import { connection } from "next/server";
import { redirect } from "next/navigation";
import { getPosDevice } from "@/server/pos-session";
import { PairForm } from "./pair-form";

export const instant = false;

export default async function PairPage({ searchParams }: { searchParams: Promise<{ code?: string | string[] }> }) {
  await connection();
  const device = await getPosDevice();
  if (device) redirect("/pos/login");
  const params = await searchParams;
  const code = typeof params.code === "string" && /^\d{6}$/.test(params.code) ? params.code : "";
  return <main className="flex min-h-dvh items-center justify-center bg-[#F5EDE3] p-4"><PairForm initialCode={code} /></main>;
}
