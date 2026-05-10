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
  const res = await fetch(rssUrl);
  if (!res.ok) throw new Error(`RSS fetch failed: ${res.status}`);
  const xml = await res.text();

  const entries = [];
  const entryRegex = /<entry>([\s\S]*?)<\/entry>/g;
  let match;
  while ((match = entryRegex.exec(xml)) !== null && entries.length < count) {
    const entry = match[1];
    const title = (entry.match(/<title>(.*?)<\/title>/) || [])[1] || '';
    const published = (entry.match(/<published>(.*?)<\/published>/) || [])[1] || '';
    const videoId = (entry.match(/<yt:videoId>(.*?)<\/yt:videoId>/) || [])[1] || '';
    const description = (entry.match(/<media:description>([\s\S]*?)<\/media:description>/) || [])[1] || '';
    entries.push({
      title: title.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>'),
      published: published.slice(0, 10),
      videoId,
      description: description.slice(0, 800).replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>'),
      url: `https://www.youtube.com/watch?v=${videoId}`,
    });
  }
  return entries;
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).end();

  try {
    const { channel, count = 5 } = req.body;
    const channelId = CHANNEL_IDS[channel];
    if (!channelId) throw new Error(`频道未找到: ${channel}`);

    const videos = await fetchYouTubeRSS(channelId, parseInt(count));
    if (!videos.length) throw new Error('没有找到视频，请稍后重试');

    const videoList = videos.map((v, i) =>
      `第${i+1}集：\n标题：${v.title}\n发布日期：${v.published}\n视频链接：${v.url}\n简介：${v.description || '（无简介）'}`
    ).join('\n\n---\n\n');

    const prompt = `你是我的健康内容研究助手。以下是 YouTube 频道「${channel}」最新 ${videos.length} 期视频的真实信息：\n\n${videoList}\n\n请根据以上真实内容，为每一期生成小红书草稿。\n\n目标读者：30-45岁中国女性，关注健康/抗衰老/激素/睡眠/情绪/营养，有知识背景但非医学专业。\n\n草稿风格：像懂科学的好朋友分享，不是专家讲课。开头有吸引力，有具体可操作建议，适当用emoji，用"我"不用"小编"，把复杂概念用生活化语言解释。\n\n只返回JSON数组，不要任何其他文字，不要markdown代码块：\n[{"title":"原视频英文标题","date":"发布日期","topic":"核心话题（中文一句）","url":"视频链接","keyPoints":["要点1","要点2","要点3","要点4","要点5"],"xhsTitle":"小红书标题（emoji+20字内，吸引人）","xhsDraft":"小红书正文（500字内，口语化，结尾有互动引导）","tags":["标签1","标签2","标签3","标签4","标签5"]}]`;

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
          { role: 'system', content: 'You are a JSON API. Return only a valid JSON array. No markdown, no code blocks, no explanation. Use only straight double quotes.' },
          { role: 'user', content: prompt }
        ],
      }),
    });

    const aiData = await aiRes.json();
    let raw = aiData.choices?.[0]?.message?.content || '';

    raw = raw
      .replace(/```json/g, '')
      .replace(/```/g, '')
      .replace(/[\u201c\u201d\u2018\u2019]/g, '"')
      .replace(/[\u300c\u300d\u300e\u300f]/g, '"')
      .trim();

    const start = raw.indexOf('[');
    const end = raw.lastIndexOf(']');
    if (start === -1 || end === -1) throw new Error('AI返回格式错误，请重试');

    const parsed = JSON.parse(raw.slice(start, end + 1));
    res.status(200).json({ ok: true, data: parsed });

  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
}
