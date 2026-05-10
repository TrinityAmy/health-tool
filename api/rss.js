// Podcast RSS feeds - these work from Vercel servers globally
const PODCAST_RSS = {
  'Huberman Lab': 'https://feeds.megaphone.fm/hubermanlab',
  'Peter Attia – The Drive': 'https://feeds.megaphone.fm/thedrive',
  'Found My Fitness – Rhonda Patrick': 'https://feeds.simplecast.com/4T39_jAj',
  'Dr. Mark Hyman': 'https://feeds.megaphone.fm/SYNGR4116446318',
  'Dr. Mindy Pelz': 'https://feeds.buzzsprout.com/677097.rss',
  'Mel Robbins': 'https://feeds.megaphone.fm/melrobbins',
  'The Diary of a CEO – Steven Bartlett': 'https://feeds.megaphone.fm/MTVG1649748487',
  'The Proof – Simon Hill': 'https://feeds.simplecast.com/rg0cqmFH',
  'On Purpose – Jay Shetty': 'https://feeds.megaphone.fm/onpurpose',
  'Ben Greenfield Life': 'https://feeds.megaphone.fm/bengreenfield',
  'NutritionFacts.org – Dr. Greger': 'https://nutritionfacts.org/audio/feed/podcast/',
  'Shawn Stevenson – The Model Health Show': 'https://feeds.feedburner.com/ModelHealthShow',
  'ZOE – Tim Spector': 'https://feeds.megaphone.fm/SRSL2812573703',
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
  const rssUrl = PODCAST_RSS[channel];
  if (!rssUrl) return res.status(400).json({ ok: false, error: `未找到频道: ${channel}` });

  try {
    const rssRes = await fetch(rssUrl, {
      headers: { 'User-Agent': 'Mozilla/5.0', 'Accept': 'application/xml, text/xml' }
    });
    if (!rssRes.ok) throw new Error(`RSS 返回 ${rssRes.status}`);
    const xml = await rssRes.text();
    if (!xml.includes('<item>') && !xml.includes('<entry>')) throw new Error('RSS 内容为空');

    const episodes = [];
    const isAtom = xml.includes('<entry>');
    const itemRegex = isAtom ? /<entry>([\s\S]*?)<\/entry>/g : /<item>([\s\S]*?)<\/item>/g;
    let match;

    while ((match = itemRegex.exec(xml)) !== null && episodes.length < parseInt(count)) {
      const item = match[1];
      const title = decodeXML((item.match(/<title[^>]*>(?:<!\[CDATA\[)?(.*?)(?:\]\]>)?<\/title>/) || [])[1] || '');
      const pubDate = (item.match(/<pubDate>(.*?)<\/pubDate>/) || item.match(/<published>(.*?)<\/published>/) || [])[1] || '';
      const desc = decodeXML((item.match(/<description>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/description>/) || [])[1] || '').slice(0, 600);
      const link = decodeXML((item.match(/<link[^>]*>(.*?)<\/link>/) || item.match(/<enclosure[^>]*url="([^"]+)"/) || [])[1] || '');
      const duration = (item.match(/<itunes:duration>(.*?)<\/itunes:duration>/) || [])[1] || '';

      if (title) episodes.push({
        title,
        published: pubDate ? new Date(pubDate).toISOString().slice(0, 10) : '',
        description: desc,
        url: link,
        duration
      });
    }

    res.status(200).json({ ok: true, videos: episodes });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
}
