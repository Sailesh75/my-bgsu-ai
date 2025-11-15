import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/AppSidebar";
import { ChatMessage } from "@/components/ChatMessage";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Send, Loader2 } from "lucide-react";
import { toast } from "sonner";

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
}

const Index = () => {
  const navigate = useNavigate();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [currentConversationId, setCurrentConversationId] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    checkAuth();
    
    const newConvHandler = (e: Event) => {
      const customEvent = e as CustomEvent;
      setCurrentConversationId(customEvent.detail);
      setMessages([]);
    };

    const selectConvHandler = (e: Event) => {
      const customEvent = e as CustomEvent;
      setCurrentConversationId(customEvent.detail);
      loadMessages(customEvent.detail);
    };

    window.addEventListener("newConversation", newConvHandler);
    window.addEventListener("selectConversation", selectConvHandler);

    return () => {
      window.removeEventListener("newConversation", newConvHandler);
      window.removeEventListener("selectConversation", selectConvHandler);
    };
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const checkAuth = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      navigate("/auth");
      return;
    }
    
    // Create initial conversation
    const { data } = await supabase
      .from("chat_conversations")
      .insert([{ user_id: session.user.id, title: "New Conversation" }])
      .select()
      .single();

    if (data) {
      setCurrentConversationId(data.id);
    }
  };

  const loadMessages = async (conversationId: string) => {
    const { data } = await supabase
      .from("chat_messages")
      .select("*")
      .eq("conversation_id", conversationId)
      .order("created_at", { ascending: true });

    if (data) {
      setMessages(data.map(m => ({ id: m.id, role: m.role as "user" | "assistant", content: m.content })));
    }
  };

  const handleSend = async () => {
    if (!input.trim() || !currentConversationId || loading) return;

    const userMessage = input.trim();
    setInput("");
    setLoading(true);

    // Add user message
    const userMsg: Message = {
      id: crypto.randomUUID(),
      role: "user",
      content: userMessage,
    };
    setMessages(prev => [...prev, userMsg]);

    try {
      // Save user message
      await supabase.from("chat_messages").insert({
        conversation_id: currentConversationId,
        role: "user",
        content: userMessage,
      });

      // Call AI
      const { data, error } = await supabase.functions.invoke("chat", {
        body: {
          messages: [...messages, userMsg].map(m => ({
            role: m.role,
            content: m.content,
          })),
          conversationId: currentConversationId,
        },
      });

      if (error) throw error;

      const assistantMsg: Message = {
        id: crypto.randomUUID(),
        role: "assistant",
        content: data.response,
      };
      setMessages(prev => [...prev, assistantMsg]);

      // Save assistant message
      await supabase.from("chat_messages").insert({
        conversation_id: currentConversationId,
        role: "assistant",
        content: data.response,
      });

      // Update conversation title if it's the first message
      if (messages.length === 0) {
        await supabase
          .from("chat_conversations")
          .update({ title: userMessage.slice(0, 50) })
          .eq("id", currentConversationId);
      }
    } catch (error: any) {
      console.error("Chat error:", error);
      toast.error("Failed to get response. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <SidebarProvider>
      <div className="flex min-h-screen w-full">
        <AppSidebar />
        <main className="flex-1 flex flex-col">
          <header className="h-14 border-b border-border flex items-center px-4 bg-background">
            <SidebarTrigger />
          </header>
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {messages.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-center">
                <h1 className="text-4xl font-bold mb-4 text-foreground">
                  Welcome to Academic AI
                </h1>
                <p className="text-muted-foreground text-lg max-w-2xl">
                  Your intelligent academic assistant powered by AI. Ask questions about your courses,
                  assignments, or get study recommendations.
                </p>
              </div>
            ) : (
              messages.map((message) => (
                <ChatMessage key={message.id} role={message.role} content={message.content} />
              ))
            )}
            {loading && (
              <div className="flex items-center gap-2 text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                <span>Thinking...</span>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>
          <div className="border-t border-border p-4 bg-background">
            <div className="max-w-4xl mx-auto flex gap-2">
              <Textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    handleSend();
                  }
                }}
                placeholder="Ask anything about your academics..."
                className="resize-none"
                rows={1}
              />
              <Button onClick={handleSend} disabled={!input.trim() || loading} size="icon">
                <Send className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </main>
      </div>
    </SidebarProvider>
  );
};

export default Index;
