import { redirect } from "next/navigation";

export default function NoaLibraryRedirect() {
  redirect("/libraries?tab=noa");
}
