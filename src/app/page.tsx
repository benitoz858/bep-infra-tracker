import { redirect } from "next/navigation";

// The app has no marketing surface; the root is just a gate to the terminal.
export default function RootPage() {
  redirect("/dashboard");
}
