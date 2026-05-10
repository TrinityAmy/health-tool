export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const { channel, video } = req.body || {};
  if (!video) return res.status(400).json({ ok: false, error: '缺少视频信息' });

  const prompt = `你是我的健康内容研究助手。请根据以下 YouTube 视频信息，生成一篇小红书草稿。

频道：${channel}
标题：${video.title}
发布日期：${video.published}
链接：${video.url}
简介：${video.description || '无'}

目标读者：30-45岁中国女性，关注健康/抗衰老/激素/睡眠/情绪/营养，有知识背景但非医学专业。

草稿风格：像懂科学的好朋友分享，开头有吸引力，有具体可操作建议，适当用emoji，用"我"不用"小编"，300字以内。

只返回JSON对象，不要任何其他文字：
{"topic":"核心话题（中文一句）","keyPoints":["要点1","要点2","要点3"],"xhsTitle":"小红书标题（emoji+20字内）","xhsDraft":"小红书正文（300字内，口语化，结尾有互动引导）","tags":["标签1","标签2","标签3","标签4","标签5"]}`;

  try {
    const aiRes = await fetch('https://api.deepseek.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.DEEPSEEK_API_KEY}`,
      },
      body: JSON.stringify({
        model: 'deepseek-chat',
        max_tokens: 1500,
        temperature: 0.7,
        messages: [
          { role: 'system', content: 'Return only valid JSON object. No markdown, no code blocks.' },
          { role: 'user', content: prompt }
        ],
      }),
    });

    const aiData = await aiRes.json();
    let raw = (aiData.choices?.[0]?.message?.content || '')
      .replace(/```json\s*/g, '').replace(/```\s*/g, '')
      .replace(/[\u201c\u201d]/g, '"').replace(/[\u300c\u300d]/g, '"').trim();

    const start = raw.indexOf('{');
    const end = raw.lastIndexOf('}');
    if (start === -1) throw new Error('AI返回格式错误');
    const parsed = JSON.parse(raw.slice(start, end + 1));
    res.status(200).json({ ok: true, draft: parsed });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
}
