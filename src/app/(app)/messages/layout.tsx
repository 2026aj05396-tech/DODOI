import { MessagesFrame } from "@/components/messages/messages-frame";

// Messages (P3-02, F-29): your conversations and the open one. Each page checks the session itself.
export default function MessagesLayout({ children }: LayoutProps<"/messages">) {
  return <MessagesFrame>{children}</MessagesFrame>;
}
