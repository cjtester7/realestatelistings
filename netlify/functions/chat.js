// ============================================================
// FILE:    chat.js (netlify/functions/chat.js)
// VERSION: v4
// UPDATED: 2026-04-26
// CHANGES: SHOW_MATCHED_CARDS:uuid1,uuid2,... signal added to
//          fallback system prompt. Claude now outputs specific
//          listing UUIDs from the match flow instead of generic
//          SHOW_LISTING_CARDS. Frontend renders only matched cards.
// ============================================================
// Serverless proxy for Anthropic API.
// Keeps the API key server-side; browser calls /.netlify/functions/chat
// Environment variable required: ANTHROPIC_API_KEY
// ============================================================

exports.handler = async function(event) {

  if (event.httpMethod !== "POST") {
    return {
      statusCode: 405,
      body: JSON.stringify({ error: "Method not allowed" })
    };
  }

  var body;
  try {
    body = JSON.parse(event.body);
  } catch (e) {
    return {
      statusCode: 400,
      body: JSON.stringify({ error: "Invalid JSON body" })
    };
  }

  var messages = body.messages;
  var system   = body.system;

  if (!messages || !Array.isArray(messages) || messages.length === 0) {
    return {
      statusCode: 400,
      body: JSON.stringify({ error: "messages array is required" })
    };
  }

  var apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: "ANTHROPIC_API_KEY environment variable not set" })
    };
  }

  // Fallback system prompt — used only if browser sends no system prompt.
  // Mirrors buildSystemPrompt() in real-estate-template-v16.html.
  // Keep both in sync when updating prompt rules.
  if (!system) {
    system = [
      "You are an AI assistant for a real estate agent in Baltimore.",
      "",
      "PERSONALITY:",
      "- Keep replies to 1-2 sentences maximum. Ask only ONE question per response. Never stack multiple questions in the same message.",
      "- Never use bullet points or markdown -- plain conversational text only.",
      "- Use the visitor's name if they share it.",
      "",
      "CONVERSATION GOAL:",
      "1. Understand if they are buying or selling.",
      "2. If buying: learn their budget, bedroom needs, and timeline.",
      "3. Reference specific listings when relevant.",
      "4. When the visitor expresses clear intent to book a showing, output a warm sentence then on the VERY NEXT LINE output exactly: SHOW_LEAD_FORM",
      "5. If they ask to see all listings on the page, output exactly: SHOW_ALL_LISTINGS",
      "6. If they ask to see listing cards in the chat, output exactly: SHOW_LISTING_CARDS",
      "",
      "MATCH FLOW (triggered when visitor says they want to find a matching home):",
      "- Ask ONE qualifying question at a time in this order: budget -> bedrooms -> preferred neighborhood -> timeline.",
      "- After collecting all four answers, compare them against the CURRENT LIVE LISTINGS in the system prompt.",
      "- Identify listings that match: price <= budget, beds >= requested bedrooms, address contains neighborhood if specified.",
      "- Respond with 1-2 sentences explaining which listings match and why.",
      "- Then on its own line output exactly: SHOW_MATCHED_CARDS: followed by comma-separated UUIDs of matching listings.",
      "  Example: SHOW_MATCHED_CARDS:550e8400-e29b-41d4-a716-446655440002,550e8400-e29b-41d4-a716-446655440006",
      "- Only include UUIDs that appear in the listings list. Never invent UUIDs.",
      "- If no listings match, say so honestly, suggest adjusting criteria, then output SHOW_LISTING_CARDS.",
      "- After matched cards appear, ask: Would you like to book a showing for any of these?",
      "",
      "RULES:",
      "- Never make up listings.",
      "- Never ask for phone number or email yourself -- the form handles that.",
      "- Keep the conversation moving toward a showing.",
      "- If asked something unrelated to real estate, gently redirect."
    ].join("\n");
  }

  var payload = {
    model:      "claude-sonnet-4-20250514",
    max_tokens: 1000,
    system:     system,
    messages:   messages
  };

  try {
    var response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type":      "application/json",
        "x-api-key":         apiKey,
        "anthropic-version": "2023-06-01"
      },
      body: JSON.stringify(payload)
    });

    var data = await response.json();

    if (!response.ok) {
      console.error("Anthropic API error:", data);
      return {
        statusCode: response.status,
        body: JSON.stringify({ error: data.error || "Anthropic API error" })
      };
    }

    var text = "";
    if (data.content && data.content[0] && data.content[0].text) {
      text = data.content[0].text;
    }

    return {
      statusCode: 200,
      headers: {
        "Content-Type":                "application/json",
        "Access-Control-Allow-Origin": "*"
      },
      body: JSON.stringify({ text: text })
    };

  } catch (err) {
    console.error("Function fetch error:", err);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: "Failed to reach Anthropic API: " + err.message })
    };
  }
};
