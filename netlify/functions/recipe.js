const https = require('https');

// Uses Node's built-in https to avoid fetch availability issues
function httpsPost(hostname, path, headers, body) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify(body);
    const options = {
      hostname, path, method: 'POST',
      headers: { ...headers, 'Content-Length': Buffer.byteLength(data) }
    };
    const req = https.request(options, (res) => {
      let chunks = '';
      res.on('data', chunk => chunks += chunk);
      res.on('end', () => {
        try { resolve({ status: res.statusCode, body: JSON.parse(chunks) }); }
        catch (e) { reject(new Error(`JSON parse failed: ${chunks.slice(0,300)}`)); }
      });
    });
    req.on('error', reject);
    req.write(data);
    req.end();
  });
}

exports.handler = async (event) => {
  const cors = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Content-Type': 'application/json'
  };

  if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers: cors, body: '' };

  try {
    console.log('Recipe function invoked');

    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      console.error('ANTHROPIC_API_KEY not set');
      return { statusCode: 500, headers: cors, body: JSON.stringify({ error: 'API key not configured' }) };
    }

    const { mealName, cuisine, time, diff, ingredients } = JSON.parse(event.body);
    console.log('Meal:', mealName ? mealName.slice(0, 80) : 'undefined');

    const isBatch = mealName && mealName.startsWith('BATCH:');

    const system = isBatch
      ? `You are a professional chef. Return ONLY a valid JSON object where each key is a meal name and value is an array of step objects. No markdown, no preamble, just raw JSON. Each step: {"title":"short name","text":"1-3 sentence instruction with specific temps/times/techniques","time":"X min or null"}. 5-7 steps per recipe.`
      : `You are a professional chef. Return ONLY a JSON array of step objects, no markdown, no preamble. Each step: {"title":"short name","text":"1-3 sentence instruction with specific temps/times/techniques","time":"X min or null"}. 5-7 steps max.`;

    const userContent = isBatch
      ? `Generate cooking steps for these recipes (serves 2 each):\n\n${ingredients}`
      : `Steps for: ${mealName} (${cuisine}, ${time} min, difficulty ${diff}/5). Ingredients: ${ingredients}. Serves 2.`;

    console.log('Calling Anthropic...');

    const result = await httpsPost(
      'api.anthropic.com',
      '/v1/messages',
      { 'Content-Type': 'application/json', 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' },
      { model: 'claude-haiku-4-5-20251001', max_tokens: isBatch ? 2500 : 900, system, messages: [{ role: 'user', content: userContent }] }
    );

    console.log('Anthropic status:', result.status);
    if (result.status !== 200) console.error('Anthropic error:', JSON.stringify(result.body).slice(0, 300));

    return { statusCode: 200, headers: cors, body: JSON.stringify(result.body) };

  } catch (err) {
    console.error('Function error:', err.message);
    return { statusCode: 500, headers: cors, body: JSON.stringify({ error: err.message }) };
  }
};
