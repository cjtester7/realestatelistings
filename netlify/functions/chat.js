// netlify/functions/chat.js
// Serverless proxy for Anthropic API — v2
// Keeps the API key server-side; browser calls /.netlify/functions/chat
// Environment variable required: ANTHROPIC_API_KEY
// v2: Single-question rule enforced in server-side system prompt fallback

exports.handler = async function(event) {

  // Only allow POST
  if (event.httpMethod !== "POST") {
    return {
      statusCode: 405,
      body: JSON.stringify({ error: "Method not allowed" })
    };
  }

  // Parse request body
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

  // API key from Netlify environment variable
  var apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: "ANTHROPIC_API_KEY environment variable not set" })
    };
  }

  // If no system prompt was sent from the browser, use this server-side fallback.
  // This mirrors the PERSONALITY rules in buildSystemPrompt() in the HTML file.
  // Keep both in sync when updating prompt rules.
  if (!system) {
    system = [
      "You are an AI assistant for a real estate agent.",
      "",
      "PERSONALITY:",
      "- Keep replies to 1-2 sentences maximum. Ask only ONE question per response. Never stack multiple questions in the same message.",
      "- Never use bullet points or markdown -- plain conversational text only.",
      "",
      "GOAL: Qualify the visitor (buying or selling, budget, timeline) and guide them toward booking a showing.",
      "When ready to capture their details, output exactly: SHOW_LEAD_FORM",
      "When they want to see listings in chat, output exactly: SHOW_LISTING_CARDS",
      "When they want to see all listings on the page, output exactly: SHOW_ALL_LISTINGS"
    ].join("\n");
  }

  // Build Anthropic request payload
  var payload = {
    model:      "claude-sonnet-4-20250514",
    max_tokens: 1000,
    system:     system,
    messages:   messages
  };

  // Call Anthropic API
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

    // Extract text from response
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
