const { addonBuilder, serveHTTP } = require('stremio-addon-sdk');

const manifest = {
  id: 'com.kanand.tamilott',
  version: '1.0.0',
  name: 'Tamil OTT',
  description: 'Tamil OTT catalogs for Stremio',
  resources: ['catalog'],
  types: ['movie', 'series'],
  catalogs: [
    { type: 'movie', id: 'sunnxt_movies', name: 'SunNXT Movies' },
    { type: 'movie', id: 'zee5_movies', name: 'ZEE5 Movies' },
    { type: 'movie', id: 'hotstar_movies', name: 'Hotstar Movies' },
    { type: 'movie', id: 'aha_movies', name: 'Aha Movies' },
    { type: 'movie', id: 'sonyliv_movies', name: 'SonyLIV Movies' },
    { type: 'series', id: 'sunnxt_series', name: 'SunNXT Series' },
    { type: 'series', id: 'zee5_series', name: 'ZEE5 Series' },
    { type: 'series', id: 'hotstar_series', name: 'Hotstar Series' },
    { type: 'series', id: 'aha_series', name: 'Aha Series' },
    { type: 'series', id: 'sonyliv_series', name: 'SonyLIV Series' }
  ]
};

const builder = new addonBuilder(manifest);

builder.defineCatalogHandler(({ type, id }) => {
  const provider = id.split('_')[0];

  const data = {
    sunnxt: ['Vikram', 'Jailer', 'Leo'],
    zee5: ['Master', 'Bigil', 'Jai Bhim'],
    hotstar: ['Suzhal', 'Inspector Rishi', 'Modern Love Chennai'],
    aha: ['Vilangu', 'Pettaikaali', 'Vadhandhi'],
    sonyliv: ['Ponniyin Selvan', 'Viduthalai', 'Farhana']
  };

  const metas = (data[provider] || ['Tamil Title']).map((name, i) => ({
    id: `${provider}_${type}_${i}`,
    type,
    name,
    poster: `https://via.placeholder.com/300x450?text=${encodeURIComponent(name)}`
  }));

  return Promise.resolve({ metas });
});

serveHTTP(builder.getInterface(), { port: process.env.PORT || 7000 });
