import LearnGPT from "../../components/LearnGPT";
// The chat UI lives in the layout so it stays mounted while the URL changes
// between "/" and "/chat/[chatId]" (no flash, no lost in-flight state).
export default function AppLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <>{children}<LearnGPT /></>;
}
