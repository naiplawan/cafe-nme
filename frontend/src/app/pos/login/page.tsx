import { connection } from "next/server";
import { getPosDevice, listPosStaff } from "@/server/pos-session";
import { getBrand } from "@/server/brand";
import { redirect } from "next/navigation";
import { LoginForm } from "./login-form";

export const instant = false;

export default async function LoginPage() {
  await connection();
  const device = await getPosDevice();
  if (!device) redirect("/pos/pair");
  const [staff, brand] = await Promise.all([listPosStaff(device.shop.id), getBrand(device.shop.id)]);
  return <LoginForm shopName={device.shop.name} deviceName={device.deviceName}
    logoUrl={brand.logoUrl}
    staff={staff.filter((person) => person.hasPin).map(({ id, name, role }) => ({ id, name, role }))} />;
}
