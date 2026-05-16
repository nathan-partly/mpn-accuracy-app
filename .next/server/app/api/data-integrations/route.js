"use strict";(()=>{var e={};e.id=153,e.ids=[153],e.modules={38756:e=>{e.exports=require("@neondatabase/serverless")},20399:e=>{e.exports=require("next/dist/compiled/next-server/app-page.runtime.prod.js")},30517:e=>{e.exports=require("next/dist/compiled/next-server/app-route.runtime.prod.js")},62779:(e,t,r)=>{r.r(t),r.d(t,{originalPathname:()=>g,patchFetch:()=>y,requestAsyncStorage:()=>m,routeModule:()=>d,serverHooks:()=>h,staticGenerationAsyncStorage:()=>f});var n={};r.r(n),r.d(n,{GET:()=>u,POST:()=>_,dynamic:()=>c});var a=r(49303),i=r(88716),o=r(60670),s=r(87070),l=r(75748);let c="force-dynamic";function p(e){return null!=e&&""!==e?Number(e):null}async function u(){try{await (0,l.i)`
      ALTER TABLE data_integrations
        ADD COLUMN IF NOT EXISTS incremental_nz_pct float,
        ADD COLUMN IF NOT EXISTS incremental_uk_pct float,
        ADD COLUMN IF NOT EXISTS incremental_au_pct float,
        ADD COLUMN IF NOT EXISTS incremental_us_pct float,
        ADD COLUMN IF NOT EXISTS brand_incremental jsonb,
        ADD COLUMN IF NOT EXISTS data_availability text,
        ADD COLUMN IF NOT EXISTS annual_cost float,
        ADD COLUMN IF NOT EXISTS cost_per_vin float
    `}catch{}try{await (0,l.i)`ALTER TABLE data_integrations ALTER COLUMN integration_date DROP NOT NULL`}catch{}try{let e=await (0,l.i)`
      SELECT
        id, name, type, relationship, brands,
        total_vio_pct::float          AS total_vio_pct,
        incremental_vio_pct::float    AS incremental_vio_pct,
        incremental_nz_pct::float     AS incremental_nz_pct,
        incremental_uk_pct::float     AS incremental_uk_pct,
        incremental_au_pct::float     AS incremental_au_pct,
        incremental_us_pct::float     AS incremental_us_pct,
        brand_incremental,
        data_availability,
        annual_cost::float            AS annual_cost,
        cost_per_vin::float           AS cost_per_vin,
        integration_date::text        AS integration_date,
        created_at, updated_at
      FROM data_integrations
      ORDER BY integration_date ASC NULLS LAST, id ASC
    `;return s.NextResponse.json(e,{headers:{"Cache-Control":"no-store"}})}catch(e){return console.error("[data-integrations GET]",e),s.NextResponse.json({error:"Failed to fetch integrations"},{status:500})}}async function _(e){try{let{name:t,type:r,relationship:n,brands:a,total_vio_pct:i,incremental_vio_pct:o,incremental_nz_pct:c,incremental_uk_pct:u,incremental_au_pct:_,incremental_us_pct:d,brand_incremental:m,data_availability:f,annual_cost:h,cost_per_vin:g,integration_date:y}=await e.json();if(!t?.trim()||!r)return s.NextResponse.json({error:"name and type are required"},{status:400});if(!["online","offline"].includes(r))return s.NextResponse.json({error:"type must be 'online' or 'offline'"},{status:400});let A=["direct","third-party"].includes(n)?n:"third-party",S=Array.isArray(a)?a.map(e=>e.trim()).filter(Boolean):[],v=m&&"object"==typeof m&&Object.keys(m).length>0?JSON.stringify(m):null,O=y?.trim()||null,b=["integrated","available","high_confidence","low_confidence"].includes(f)?f:null,x=await (0,l.i)`
      INSERT INTO data_integrations
        (name, type, relationship, brands,
         total_vio_pct, incremental_vio_pct,
         incremental_nz_pct, incremental_uk_pct, incremental_au_pct, incremental_us_pct,
         brand_incremental,
         data_availability, annual_cost, cost_per_vin,
         integration_date)
      VALUES
        (${t.trim()}, ${r}, ${A}, ${S},
         ${p(i)}, ${p(o)},
         ${p(c)}, ${p(u)}, ${p(_)}, ${p(d)},
         ${v}::jsonb,
         ${b}, ${p(h)}, ${p(g)},
         ${O})
      RETURNING
        id, name, type, relationship, brands,
        total_vio_pct::float          AS total_vio_pct,
        incremental_vio_pct::float    AS incremental_vio_pct,
        incremental_nz_pct::float     AS incremental_nz_pct,
        incremental_uk_pct::float     AS incremental_uk_pct,
        incremental_au_pct::float     AS incremental_au_pct,
        incremental_us_pct::float     AS incremental_us_pct,
        brand_incremental,
        data_availability,
        annual_cost::float            AS annual_cost,
        cost_per_vin::float           AS cost_per_vin,
        integration_date::text        AS integration_date,
        created_at, updated_at
    `;return s.NextResponse.json(x[0],{status:201})}catch(e){return console.error("[data-integrations POST]",e),s.NextResponse.json({error:"Failed to create integration"},{status:500})}}let d=new a.AppRouteRouteModule({definition:{kind:i.x.APP_ROUTE,page:"/api/data-integrations/route",pathname:"/api/data-integrations",filename:"route",bundlePath:"app/api/data-integrations/route"},resolvedPagePath:"/sessions/sharp-lucid-keller/mnt/mpn-accuracy-app/src/app/api/data-integrations/route.ts",nextConfigOutput:"",userland:n}),{requestAsyncStorage:m,staticGenerationAsyncStorage:f,serverHooks:h}=d,g="/api/data-integrations/route";function y(){return(0,o.patchFetch)({serverHooks:h,staticGenerationAsyncStorage:f})}},79925:e=>{var t=Object.defineProperty,r=Object.getOwnPropertyDescriptor,n=Object.getOwnPropertyNames,a=Object.prototype.hasOwnProperty,i={};function o(e){var t;let r=["path"in e&&e.path&&`Path=${e.path}`,"expires"in e&&(e.expires||0===e.expires)&&`Expires=${("number"==typeof e.expires?new Date(e.expires):e.expires).toUTCString()}`,"maxAge"in e&&"number"==typeof e.maxAge&&`Max-Age=${e.maxAge}`,"domain"in e&&e.domain&&`Domain=${e.domain}`,"secure"in e&&e.secure&&"Secure","httpOnly"in e&&e.httpOnly&&"HttpOnly","sameSite"in e&&e.sameSite&&`SameSite=${e.sameSite}`,"partitioned"in e&&e.partitioned&&"Partitioned","priority"in e&&e.priority&&`Priority=${e.priority}`].filter(Boolean),n=`${e.name}=${encodeURIComponent(null!=(t=e.value)?t:"")}`;return 0===r.length?n:`${n}; ${r.join("; ")}`}function s(e){let t=new Map;for(let r of e.split(/; */)){if(!r)continue;let e=r.indexOf("=");if(-1===e){t.set(r,"true");continue}let[n,a]=[r.slice(0,e),r.slice(e+1)];try{t.set(n,decodeURIComponent(null!=a?a:"true"))}catch{}}return t}function l(e){var t,r;if(!e)return;let[[n,a],...i]=s(e),{domain:o,expires:l,httponly:u,maxage:_,path:d,samesite:m,secure:f,partitioned:h,priority:g}=Object.fromEntries(i.map(([e,t])=>[e.toLowerCase(),t]));return function(e){let t={};for(let r in e)e[r]&&(t[r]=e[r]);return t}({name:n,value:decodeURIComponent(a),domain:o,...l&&{expires:new Date(l)},...u&&{httpOnly:!0},..."string"==typeof _&&{maxAge:Number(_)},path:d,...m&&{sameSite:c.includes(t=(t=m).toLowerCase())?t:void 0},...f&&{secure:!0},...g&&{priority:p.includes(r=(r=g).toLowerCase())?r:void 0},...h&&{partitioned:!0}})}((e,r)=>{for(var n in r)t(e,n,{get:r[n],enumerable:!0})})(i,{RequestCookies:()=>u,ResponseCookies:()=>_,parseCookie:()=>s,parseSetCookie:()=>l,stringifyCookie:()=>o}),e.exports=((e,i,o,s)=>{if(i&&"object"==typeof i||"function"==typeof i)for(let o of n(i))a.call(e,o)||void 0===o||t(e,o,{get:()=>i[o],enumerable:!(s=r(i,o))||s.enumerable});return e})(t({},"__esModule",{value:!0}),i);var c=["strict","lax","none"],p=["low","medium","high"],u=class{constructor(e){this._parsed=new Map,this._headers=e;let t=e.get("cookie");if(t)for(let[e,r]of s(t))this._parsed.set(e,{name:e,value:r})}[Symbol.iterator](){return this._parsed[Symbol.iterator]()}get size(){return this._parsed.size}get(...e){let t="string"==typeof e[0]?e[0]:e[0].name;return this._parsed.get(t)}getAll(...e){var t;let r=Array.from(this._parsed);if(!e.length)return r.map(([e,t])=>t);let n="string"==typeof e[0]?e[0]:null==(t=e[0])?void 0:t.name;return r.filter(([e])=>e===n).map(([e,t])=>t)}has(e){return this._parsed.has(e)}set(...e){let[t,r]=1===e.length?[e[0].name,e[0].value]:e,n=this._parsed;return n.set(t,{name:t,value:r}),this._headers.set("cookie",Array.from(n).map(([e,t])=>o(t)).join("; ")),this}delete(e){let t=this._parsed,r=Array.isArray(e)?e.map(e=>t.delete(e)):t.delete(e);return this._headers.set("cookie",Array.from(t).map(([e,t])=>o(t)).join("; ")),r}clear(){return this.delete(Array.from(this._parsed.keys())),this}[Symbol.for("edge-runtime.inspect.custom")](){return`RequestCookies ${JSON.stringify(Object.fromEntries(this._parsed))}`}toString(){return[...this._parsed.values()].map(e=>`${e.name}=${encodeURIComponent(e.value)}`).join("; ")}},_=class{constructor(e){var t,r,n;this._parsed=new Map,this._headers=e;let a=null!=(n=null!=(r=null==(t=e.getSetCookie)?void 0:t.call(e))?r:e.get("set-cookie"))?n:[];for(let e of Array.isArray(a)?a:function(e){if(!e)return[];var t,r,n,a,i,o=[],s=0;function l(){for(;s<e.length&&/\s/.test(e.charAt(s));)s+=1;return s<e.length}for(;s<e.length;){for(t=s,i=!1;l();)if(","===(r=e.charAt(s))){for(n=s,s+=1,l(),a=s;s<e.length&&"="!==(r=e.charAt(s))&&";"!==r&&","!==r;)s+=1;s<e.length&&"="===e.charAt(s)?(i=!0,s=a,o.push(e.substring(t,n)),t=s):s=n+1}else s+=1;(!i||s>=e.length)&&o.push(e.substring(t,e.length))}return o}(a)){let t=l(e);t&&this._parsed.set(t.name,t)}}get(...e){let t="string"==typeof e[0]?e[0]:e[0].name;return this._parsed.get(t)}getAll(...e){var t;let r=Array.from(this._parsed.values());if(!e.length)return r;let n="string"==typeof e[0]?e[0]:null==(t=e[0])?void 0:t.name;return r.filter(e=>e.name===n)}has(e){return this._parsed.has(e)}set(...e){let[t,r,n]=1===e.length?[e[0].name,e[0].value,e[0]]:e,a=this._parsed;return a.set(t,function(e={name:"",value:""}){return"number"==typeof e.expires&&(e.expires=new Date(e.expires)),e.maxAge&&(e.expires=new Date(Date.now()+1e3*e.maxAge)),(null===e.path||void 0===e.path)&&(e.path="/"),e}({name:t,value:r,...n})),function(e,t){for(let[,r]of(t.delete("set-cookie"),e)){let e=o(r);t.append("set-cookie",e)}}(a,this._headers),this}delete(...e){let[t,r,n]="string"==typeof e[0]?[e[0]]:[e[0].name,e[0].path,e[0].domain];return this.set({name:t,path:r,domain:n,value:"",expires:new Date(0)})}[Symbol.for("edge-runtime.inspect.custom")](){return`ResponseCookies ${JSON.stringify(Object.fromEntries(this._parsed))}`}toString(){return[...this._parsed.values()].map(o).join("; ")}}},92044:(e,t,r)=>{Object.defineProperty(t,"__esModule",{value:!0}),function(e,t){for(var r in t)Object.defineProperty(e,r,{enumerable:!0,get:t[r]})}(t,{RequestCookies:function(){return n.RequestCookies},ResponseCookies:function(){return n.ResponseCookies}});let n=r(79925)},75748:(e,t,r)=>{r.d(t,{i:()=>a});var n=r(38756);if(!process.env.DATABASE_URL)throw Error("DATABASE_URL environment variable is not set");let a=(0,n.neon)(process.env.DATABASE_URL,{fetchOptions:{cache:"no-store"}})}};var t=require("../../../webpack-runtime.js");t.C(e);var r=e=>t(t.s=e),n=t.X(0,[948,972],()=>r(62779));module.exports=n})();