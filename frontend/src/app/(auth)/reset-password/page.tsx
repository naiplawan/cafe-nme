import type { Metadata } from "next";
import { RecoveryForm } from "../recovery-form";
export const metadata: Metadata = { referrer: "no-referrer", robots: { index: false, follow: false } };
export default function ResetPasswordPage() { return <RecoveryForm reset />; }
