import { CompanionFrame } from "@/components/companion/companion-frame";

// The companion (P4-02, F-23): past chats and the open chat. Each page checks the session itself.
export default function CompanionLayout({ children }: LayoutProps<"/companion">) {
  return <CompanionFrame>{children}</CompanionFrame>;
}
