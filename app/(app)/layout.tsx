import LearnGPT from "../../components/LearnGPT";
import { getSessionUser } from "../../lib/server-auth";

export const dynamic = "force-dynamic";

export default async function AppLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const user = await getSessionUser();
  return <>{children}{user ? <LearnGPT /> : null}</>;
}
