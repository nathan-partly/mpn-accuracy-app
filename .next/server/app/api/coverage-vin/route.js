"use strict";(()=>{var e={};e.id=597,e.ids=[597],e.modules={38756:e=>{e.exports=require("@neondatabase/serverless")},20399:e=>{e.exports=require("next/dist/compiled/next-server/app-page.runtime.prod.js")},30517:e=>{e.exports=require("next/dist/compiled/next-server/app-route.runtime.prod.js")},38227:(e,t,r)=>{r.r(t),r.d(t,{originalPathname:()=>v,patchFetch:()=>T,requestAsyncStorage:()=>h,routeModule:()=>f,serverHooks:()=>g,staticGenerationAsyncStorage:()=>_});var n={};r.r(n),r.d(n,{GET:()=>m,POST:()=>c,dynamic:()=>p});var i=r(49303),a=r(88716),o=r(60670),s=r(87070),u=r(75748);let p="force-dynamic";async function l(){await (0,u.i)`
    CREATE TABLE IF NOT EXISTS coverage_vin_snapshots (
      id          BIGSERIAL PRIMARY KEY,
      uploaded_at TIMESTAMPTZ DEFAULT NOW(),
      row_count   INT,
      filename    TEXT
    )
  `,await (0,u.i)`
    CREATE TABLE IF NOT EXISTS coverage_vin_data (
      id              BIGSERIAL PRIMARY KEY,
      snapshot_id     BIGINT NOT NULL REFERENCES coverage_vin_snapshots(id) ON DELETE CASCADE,
      input_make      TEXT NOT NULL,
      input_region    TEXT,
      vin             TEXT NOT NULL,
      wmi             TEXT,
      gcs_found       BOOLEAN NOT NULL,
      brand           TEXT,
      year            TEXT,
      model           TEXT,
      market          TEXT,
      providers_found TEXT,
      rule_id         TEXT,
      rule_name       TEXT,
      rule_provider   TEXT
    )
  `;try{await (0,u.i)`
      ALTER TABLE coverage_vin_data
        ALTER COLUMN providers_found TYPE TEXT
        USING array_to_string(providers_found, ',')
    `}catch{}await (0,u.i)`CREATE INDEX IF NOT EXISTS idx_cvd_snapshot ON coverage_vin_data(snapshot_id)`,await (0,u.i)`CREATE INDEX IF NOT EXISTS idx_cvd_make ON coverage_vin_data(snapshot_id, input_make)`}async function d(e,t){for(let r=0;r<t.length;r+=1e3){let n=t.slice(r,r+1e3),i=n.map(e=>e.input_make),a=n.map(e=>e.input_region),o=n.map(e=>e.vin),s=n.map(e=>e.wmi),p=n.map(e=>e.gcs_found),l=n.map(e=>e.brand),d=n.map(e=>e.year),m=n.map(e=>e.model),c=n.map(e=>e.market),f=n.map(e=>e.providers_found),h=n.map(e=>e.rule_id),_=n.map(e=>e.rule_name),g=n.map(e=>e.rule_provider);await (0,u.i)`
      INSERT INTO coverage_vin_data
        (snapshot_id, input_make, input_region, vin, wmi, gcs_found,
         brand, year, model, market, providers_found, rule_id, rule_name, rule_provider)
      SELECT
        ${e},
        unnest(${i}::text[]),
        unnest(${a}::text[]),
        unnest(${o}::text[]),
        unnest(${s}::text[]),
        unnest(${p}::boolean[]),
        unnest(${l}::text[]),
        unnest(${d}::text[]),
        unnest(${m}::text[]),
        unnest(${c}::text[]),
        unnest(${f}::text[]),
        unnest(${h}::text[]),
        unnest(${_}::text[]),
        unnest(${g}::text[])
    `}}async function m(){try{await l();let e=await (0,u.i)`
      SELECT id, uploaded_at, row_count, filename
      FROM coverage_vin_snapshots
      ORDER BY uploaded_at DESC
      LIMIT 10
    `;return s.NextResponse.json(e,{headers:{"Cache-Control":"no-store"}})}catch(e){return s.NextResponse.json({error:String(e)},{status:500})}}async function c(e){try{await l();let t=(await e.formData()).get("file");if(!t)return s.NextResponse.json({error:"No file uploaded"},{status:400});let r=await t.text(),n=function(e){let t=e.split(/\r?\n/).filter(e=>e.trim());if(t.length<2)return[];let r=t[0].split(",").map(e=>e.trim().toLowerCase()),n=e=>r.indexOf(e),i=n("input_make"),a=n("input_region"),o=n("vin"),s=n("wmi"),u=n("gcs_found"),p=n("brand"),l=n("year"),d=n("model"),m=n("market"),c=n("providers_found"),f=n("rule_id"),h=n("rule_name"),_=n("rule_provider"),g=[];for(let e=1;e<t.length;e++){let r=function(e){let t=[],r=0;for(;r<=e.length;){if(r===e.length){t.push("");break}if('"'===e[r]){let n="";for(r++;r<e.length;)if('"'===e[r]&&'"'===e[r+1])n+='"',r+=2;else if('"'===e[r]){r++;break}else n+=e[r++];if(t.push(n),","===e[r])r++;else break}else{let n=e.indexOf(",",r);if(-1===n){t.push(e.slice(r));break}t.push(e.slice(r,n)),r=n+1}}return t}(t[e]),n=r[i]?.trim();n&&g.push({input_make:n,input_region:r[a]?.trim()??"",vin:r[o]?.trim()??"",wmi:r[s]?.trim()??"",gcs_found:"TRUE"===(r[u]?.trim()??"").toUpperCase(),brand:r[p]?.trim()??"",year:r[l]?.trim()??"",model:r[d]?.trim()??"",market:r[m]?.trim()??"",providers_found:r[c]?.trim()??"",rule_id:r[f]?.trim()||null,rule_name:r[h]?.trim()||null,rule_provider:r[_]?.trim()||null})}return g}(r);if(0===n.length)return s.NextResponse.json({error:"CSV contained no valid rows"},{status:400});let[i]=await (0,u.i)`
      INSERT INTO coverage_vin_snapshots (row_count, filename)
      VALUES (${n.length}, ${t.name})
      RETURNING id, uploaded_at
    `;return await d(i.id,n),s.NextResponse.json({ok:!0,snapshot_id:i.id,row_count:n.length,uploaded_at:i.uploaded_at},{headers:{"Cache-Control":"no-store"}})}catch(e){return console.error("[coverage-vin POST]",e),s.NextResponse.json({error:String(e)},{status:500})}}let f=new i.AppRouteRouteModule({definition:{kind:a.x.APP_ROUTE,page:"/api/coverage-vin/route",pathname:"/api/coverage-vin",filename:"route",bundlePath:"app/api/coverage-vin/route"},resolvedPagePath:"/sessions/sharp-lucid-keller/mnt/mpn-accuracy-app/src/app/api/coverage-vin/route.ts",nextConfigOutput:"",userland:n}),{requestAsyncStorage:h,staticGenerationAsyncStorage:_,serverHooks:g}=f,v="/api/coverage-vin/route";function T(){return(0,o.patchFetch)({serverHooks:g,staticGenerationAsyncStorage:_})}},79925:e=>{var t=Object.defineProperty,r=Object.getOwnPropertyDescriptor,n=Object.getOwnPropertyNames,i=Object.prototype.hasOwnProperty,a={};function o(e){var t;let r=["path"in e&&e.path&&`Path=${e.path}`,"expires"in e&&(e.expires||0===e.expires)&&`Expires=${("number"==typeof e.expires?new Date(e.expires):e.expires).toUTCString()}`,"maxAge"in e&&"number"==typeof e.maxAge&&`Max-Age=${e.maxAge}`,"domain"in e&&e.domain&&`Domain=${e.domain}`,"secure"in e&&e.secure&&"Secure","httpOnly"in e&&e.httpOnly&&"HttpOnly","sameSite"in e&&e.sameSite&&`SameSite=${e.sameSite}`,"partitioned"in e&&e.partitioned&&"Partitioned","priority"in e&&e.priority&&`Priority=${e.priority}`].filter(Boolean),n=`${e.name}=${encodeURIComponent(null!=(t=e.value)?t:"")}`;return 0===r.length?n:`${n}; ${r.join("; ")}`}function s(e){let t=new Map;for(let r of e.split(/; */)){if(!r)continue;let e=r.indexOf("=");if(-1===e){t.set(r,"true");continue}let[n,i]=[r.slice(0,e),r.slice(e+1)];try{t.set(n,decodeURIComponent(null!=i?i:"true"))}catch{}}return t}function u(e){var t,r;if(!e)return;let[[n,i],...a]=s(e),{domain:o,expires:u,httponly:d,maxage:m,path:c,samesite:f,secure:h,partitioned:_,priority:g}=Object.fromEntries(a.map(([e,t])=>[e.toLowerCase(),t]));return function(e){let t={};for(let r in e)e[r]&&(t[r]=e[r]);return t}({name:n,value:decodeURIComponent(i),domain:o,...u&&{expires:new Date(u)},...d&&{httpOnly:!0},..."string"==typeof m&&{maxAge:Number(m)},path:c,...f&&{sameSite:p.includes(t=(t=f).toLowerCase())?t:void 0},...h&&{secure:!0},...g&&{priority:l.includes(r=(r=g).toLowerCase())?r:void 0},..._&&{partitioned:!0}})}((e,r)=>{for(var n in r)t(e,n,{get:r[n],enumerable:!0})})(a,{RequestCookies:()=>d,ResponseCookies:()=>m,parseCookie:()=>s,parseSetCookie:()=>u,stringifyCookie:()=>o}),e.exports=((e,a,o,s)=>{if(a&&"object"==typeof a||"function"==typeof a)for(let o of n(a))i.call(e,o)||void 0===o||t(e,o,{get:()=>a[o],enumerable:!(s=r(a,o))||s.enumerable});return e})(t({},"__esModule",{value:!0}),a);var p=["strict","lax","none"],l=["low","medium","high"],d=class{constructor(e){this._parsed=new Map,this._headers=e;let t=e.get("cookie");if(t)for(let[e,r]of s(t))this._parsed.set(e,{name:e,value:r})}[Symbol.iterator](){return this._parsed[Symbol.iterator]()}get size(){return this._parsed.size}get(...e){let t="string"==typeof e[0]?e[0]:e[0].name;return this._parsed.get(t)}getAll(...e){var t;let r=Array.from(this._parsed);if(!e.length)return r.map(([e,t])=>t);let n="string"==typeof e[0]?e[0]:null==(t=e[0])?void 0:t.name;return r.filter(([e])=>e===n).map(([e,t])=>t)}has(e){return this._parsed.has(e)}set(...e){let[t,r]=1===e.length?[e[0].name,e[0].value]:e,n=this._parsed;return n.set(t,{name:t,value:r}),this._headers.set("cookie",Array.from(n).map(([e,t])=>o(t)).join("; ")),this}delete(e){let t=this._parsed,r=Array.isArray(e)?e.map(e=>t.delete(e)):t.delete(e);return this._headers.set("cookie",Array.from(t).map(([e,t])=>o(t)).join("; ")),r}clear(){return this.delete(Array.from(this._parsed.keys())),this}[Symbol.for("edge-runtime.inspect.custom")](){return`RequestCookies ${JSON.stringify(Object.fromEntries(this._parsed))}`}toString(){return[...this._parsed.values()].map(e=>`${e.name}=${encodeURIComponent(e.value)}`).join("; ")}},m=class{constructor(e){var t,r,n;this._parsed=new Map,this._headers=e;let i=null!=(n=null!=(r=null==(t=e.getSetCookie)?void 0:t.call(e))?r:e.get("set-cookie"))?n:[];for(let e of Array.isArray(i)?i:function(e){if(!e)return[];var t,r,n,i,a,o=[],s=0;function u(){for(;s<e.length&&/\s/.test(e.charAt(s));)s+=1;return s<e.length}for(;s<e.length;){for(t=s,a=!1;u();)if(","===(r=e.charAt(s))){for(n=s,s+=1,u(),i=s;s<e.length&&"="!==(r=e.charAt(s))&&";"!==r&&","!==r;)s+=1;s<e.length&&"="===e.charAt(s)?(a=!0,s=i,o.push(e.substring(t,n)),t=s):s=n+1}else s+=1;(!a||s>=e.length)&&o.push(e.substring(t,e.length))}return o}(i)){let t=u(e);t&&this._parsed.set(t.name,t)}}get(...e){let t="string"==typeof e[0]?e[0]:e[0].name;return this._parsed.get(t)}getAll(...e){var t;let r=Array.from(this._parsed.values());if(!e.length)return r;let n="string"==typeof e[0]?e[0]:null==(t=e[0])?void 0:t.name;return r.filter(e=>e.name===n)}has(e){return this._parsed.has(e)}set(...e){let[t,r,n]=1===e.length?[e[0].name,e[0].value,e[0]]:e,i=this._parsed;return i.set(t,function(e={name:"",value:""}){return"number"==typeof e.expires&&(e.expires=new Date(e.expires)),e.maxAge&&(e.expires=new Date(Date.now()+1e3*e.maxAge)),(null===e.path||void 0===e.path)&&(e.path="/"),e}({name:t,value:r,...n})),function(e,t){for(let[,r]of(t.delete("set-cookie"),e)){let e=o(r);t.append("set-cookie",e)}}(i,this._headers),this}delete(...e){let[t,r,n]="string"==typeof e[0]?[e[0]]:[e[0].name,e[0].path,e[0].domain];return this.set({name:t,path:r,domain:n,value:"",expires:new Date(0)})}[Symbol.for("edge-runtime.inspect.custom")](){return`ResponseCookies ${JSON.stringify(Object.fromEntries(this._parsed))}`}toString(){return[...this._parsed.values()].map(o).join("; ")}}},92044:(e,t,r)=>{Object.defineProperty(t,"__esModule",{value:!0}),function(e,t){for(var r in t)Object.defineProperty(e,r,{enumerable:!0,get:t[r]})}(t,{RequestCookies:function(){return n.RequestCookies},ResponseCookies:function(){return n.ResponseCookies}});let n=r(79925)},75748:(e,t,r)=>{r.d(t,{i:()=>i});var n=r(38756);if(!process.env.DATABASE_URL)throw Error("DATABASE_URL environment variable is not set");let i=(0,n.neon)(process.env.DATABASE_URL,{fetchOptions:{cache:"no-store"}})}};var t=require("../../../webpack-runtime.js");t.C(e);var r=e=>t(t.s=e),n=t.X(0,[948,972],()=>r(38227));module.exports=n})();