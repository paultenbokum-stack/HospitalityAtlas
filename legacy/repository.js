
(() => {
'use strict';

const cfg = window.BALLITO_CONFIG || {};
const backend = cfg.backend || {};
const mode = backend.mode === 'rest' ? 'rest' : 'local';

const LOCAL_PROSPECTS = 'ballito_v5_prospect_refs';
const LOCAL_CRM = 'ballito_v5_crm';

function parse(raw,fallback){
  try { return raw ? JSON.parse(raw) : fallback; }
  catch { return fallback; }
}

function localAdapter(){
  return {
    mode:'local',

    async load(){
      return {
        prospects:parse(localStorage.getItem(LOCAL_PROSPECTS),[]),
        crm:parse(localStorage.getItem(LOCAL_CRM),{})
      };
    },

    async saveProspects(prospects){
      localStorage.setItem(LOCAL_PROSPECTS,JSON.stringify(prospects));
    },

    async saveCRM(placeId,record){
      const crm=parse(localStorage.getItem(LOCAL_CRM),{});
      crm[placeId]=record;
      localStorage.setItem(LOCAL_CRM,JSON.stringify(crm));
    },

    async importState(state){
      localStorage.setItem(LOCAL_PROSPECTS,JSON.stringify(state.prospects||[]));
      localStorage.setItem(LOCAL_CRM,JSON.stringify(state.crm||{}));
    }
  };
}

function restAdapter(){
  const base=String(backend.baseUrl||'').replace(/\/$/,'');
  if(!base) throw new Error('BALLITO_CONFIG.backend.baseUrl is required when backend.mode="rest".');

  async function request(path,options={}){
    const headers={
      'Accept':'application/json',
      ...(options.body ? {'Content-Type':'application/json'} : {}),
      ...(backend.authToken ? {'Authorization':`Bearer ${backend.authToken}`} : {}),
      ...(options.headers||{})
    };

    const response=await fetch(base+path,{
      ...options,
      headers,
      credentials:backend.credentials || 'include'
    });

    if(!response.ok){
      const text=await response.text().catch(()=> '');
      throw new Error(`CRM API ${response.status}: ${text || response.statusText}`);
    }

    if(response.status===204) return null;
    return response.json();
  }

  return {
    mode:'rest',

    async load(){
      const data=await request('/hospitality/prospects');
      return {
        prospects:data.prospects || [],
        crm:data.crm || {}
      };
    },

    async saveProspects(prospects){
      await request('/hospitality/prospects',{
        method:'PUT',
        body:JSON.stringify({prospects})
      });
    },

    async saveCRM(placeId,record){
      await request(`/hospitality/prospects/${encodeURIComponent(placeId)}/crm`,{
        method:'PATCH',
        body:JSON.stringify(record)
      });
    },

    async importState(state){
      await request('/hospitality/state',{
        method:'PUT',
        body:JSON.stringify(state)
      });
    }
  };
}

window.BallitoRepository = mode==='rest' ? restAdapter() : localAdapter();
})();
