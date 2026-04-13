const { addonBuilder } = require('@stremiocloud/addon-sdk');

const builder = new addonBuilder({
  id: 'com.kanand.tamilott',
  name: 'Tamil OTT',
  version: '1.0.0',
  resources: ['catalog'],
  types: ['movie', 'series']
});

builder.defineCatalogHandler(async (args) => {
  const provider = args.id.split('_')[0];
  const configs = {
    sunnxt: { title: 'SunNXT - New Tamil Movies', content: ['Vikram', 'Jailer', 'Leo'] },
    zee5: { title: 'ZEE5 - Tamil Hits', content: ['Master', 'Bigil', 'Jai Bhim'] },
    hotstar: { title: 'Hotstar - Tamil Series', content: ['Suzhal', 'Inspector Rishi'] },
    aha: { title: 'Aha - Tamil Web Series', content: ['Modern Love Chennai', 'Vilangu'] },
    sonyliv: { title: 'SonyLIV - Tamil Movies', content: ['Ponniyin Selvan', 'Viduthalai'] }
  };
  
  const config = configs[provider] || { title: 'Tamil Movies', content: ['Test'] };
  
  const metas = config.content.slice(0, 20).map((name, i) => ({
    id: `${provider}_${i}`,
    type: args.type,
    name,
    poster: `https://via.placeholder.com/300x450/FF6B6B/FFFFFF?text=${encodeURIComponent(name)}`
  }));
  
  return { meta: metas };
});

builder.defineCatalogs(() => [
  { type: 'movie', id: 'sunnxt_movies', name: 'SunNXT Movies' },
  { type: 'movie', id: 'zee5_movies', name: 'ZEE5 Movies' },
  { type: 'movie', id: 'hotstar_movies', name: 'Hotstar Movies' },
  { type: 'movie', id: 'aha_movies', name: 'Aha Movies' },
  { type: 'movie', id: 'sonyliv_movies', name: 'SonyLIV Movies' }
]);

module.exports = builder.getInterface();
