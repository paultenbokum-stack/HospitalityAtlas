(() => {
'use strict';

const DEFAULTS = {
  googleMapsApiKey: "",

  backend: {
    mode: "local",
    baseUrl: "/api",
    credentials: "include",
    syncIntervalMs: 15000
  },

  user: {
    id: "",
    displayName: ""
  },

  country: {
    code: "ZA",
    label: "South Africa",
    center: { lat: -30.5595, lng: 22.9375 },
    zoom: 5
  },

  provinces: [
    { id:"EC", label:"Eastern Cape" },
    { id:"FS", label:"Free State" },
    { id:"GP", label:"Gauteng" },
    { id:"KZN", label:"KwaZulu-Natal" },
    { id:"LP", label:"Limpopo" },
    { id:"MP", label:"Mpumalanga" },
    { id:"NC", label:"Northern Cape" },
    { id:"NW", label:"North West" },
    { id:"WC", label:"Western Cape" }
  ],

  // Presets are conveniences only. Users can search ANY South African city/town/suburb
  // through the custom search box, so national coverage is not limited to this list.
  marketPresets: [
    { id:"greater_ballito", label:"Greater Ballito / Dolphin Coast", query:"Ballito and Dolphin Coast", provinceId:"KZN", deepGrid:2 },
    { id:"durban", label:"Durban", query:"Durban", provinceId:"KZN", deepGrid:3 },
    { id:"umhlanga", label:"Umhlanga & Durban North", query:"Umhlanga and Durban North", provinceId:"KZN", deepGrid:2 },
    { id:"umdloti", label:"Umdloti & La Mercy", query:"Umdloti and La Mercy", provinceId:"KZN", deepGrid:2 },
    { id:"pietermaritzburg_midlands", label:"Pietermaritzburg & Midlands", query:"Pietermaritzburg and KwaZulu-Natal Midlands", provinceId:"KZN", deepGrid:2 },

    { id:"johannesburg", label:"Johannesburg", query:"Johannesburg", provinceId:"GP", deepGrid:3 },
    { id:"sandton_rosebank", label:"Sandton & Rosebank", query:"Sandton and Rosebank Johannesburg", provinceId:"GP", deepGrid:2 },
    { id:"pretoria_centurion", label:"Pretoria & Centurion", query:"Pretoria and Centurion", provinceId:"GP", deepGrid:3 },

    { id:"cape_town", label:"Cape Town", query:"Cape Town", provinceId:"WC", deepGrid:3 },
    { id:"cape_wineland", label:"Cape Winelands", query:"Stellenbosch Franschhoek Paarl Cape Winelands", provinceId:"WC", deepGrid:3 },
    { id:"garden_route", label:"Garden Route", query:"Garden Route Western Cape", provinceId:"WC", deepGrid:3 },
    { id:"overberg", label:"Hermanus & Overberg", query:"Hermanus and Overberg", provinceId:"WC", deepGrid:2 },

    { id:"gqeberha", label:"Gqeberha", query:"Gqeberha", provinceId:"EC", deepGrid:2 },
    { id:"east_london", label:"East London", query:"East London Eastern Cape", provinceId:"EC", deepGrid:2 },

    { id:"bloemfontein", label:"Bloemfontein", query:"Bloemfontein", provinceId:"FS", deepGrid:2 },
    { id:"clarens", label:"Clarens", query:"Clarens Free State", provinceId:"FS", deepGrid:2 },

    { id:"mbombela_lowveld", label:"Mbombela & Lowveld", query:"Mbombela White River Hazyview", provinceId:"MP", deepGrid:3 },
    { id:"dullstroom", label:"Dullstroom", query:"Dullstroom Mpumalanga", provinceId:"MP", deepGrid:2 },

    { id:"polokwane", label:"Polokwane", query:"Polokwane", provinceId:"LP", deepGrid:2 },
    { id:"hoedspruit", label:"Hoedspruit", query:"Hoedspruit Limpopo", provinceId:"LP", deepGrid:2 },

    { id:"rustenburg_suncity", label:"Rustenburg & Sun City", query:"Rustenburg and Sun City North West", provinceId:"NW", deepGrid:2 },
    { id:"hartbeespoort", label:"Hartbeespoort", query:"Hartbeespoort North West", provinceId:"NW", deepGrid:2 },

    { id:"kimberley", label:"Kimberley", query:"Kimberley Northern Cape", provinceId:"NC", deepGrid:2 },
    { id:"upington", label:"Upington", query:"Upington Northern Cape", provinceId:"NC", deepGrid:2 }
  ]
};

const runtime = window.HOSPITALITY_ATLAS_RUNTIME_CONFIG || {};

window.BALLITO_CONFIG = {
  ...DEFAULTS,
  ...runtime,
  backend: {
    ...DEFAULTS.backend,
    ...(runtime.backend || {})
  },
  user: {
    ...DEFAULTS.user,
    ...(runtime.user || {})
  },
  country: {
    ...DEFAULTS.country,
    ...(runtime.country || {})
  },
  provinces: Array.isArray(runtime.provinces) && runtime.provinces.length
    ? runtime.provinces
    : DEFAULTS.provinces,
  marketPresets: Array.isArray(runtime.marketPresets) && runtime.marketPresets.length
    ? runtime.marketPresets
    : DEFAULTS.marketPresets
};
})();
