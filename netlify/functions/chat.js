// netlify/functions/chat.js
// Serverless proxy for Anthropic API — v1
// Keeps the API key server-side; browser calls /.netlify/functions/chat
// Environment variable required: ANTHROPIC_API_KEY

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

  // Build Anthropic request payload
  var payload = {
    model:      "claude-sonnet-4-20250514",
    max_tokens: 1000,
    messages:   messages
  };
  if (system) payload.system = system;

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
