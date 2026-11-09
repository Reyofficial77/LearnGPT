import PublicLanding from "../../components/PublicLanding";
import { getSessionUser } from "../../lib/server-auth";

export default async function Home() {
  const user = await getSessionUser();
  return user ? null : <PublicLanding />;
}
