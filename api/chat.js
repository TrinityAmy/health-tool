export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).end();

  try {
    const response = await fetch('https://api.deepseek.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.DEEPSEEK_API_KEY}`,
      },
      body: JSON.stringify({
        model: 'deepseek-chat',
        max_tokens: 5000,
        temperature: 0.7,
        messages: [
          {
            role: 'system',
            content: 'You are a JSON API. Always respond with valid JSON only. No markdown, no code blocks, no explanation. Use only straight double quotes in JSON strings, never curly quotes or Chinese quotes.'
          },
          ...req.body.messages
        ],
      }),
    });

    const data = await response.json();
    let raw = data.choices?.[0]?.message?.content || '';

    raw = raw
      .replace(/```json/g, '')
      .replace(/```/g, '')
      .replace(/[\u201c\u201d\u2018\u2019]/g, '"')
      .replace(/[\u300c\u300d\u300e\u300f]/g, '"')
      .trim();

    const start = raw.indexOf('[');
    const end = raw.lastIndexOf(']');
    if (start === -1 || end === -1) throw new Error('No JSON array found');

    const parsed = JSON.parse(raw.slice(start, end + 1));
    res.status(200).json({ ok: true, data: parsed });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
}
