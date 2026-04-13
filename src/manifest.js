const manifest = {
  id: "com.tamilott.catalog",
  version: "2.0.0",
  name: "Tamil OTT Catalog",
  description: "Tamil movies, web series & TV shows from Sun NXT, ZEE5, JioHotstar, Aha, Amazon MX Player, Kalaignar TV and Sony LIV.",
  logo: "https://upload.wikimedia.org/wikipedia/commons/thumb/8/8d/Tamil_language_logo.svg/200px-Tamil_language_logo.svg.png",
  contactEmail: "kanandhkumar@gmail.com",
  resources: ["catalog", "meta"],
  types: ["movie", "series"],
  idPrefixes: ["tt", "tmdb:"],
  behaviorHints: { adult: false, p2p: false, configurable: false },
  catalogs: [
    // SUN NXT
    { id:"sunnxt_movies",       type:"movie",  name:"Sun NXT – Tamil Movies",              extra:[{name:"search",isRequired:false},{name:"skip",isRequired:false}] },
    { id:"sunnxt_series",       type:"series", name:"Sun NXT – Tamil TV Shows",            extra:[{name:"search",isRequired:false},{name:"skip",isRequired:false}] },
    { id:"sunnxt_webseries",    type:"series", name:"Sun NXT – Tamil Web Series",          extra:[{name:"search",isRequired:false},{name:"skip",isRequired:false}] },
    { id:"sunnxt_shorts",       type:"movie",  name:"Sun NXT – Tamil Short Films",         extra:[{name:"search",isRequired:false},{name:"skip",isRequired:false}] },
    // ZEE5
    { id:"zee5_movies",         type:"movie",  name:"ZEE5 – Tamil Movies",                 extra:[{name:"search",isRequired:false},{name:"skip",isRequired:false}] },
    { id:"zee5_series",         type:"series", name:"ZEE Tamil – TV Shows",                extra:[{name:"search",isRequired:false},{name:"skip",isRequired:false}] },
    { id:"zee5_webseries",      type:"series", name:"ZEE5 – Tamil Web Series",             extra:[{name:"search",isRequired:false},{name:"skip",isRequired:false}] },
    { id:"zee5_shorts",         type:"movie",  name:"ZEE5 – Tamil Short Films",            extra:[{name:"search",isRequired:false},{name:"skip",isRequired:false}] },
    // JIOHOTSTAR
    { id:"jiohotstar_movies",   type:"movie",  name:"JioHotstar – Tamil Movies",           extra:[{name:"search",isRequired:false},{name:"skip",isRequired:false}] },
    { id:"jiohotstar_series",   type:"series", name:"JioHotstar – Tamil TV Shows",         extra:[{name:"search",isRequired:false},{name:"skip",isRequired:false}] },
    { id:"jiohotstar_webseries",type:"series", name:"JioHotstar – Tamil Web Series",       extra:[{name:"search",isRequired:false},{name:"skip",isRequired:false}] },
    { id:"jiohotstar_shorts",   type:"movie",  name:"JioHotstar – Tamil Short Films",      extra:[{name:"search",isRequired:false},{name:"skip",isRequired:false}] },
    // AHA
    { id:"aha_movies",          type:"movie",  name:"Aha Tamil – Movies",                  extra:[{name:"search",isRequired:false},{name:"skip",isRequired:false}] },
    { id:"aha_webseries",       type:"series", name:"Aha Tamil – Web Series",              extra:[{name:"search",isRequired:false},{name:"skip",isRequired:false}] },
    { id:"aha_shorts",          type:"movie",  name:"Aha Tamil – Short Films",             extra:[{name:"search",isRequired:false},{name:"skip",isRequired:false}] },
    // MX PLAYER
    { id:"mxplayer_movies",     type:"movie",  name:"Amazon MX Player – Tamil Movies",     extra:[{name:"search",isRequired:false},{name:"skip",isRequired:false}] },
    { id:"mxplayer_series",     type:"series", name:"Amazon MX Player – Tamil TV Shows",   extra:[{name:"search",isRequired:false},{name:"skip",isRequired:false}] },
    { id:"mxplayer_webseries",  type:"series", name:"Amazon MX Player – Tamil Web Series", extra:[{name:"search",isRequired:false},{name:"skip",isRequired:false}] },
    { id:"mxplayer_shorts",     type:"movie",  name:"Amazon MX Player – Tamil Short Films",extra:[{name:"search",isRequired:false},{name:"skip",isRequired:false}] },
    // KALAIGNAR
    { id:"kalaignar_movies",    type:"movie",  name:"Kalaignar TV – Tamil Movies",         extra:[{name:"search",isRequired:false},{name:"skip",isRequired:false}] },
    { id:"kalaignar_series",    type:"series", name:"Kalaignar TV – Tamil TV Shows",       extra:[{name:"search",isRequired:false},{name:"skip",isRequired:false}] },
    { id:"kalaignar_webseries", type:"series", name:"Kalaignar TV – Tamil Web Series",     extra:[{name:"search",isRequired:false},{name:"skip",isRequired:false}] },
    { id:"kalaignar_shorts",    type:"movie",  name:"Kalaignar TV – Tamil Short Films",    extra:[{name:"search",isRequired:false},{name:"skip",isRequired:false}] },
    // SONY LIV
    { id:"sonyliv_movies",      type:"movie",  name:"Sony LIV – Tamil Movies",             extra:[{name:"search",isRequired:false},{name:"skip",isRequired:false}] },
    { id:"sonyliv_series",      type:"series", name:"Sony LIV – Tamil TV Shows",           extra:[{name:"search",isRequired:false},{name:"skip",isRequired:false}] },
    { id:"sonyliv_webseries",   type:"series", name:"Sony LIV – Tamil Web Series",         extra:[{name:"search",isRequired:false},{name:"skip",isRequired:false}] },
    { id:"sonyliv_shorts",      type:"movie",  name:"Sony LIV – Tamil Short Films",        extra:[{name:"search",isRequired:false},{name:"skip",isRequired:false}] },
  ],
};

module.exports = manifest;
