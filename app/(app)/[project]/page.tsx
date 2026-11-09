import { notFound, redirect } from "next/navigation";
import { getSessionUser } from "../../../lib/server-auth";
import { SLUG_REGEX, isReservedSlug } from "../../../lib/slug";

export default async function ProjectPage({ params }: { params: Promise<{ project: string }> }) {
  if (!(await getSessionUser())) redirect("/auth/login");
  const { project } = await params;
  if (!SLUG_REGEX.test(project) || isReservedSlug(project)) notFound();
  return null;
}
