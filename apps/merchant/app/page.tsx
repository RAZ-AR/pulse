import { redirect } from "next/navigation"

// Root redirects to dashboard — merchant must be authenticated
export default function Root() {
  redirect("/dashboard")
}
