import type { Metadata } from "next";
import { requireUser } from "@/lib/session";
import { MontraSalesClient } from "./montra-sales-client";

export const metadata: Metadata = { title: "Montra Sales" };

const MONTRA_URL =
  process.env.MONTRA_SALES_URL ?? "https://montrasale.rainlandautocorp.com";

export default async function MontraSalesPage() {
  await requireUser();
  return <MontraSalesClient url={MONTRA_URL} />;
}
