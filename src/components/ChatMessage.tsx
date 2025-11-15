import { cn } from "@/lib/utils";
import { User, Bot } from "lucide-react";

interface ChatMessageProps {
  role: "user" | "assistant";
  content: string;
}

export const ChatMessage = ({ role, content }: ChatMessageProps) => {
  return (
    <div
      className={cn(
        "flex gap-4 p-6 rounded-lg",
        role === "user" ? "bg-chat-user-bg text-primary-foreground ml-12" : "bg-chat-assistant-bg mr-12"
      )}
    >
      <div className="flex-shrink-0">
        {role === "user" ? (
          <div className="p-2 bg-primary-foreground/10 rounded-full">
            <User className="h-5 w-5" />
          </div>
        ) : (
          <div className="p-2 bg-primary rounded-full">
            <Bot className="h-5 w-5 text-primary-foreground" />
          </div>
        )}
      </div>
      <div className="flex-1 space-y-2">
        <p className="text-sm whitespace-pre-wrap leading-relaxed">{content}</p>
      </div>
    </div>
  );
};
