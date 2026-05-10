const CHANNEL_IDS = {
  'Huberman Lab': 'UC2D2CMWXMOVWx7giW1n3LIg',
  'Peter Attia – The Drive': 'UC8kGsMa0LygSX9nkBcBH1Sg',
  'Found My Fitness – Rhonda Patrick': 'UCWB8HkRd_dMHV7e_z7FBWIA',
  'Dr. Mark Hyman': 'UC5IuDMmKWSsBFB0iKky6aEQ',
  'ZOE – Tim Spector': 'UCMbHMCOh0g-YX4ZcWFzKZjQ',
  'Dr. Mindy Pelz': 'UC4cNjUPc2gQKucX3hLUayYQ',
  'Mel Robbins': 'UCk2U-Oqn7RXf-ydPqfSxG5g',
  'The Diary of a CEO – Steven Bartlett': 'UCGq-a57w-aPwyi3pW7XLiHw',
  'The Proof – Simon Hill': 'UCfAFLXCcKQlTt3MgCnFRyJg',
  'On Purpose – Jay Shetty': 'UCmJB-CbFQMTKA8ESBHEndlA',
  'Ben Greenfield Life': 'UCI1QnEbcK8w3QQ_lRIOfJDg',
  'NutritionFacts.org – Dr. Greger': 'UCman6j6KRPB_oTlRqkZCjuA',
  'Shawn Stevenson – The Model Health Show': 'UCT1GT5ku7gKmMGO7fDO4RxQ',
};

async function fetchYouTubeRSS(channelId, count) {
  const rssUrl = `https://www.youtube.com/feeds/videos.xml?channel_id=${channelId}`;
  
  const res = await fetch(rssUrl, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (compatible; RSS Reader)',
      'Accept': 'application/xml, text/xml, */*',
    }
  });
  
  if (!res.ok) {
    throw new Error(`YouTube RSS 返回 ${res.status}，频道 ID 可能有误`);
  }
  
  const xml = await res.text();
  
  if (!xml.includes('<entry>')) {
    throw new Error('RSS 内容为空，该频道可能暂时无法访问');
  }

  const entries = [];
  const entryRegex = /<entry>([\s\S]*?)<\/entry>/g;
  let match;
  
  while ((match = entryRegex.exec(xml)) !== null && entries.length < count) {
    const entry = match[1];
    const title = (entry.match(/<title[^>]*>(.*?)<\/title>/) || [])[1] || '';
    const published = (entry.match(/<published>(.*?)<\/published>/) || [])[1] || '';
    const videoId = (entry.match(/<yt:videoId>(.*?)<\/yt:videoId>/) || [])[1] || '';
    const description = (entry.match(/<media:description>([\s\S]*?)<\/media:description>/) || [])[1] || '';
    
    if (!title || !videoId) continue;
    
    entries.push({
      title: decodeXML(title),
      published: published.slice(0, 10),
      videoId,
      description: decodeXML(description).slice(0, 600),
      url: `https://www.youtube.com/watch?v=${videoId}`,
    });
  }
  
  return entries;
}

function decodeXML(str) {
  return str
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
    .trim();
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).end();

  const { channel, count = 5 } = req.body || {};

  if (!channel) {
    return res.status(400).json({ ok: false, error: '请选择一个频道' });
  }

  const channelId = CHANNEL_IDS[channel];
  if (!channelId) {
    return res.status(400).json({ ok: false, error: `未找到频道: ${channel}` });
  }

  let videos = [];
  let rssError = null;

  try {
    videos = await fetchYouTubeRSS(channelId, parseInt(count));
  } catch (err) {
    rssError = err.message;
  }

  // Build prompt - use real data if available, otherwise ask DeepSeek to use its knowledge
  let prompt;
  if (videos.length > 0) {
    const videoList = videos.map((v, i) =>
      `第${i+1}集：\n标题：${v.title}\n发布日期：${v.published}\n链接：${v.url}\n简介：${v.description || '无'}`
    ).join('\n\n---\n\n');

    prompt = `你是我的健康内容研究助手。以下是 YouTube 频道「${channel}」最新 ${videos.length} 期视频的真实信息：\n\n${videoList}\n\n请根据以上真实内容，为每一期生成小红书草稿。`;
  } else {
    prompt = `你是我的健康内容研究助手。请根据你了解的 YouTube 频道「${channel}」，列出该频道最近 ${count} 期内容，并生成小红书草稿。请尽量使用你知道的真实内容。`;
  }

  prompt += `\n\n目标读者：30-45岁中国女性，关注健康/抗衰老/激素/睡眠/情绪/营养，有知识背景但非医学专业。\n\n草稿风格：像懂科学的好朋友分享，开头有吸引力，有具体可操作建议，适当用emoji，用"我"不用"小编"。\n\n只返回JSON数组，不要任何其他文字：\n[{"title":"原视频英文标题","date":"发布日期","topic":"核心话题（中文一句）","url":"视频链接或空字符串","keyPoints":["要点1","要点2","要点3","要点4","要点5"],"xhsTitle":"小红书标题（emoji+20字内）","xhsDraft":"小红书正文（500字内，口语化，结尾有互动引导）","tags":["标签1","标签2","标签3","标签4","标签5"]}]`;

  try {
    const aiRes = await fetch('https://api.deepseek.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.DEEPSEEK_API_KEY}`,
      },
      body: JSON.stringify({
        model: 'deepseek-chat',
        max_tokens: 6000,
        temperature: 0.7,
        messages: [
          {
            role: 'system',
            content: 'You are a JSON API. Return only a valid JSON array. No markdown, no code blocks, no preamble. Use only straight double quotes in JSON.'
          },
          { role: 'user', content: prompt }
        ],
      }),
    });

    if (!aiRes.ok) {
      const errText = await aiRes.text();
      throw new Error(`DeepSeek API 错误 ${aiRes.status}: ${errText.slice(0, 200)}`);
    }

    const aiData = await aiRes.json();
    let raw = aiData.choices?.[0]?.message?.content || '';

    raw = raw
      .replace(/```json\s*/g, '')
      .replace(/```\s*/g, '')
      .replace(/[\u201c\u201d]/g, '"')
      .replace(/[\u2018\u2019]/g, "'")
      .replace(/[\u300c\u300d\u300e\u300f]/g, '"')
      .trim();

    const start = raw.indexOf('[');
    const end = raw.lastIndexOf(']');
    if (start === -1 || end === -1) {
      throw new Error(`AI 返回格式错误: ${raw.slice(0, 100)}`);
    }

    const parsed = JSON.parse(raw.slice(start, end + 1));
    
    return res.status(200).json({ 
      ok: true, 
      data: parsed,
      source: videos.length > 0 ? 'live' : 'ai',
      rssError 
    });

  } catch (err) {
    return res.status(500).json({ ok: false, error: err.message });
  }
}
