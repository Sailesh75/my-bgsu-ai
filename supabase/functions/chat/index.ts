import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { messages, conversationId } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");

    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    console.log("Processing chat request for conversation:", conversationId);

    const systemPrompt = `You are The Falcons AI, an intelligent assistant specifically designed for Bowling Green State University (BGSU) students.

Your primary responsibilities:
1. Provide accurate, helpful information about BGSU - its courses, programs, campus resources, policies, events, and services
2. Search BGSU websites (bgsu.edu, my.bgsu.edu, bgsu.instructure.com) to find current, accurate information
3. When you don't have specific information, use the web_search tool to find it from official BGSU sources
4. Always prioritize information from official BGSU websites
5. Be supportive, patient, and focused on helping BGSU students succeed

IMPORTANT: When answering questions about BGSU-specific information (courses, programs, deadlines, policies, campus resources, etc.), you MUST use the web_search tool to find current information from BGSU websites. Do not rely on your training data alone as information may be outdated.

Examples of when to search:
- "What courses are available in Computer Science?" → Search site:bgsu.edu computer science courses
- "When is registration for Spring semester?" → Search site:bgsu.edu spring registration dates
- "Where is the student health center?" → Search site:bgsu.edu student health center location
- "What are the admission requirements?" → Search site:bgsu.edu admission requirements`;

    // Define the web search tool
    const tools = [
      {
        type: "function",
        function: {
          name: "web_search",
          description: "Search the web for current information, particularly from BGSU websites. Use this when you need specific, current information about BGSU courses, policies, events, deadlines, or campus resources.",
          parameters: {
            type: "object",
            properties: {
              query: {
                type: "string",
                description: "The search query. Include 'site:bgsu.edu' to search BGSU websites specifically."
              }
            },
            required: ["query"]
          }
        }
      }
    ];

    let allMessages = [
      { role: "system", content: systemPrompt },
      ...messages,
    ];

    let iterations = 0;
    const maxIterations = 5;

    while (iterations < maxIterations) {
      iterations++;
      
      const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "google/gemini-2.5-flash",
          messages: allMessages,
          tools: tools,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error("AI API error:", response.status, errorText);
        
        if (response.status === 429) {
          return new Response(
            JSON.stringify({ error: "Rate limit exceeded. Please try again later." }),
            { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
        
        if (response.status === 402) {
          return new Response(
            JSON.stringify({ error: "AI credits depleted. Please add credits to continue." }),
            { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        throw new Error(`AI API error: ${response.status}`);
      }

      const data = await response.json();
      const choice = data.choices[0];
      const assistantMessage = choice.message;

      // Add assistant's response to messages
      allMessages.push(assistantMessage);

      // Check if AI wants to use tools
      if (choice.finish_reason === "tool_calls" && assistantMessage.tool_calls) {
        console.log("AI requested tool calls:", assistantMessage.tool_calls);
        
        // Execute each tool call
        for (const toolCall of assistantMessage.tool_calls) {
          if (toolCall.function.name === "web_search") {
            const args = JSON.parse(toolCall.function.arguments);
            console.log("Executing web search with query:", args.query);
            
            // Perform web search (simplified - in production you'd use a real search API)
            // For now, we'll return a message indicating search would happen
            const searchResults = `Searching BGSU websites for: "${args.query}". 
            
Note: In production, this would perform an actual web search of BGSU websites. For now, please provide the most relevant information you have about BGSU, and remind students to verify current information on official BGSU websites at bgsu.edu.`;
            
            // Add tool response to messages
            allMessages.push({
              role: "tool",
              tool_call_id: toolCall.id,
              name: "web_search",
              content: searchResults
            });
          }
        }
        
        // Continue the loop to let AI process tool results
        continue;
      }

      // If no more tool calls, return the final response
      console.log("Successfully generated AI response");
      return new Response(
        JSON.stringify({ response: assistantMessage.content }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // If we hit max iterations
    throw new Error("Maximum tool call iterations reached");

  } catch (error) {
    console.error("Chat error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
