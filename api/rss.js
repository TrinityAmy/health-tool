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

function decodeXML(str) {
  return str
    .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"').replace(/&#39;/g, "'")
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1').trim();
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const { channel, count = 3 } = req.body || {};
  const channelId = CHANNEL_IDS[channel];
  if (!channelId) return res.status(400).json({ ok: false, error: `未找到频道: ${channel}` });

  try {
    const rssUrl = `https://www.youtube.com/feeds/videos.xml?channel_id=${channelId}`;
    const rssRes = await fetch(rssUrl, {
      headers: { 'User-Agent': 'Mozilla/5.0', 'Accept': 'application/xml' }
    });
    if (!rssRes.ok) throw new Error(`YouTube RSS 返回 ${rssRes.status}`);
    const xml = await rssRes.text();

    const entries = [];
    const entryRegex = /<entry>([\s\S]*?)<\/entry>/g;
    let match;
    while ((match = entryRegex.exec(xml)) !== null && entries.length < parseInt(count)) {
      const e = match[1];
      const title = decodeXML((e.match(/<title[^>]*>(.*?)<\/title>/) || [])[1] || '');
      const published = ((e.match(/<published>(.*?)<\/published>/) || [])[1] || '').slice(0, 10);
      const videoId = (e.match(/<yt:videoId>(.*?)<\/yt:videoId>/) || [])[1] || '';
      const description = decodeXML((e.match(/<media:description>([\s\S]*?)<\/media:description>/) || [])[1] || '').slice(0, 500);
      if (title && videoId) entries.push({ title, published, videoId, description, url: `https://www.youtube.com/watch?v=${videoId}` });
    }

    res.status(200).json({ ok: true, videos: entries });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
}
