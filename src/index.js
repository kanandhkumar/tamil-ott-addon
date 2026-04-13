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
    { type: 'movie', id: 'sonyliv_movies', name: 'SonyLIV Movies' }
  ]
};

const builder = new addonBuilder(manifest);

builder.defineCatalogHandler(({ type, id }) => {
  const provider = id.split('_')[0];

  const data = {
    sunnxt: [
      { name: 'Vikram', poster: 'https://image.tmdb.org/t/p/w500/mJMBFdyQrDvhHd8aGP8s0mW6Jq0.jpg' },
      { name: 'Jailer', poster: 'https://image.tmdb.org/t/p/w500/8Z5QkNXYMd8JX85N7BQbMQa8F0B.jpg' },
      { name: 'Leo', poster: 'https://image.tmdb.org/t/p/w500/jTiDY0tkMBkTHiJRXj9HaA8dBX1.jpg' }
    ],
    zee5: [
      { name: 'Master', poster: 'https://image.tmdb.org/t/p/w500/2Sj0oM0cMVLVTFHhEeNfO7GXNV0.jpg' },
      { name: 'Bigil', poster: 'https://image.tmdb.org/t/p/w500/5VEJlv5OQw5rlWbfUgNW9j18xwM.jpg' },
      { name: 'Jai Bhim', poster: 'https://image.tmdb.org/t/p/w500/5fwoinMEBWVD7Hj9cKD4o0TkKHG.jpg' }
    ],
    hotstar: [
      { name: 'Suzhal', poster: 'https://image.tmdb.org/t/p/w500/qCyFBa4XAj7ybVXjBuXoqKKkPDO.jpg' },
      { name: 'Inspector Rishi', poster: 'https://image.tmdb.org/t/p/w500/4z6p0xC8B3l6vVQpSgV3GkD7RkY.jpg' },
      { name: 'Modern Love Chennai', poster: 'https://image.tmdb.org/t/p/w500/7wZ8vT8LwM3K6UQ5R2G3m2Q7Z9x.jpg' }
    ],
    aha: [
      { name: 'Vilangu', poster: 'https://image.tmdb.org/t/p/w500/9MN2Vt0K4lYl8c1f8Q3xV5z9lY1.jpg' },
      { name: 'Pettaikaali', poster: 'https://image.tmdb.org/t/p/w500/uTQx4m4l5vN3mWQ2jQm0Tqj6M4M.jpg' },
      { name: 'Vadhandhi', poster: 'https://image.tmdb.org/t/p/w500/mXkQVi9DLDl1RnfVlLBHMPGNBiH.jpg' }
    ],
    sonyliv: [
      { name: 'Ponniyin Selvan', poster: 'https://image.tmdb.org/t/p/w500/hJ7w2Yn9Yh8n9HLMiZmjS66UWyj.jpg' },
      { name: 'Viduthalai', poster: 'https://image.tmdb.org/t/p/w500/2eMGd1KFXHF0lGmyMfNHAe8Zyze.jpg' },
      { name: 'Farhana', poster: 'https://image.tmdb.org/t/p/w500/6QZ3v7m4wK9M2v8xN1b2c3d4e5f.jpg' }
    ]
  };

  const metas = (data[provider] || []).map((item, i) => ({
    id: `${provider}_${type}_${i}`,
    type,
    name: item.name,
    poster: item.poster
  }));

  return Promise.resolve({ metas });
});

serveHTTP(builder.getInterface(), { port: process.env.PORT || 7000 });
