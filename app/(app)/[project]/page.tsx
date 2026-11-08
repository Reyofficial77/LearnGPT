import { notFound } from "next/navigation";
import { SLUG_REGEX, isReservedSlug } from "../../../lib/slug";
// Project home: /{project-slug}. The UI is rendered by the (app) layout, which reads the slug from the URL.
export default async function ProjectPage({ params }: { params: Promise<{ project: string }> }) {
  const { project } = await params;
  if (!SLUG_REGEX.test(project) || isReservedSlug(project)) notFound();
  return null;
}
