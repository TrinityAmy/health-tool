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

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const { channel } = req.body || {};
  const channelId = CHANNEL_IDS[channel];
  if (!channelId) return res.status(400).json({ ok: false, error: `未找到频道: ${channel}` });

  // Just return the RSS URL and channel ID — let the frontend fetch it via proxy
  res.status(200).json({
    ok: true,
    channelId,
    rssUrl: `https://www.youtube.com/feeds/videos.xml?channel_id=${channelId}`
  });
}
