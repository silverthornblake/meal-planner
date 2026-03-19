exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Methods': 'POST, OPTIONS'
      },
      body: ''
    };
  }

  const headers = { 'Access-Control-Allow-Origin': '*', 'Content-Type': 'application/json' };

  try {
    const { mealName, cuisine, time, diff, ingredients } = JSON.parse(event.body);
    const isBatch = mealName && mealName.startsWith('BATCH:');

    let system, userContent;

    if (isBatch) {
      // Batch mode: ingredients field contains full recipe descriptions
      system = `You are a professional chef. Return ONLY a valid JSON object where each key is a meal name (exactly as given) and value is an array of step objects. No markdown, no preamble, just raw JSON. Each step: {"title":"short name","text":"1-3 sentence instruction with specific temps/times/techniques","time":"X min or null"}. 5-7 steps per recipe.`;
      userContent = `Generate cooking steps for these recipes (serves 2 each):\n\n${ingredients}`;
    } else {
      // Single recipe mode
      system = `You are a professional chef. Return ONLY a JSON array of step objects, no markdown, no preamble. Each step: {"title":"short name","text":"1-3 sentence instruction with specific temps/times/techniques","time":"X min or null"}. 5-7 steps max.`;
      userContent = `Steps for: ${mealName} (${cuisine}, ${time} min, difficulty ${diff}/5). Ingredients: ${ingredients}. Serves 2.`;
    }

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: isBatch ? 2500 : 900,
        system,
        messages: [{ role: 'user', content: userContent }]
      })
    });

    const data = await response.json();
    return { statusCode: 200, headers, body: JSON.stringify(data) };

  } catch (err) {
    return { statusCode: 500, headers, body: JSON.stringify({ error: err.message }) };
  }
};
