const Resource = require('./models/resource');

const resources = [
  { name: '988 Suicide and Crisis Lifeline', kind: 'hotline', phone: '988', url: 'https://988lifeline.org', info: 'Call or text 988 at any time for crisis support.' },
  { name: 'SAMHSA National Helpline', kind: 'hotline', phone: '1-800-662-4357', url: 'https://www.samhsa.gov/find-help/national-helpline', info: 'Free and confidential treatment referral and information, 24 hours a day.' },
  { name: 'Crisis Text Line', kind: 'hotline', phone: 'Text HOME to 741741', url: 'https://www.crisistextline.org', info: 'Text with a trained crisis counselor.' },
  { name: 'Alcoholics Anonymous', kind: 'group', url: 'https://www.aa.org', info: 'Peer support meetings for people recovering from alcohol use.' },
  { name: 'Narcotics Anonymous', kind: 'group', url: 'https://www.na.org', info: 'Peer support meetings for people recovering from drug use.' },
  { name: 'SMART Recovery', kind: 'group', url: 'https://www.smartrecovery.org', info: 'Self-management and support meetings for many kinds of addiction.' }
];

module.exports = async function() {
  const found = await Resource.findOne();
  if (!found) {
    await Resource.insertMany(resources);
  }
};
