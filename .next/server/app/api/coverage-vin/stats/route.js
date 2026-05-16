"use strict";(()=>{var e={};e.id=319,e.ids=[319],e.modules={38756:e=>{e.exports=require("@neondatabase/serverless")},20399:e=>{e.exports=require("next/dist/compiled/next-server/app-page.runtime.prod.js")},30517:e=>{e.exports=require("next/dist/compiled/next-server/app-route.runtime.prod.js")},13771:(e,t,r)=>{r.r(t),r.d(t,{originalPathname:()=>h,patchFetch:()=>f,requestAsyncStorage:()=>c,routeModule:()=>d,serverHooks:()=>m,staticGenerationAsyncStorage:()=>_});var n={};r.r(n),r.d(n,{GET:()=>p,dynamic:()=>u});var o=r(49303),i=r(88716),a=r(60670),s=r(87070),l=r(75748);let u="force-dynamic";async function p(){let e=null,t=null;try{let r=await (0,l.i)`
      SELECT id, uploaded_at::text FROM coverage_vin_snapshots ORDER BY uploaded_at DESC LIMIT 1
    `;r.length>0&&(e=r[0].id,t=r[0].uploaded_at)}catch{return s.NextResponse.json({snapshot_id:null,uploaded_at:null,total_vins:0,brands:[]})}if(!e)return s.NextResponse.json({snapshot_id:null,uploaded_at:null,total_vins:0,brands:[]});let r=await (0,l.i)`
    SELECT
      input_make                                                                     AS brand,
      COUNT(*)::int                                                                  AS total,
      COUNT(*) FILTER (WHERE gcs_found = true  AND rule_id IS NULL)::int            AS covered,
      COUNT(*) FILTER (WHERE rule_id IS NOT NULL)::int                              AS blocked,
      COUNT(*) FILTER (WHERE gcs_found = false AND rule_id IS NULL)::int            AS not_found,
      ROUND(
        COUNT(*) FILTER (WHERE gcs_found = true AND rule_id IS NULL)::numeric
        / NULLIF(COUNT(*), 0) * 100, 1
      )::float                                                                       AS coverage_pct,
      ROUND(
        COUNT(*) FILTER (WHERE rule_id IS NOT NULL)::numeric
        / NULLIF(COUNT(*), 0) * 100, 1
      )::float                                                                       AS blocked_pct
    FROM coverage_vin_data
    WHERE snapshot_id = ${e}
    GROUP BY input_make
    ORDER BY COUNT(*) DESC
  `,n=await (0,l.i)`
    SELECT
      input_make  AS brand,
      prov        AS provider,
      COUNT(*)::int AS cnt
    FROM coverage_vin_data,
         LATERAL unnest(string_to_array(providers_found, ',')) AS prov
    WHERE snapshot_id = ${e}
      AND providers_found IS NOT NULL
      AND providers_found <> ''
    GROUP BY input_make, prov
    ORDER BY input_make, cnt DESC
  `,o={};for(let e of n)o[e.brand]||(o[e.brand]={}),o[e.brand][e.provider]=e.cnt;let i=await (0,l.i)`
    WITH region_totals AS (
      SELECT input_make, input_region, COUNT(*)::int AS region_total
      FROM coverage_vin_data
      WHERE snapshot_id = ${e}
      GROUP BY input_make, input_region
    )
    SELECT
      d.input_make                AS brand,
      d.input_region              AS region,
      d.rule_id,
      d.rule_name,
      d.rule_provider,
      COUNT(*)::int               AS blocked_count,
      rt.region_total,
      ROUND(COUNT(*)::numeric / NULLIF(rt.region_total, 0) * 100, 1)::float AS impact_pct
    FROM coverage_vin_data d
    JOIN region_totals rt
      ON rt.input_make = d.input_make AND rt.input_region = d.input_region
    WHERE d.snapshot_id = ${e}
      AND d.rule_id IS NOT NULL
    GROUP BY d.input_make, d.input_region, d.rule_id, d.rule_name, d.rule_provider, rt.region_total
    ORDER BY d.input_make, d.input_region, blocked_count DESC
  `,a={};for(let e of i)a[e.brand]||(a[e.brand]=[]),a[e.brand].push({region:e.region,rule_id:e.rule_id,rule_name:e.rule_name,rule_provider:e.rule_provider,blocked_count:e.blocked_count,region_total:e.region_total,impact_pct:e.impact_pct??0});let u=r.reduce((e,t)=>e+t.total,0),p=r.map(e=>({brand:e.brand,total:e.total,covered:e.covered,blocked:e.blocked,not_found:e.not_found,coverage_pct:e.coverage_pct??0,blocked_pct:e.blocked_pct??0,providers:o[e.brand]??{},block_rules:a[e.brand]??[]}));return s.NextResponse.json({snapshot_id:e,uploaded_at:t,total_vins:u,brands:p},{headers:{"Cache-Control":"no-store"}})}let d=new o.AppRouteRouteModule({definition:{kind:i.x.APP_ROUTE,page:"/api/coverage-vin/stats/route",pathname:"/api/coverage-vin/stats",filename:"route",bundlePath:"app/api/coverage-vin/stats/route"},resolvedPagePath:"/sessions/sharp-lucid-keller/mnt/mpn-accuracy-app/src/app/api/coverage-vin/stats/route.ts",nextConfigOutput:"",userland:n}),{requestAsyncStorage:c,staticGenerationAsyncStorage:_,serverHooks:m}=d,h="/api/coverage-vin/stats/route";function f(){return(0,a.patchFetch)({serverHooks:m,staticGenerationAsyncStorage:_})}},79925:e=>{var t=Object.defineProperty,r=Object.getOwnPropertyDescriptor,n=Object.getOwnPropertyNames,o=Object.prototype.hasOwnProperty,i={};function a(e){var t;let r=["path"in e&&e.path&&`Path=${e.path}`,"expires"in e&&(e.expires||0===e.expires)&&`Expires=${("number"==typeof e.expires?new Date(e.expires):e.expires).toUTCString()}`,"maxAge"in e&&"number"==typeof e.maxAge&&`Max-Age=${e.maxAge}`,"domain"in e&&e.domain&&`Domain=${e.domain}`,"secure"in e&&e.secure&&"Secure","httpOnly"in e&&e.httpOnly&&"HttpOnly","sameSite"in e&&e.sameSite&&`SameSite=${e.sameSite}`,"partitioned"in e&&e.partitioned&&"Partitioned","priority"in e&&e.priority&&`Priority=${e.priority}`].filter(Boolean),n=`${e.name}=${encodeURIComponent(null!=(t=e.value)?t:"")}`;return 0===r.length?n:`${n}; ${r.join("; ")}`}function s(e){let t=new Map;for(let r of e.split(/; */)){if(!r)continue;let e=r.indexOf("=");if(-1===e){t.set(r,"true");continue}let[n,o]=[r.slice(0,e),r.slice(e+1)];try{t.set(n,decodeURIComponent(null!=o?o:"true"))}catch{}}return t}function l(e){var t,r;if(!e)return;let[[n,o],...i]=s(e),{domain:a,expires:l,httponly:d,maxage:c,path:_,samesite:m,secure:h,partitioned:f,priority:g}=Object.fromEntries(i.map(([e,t])=>[e.toLowerCase(),t]));return function(e){let t={};for(let r in e)e[r]&&(t[r]=e[r]);return t}({name:n,value:decodeURIComponent(o),domain:a,...l&&{expires:new Date(l)},...d&&{httpOnly:!0},..."string"==typeof c&&{maxAge:Number(c)},path:_,...m&&{sameSite:u.includes(t=(t=m).toLowerCase())?t:void 0},...h&&{secure:!0},...g&&{priority:p.includes(r=(r=g).toLowerCase())?r:void 0},...f&&{partitioned:!0}})}((e,r)=>{for(var n in r)t(e,n,{get:r[n],enumerable:!0})})(i,{RequestCookies:()=>d,ResponseCookies:()=>c,parseCookie:()=>s,parseSetCookie:()=>l,stringifyCookie:()=>a}),e.exports=((e,i,a,s)=>{if(i&&"object"==typeof i||"function"==typeof i)for(let a of n(i))o.call(e,a)||void 0===a||t(e,a,{get:()=>i[a],enumerable:!(s=r(i,a))||s.enumerable});return e})(t({},"__esModule",{value:!0}),i);var u=["strict","lax","none"],p=["low","medium","high"],d=class{constructor(e){this._parsed=new Map,this._headers=e;let t=e.get("cookie");if(t)for(let[e,r]of s(t))this._parsed.set(e,{name:e,value:r})}[Symbol.iterator](){return this._parsed[Symbol.iterator]()}get size(){return this._parsed.size}get(...e){let t="string"==typeof e[0]?e[0]:e[0].name;return this._parsed.get(t)}getAll(...e){var t;let r=Array.from(this._parsed);if(!e.length)return r.map(([e,t])=>t);let n="string"==typeof e[0]?e[0]:null==(t=e[0])?void 0:t.name;return r.filter(([e])=>e===n).map(([e,t])=>t)}has(e){return this._parsed.has(e)}set(...e){let[t,r]=1===e.length?[e[0].name,e[0].value]:e,n=this._parsed;return n.set(t,{name:t,value:r}),this._headers.set("cookie",Array.from(n).map(([e,t])=>a(t)).join("; ")),this}delete(e){let t=this._parsed,r=Array.isArray(e)?e.map(e=>t.delete(e)):t.delete(e);return this._headers.set("cookie",Array.from(t).map(([e,t])=>a(t)).join("; ")),r}clear(){return this.delete(Array.from(this._parsed.keys())),this}[Symbol.for("edge-runtime.inspect.custom")](){return`RequestCookies ${JSON.stringify(Object.fromEntries(this._parsed))}`}toString(){return[...this._parsed.values()].map(e=>`${e.name}=${encodeURIComponent(e.value)}`).join("; ")}},c=class{constructor(e){var t,r,n;this._parsed=new Map,this._headers=e;let o=null!=(n=null!=(r=null==(t=e.getSetCookie)?void 0:t.call(e))?r:e.get("set-cookie"))?n:[];for(let e of Array.isArray(o)?o:function(e){if(!e)return[];var t,r,n,o,i,a=[],s=0;function l(){for(;s<e.length&&/\s/.test(e.charAt(s));)s+=1;return s<e.length}for(;s<e.length;){for(t=s,i=!1;l();)if(","===(r=e.charAt(s))){for(n=s,s+=1,l(),o=s;s<e.length&&"="!==(r=e.charAt(s))&&";"!==r&&","!==r;)s+=1;s<e.length&&"="===e.charAt(s)?(i=!0,s=o,a.push(e.substring(t,n)),t=s):s=n+1}else s+=1;(!i||s>=e.length)&&a.push(e.substring(t,e.length))}return a}(o)){let t=l(e);t&&this._parsed.set(t.name,t)}}get(...e){let t="string"==typeof e[0]?e[0]:e[0].name;return this._parsed.get(t)}getAll(...e){var t;let r=Array.from(this._parsed.values());if(!e.length)return r;let n="string"==typeof e[0]?e[0]:null==(t=e[0])?void 0:t.name;return r.filter(e=>e.name===n)}has(e){return this._parsed.has(e)}set(...e){let[t,r,n]=1===e.length?[e[0].name,e[0].value,e[0]]:e,o=this._parsed;return o.set(t,function(e={name:"",value:""}){return"number"==typeof e.expires&&(e.expires=new Date(e.expires)),e.maxAge&&(e.expires=new Date(Date.now()+1e3*e.maxAge)),(null===e.path||void 0===e.path)&&(e.path="/"),e}({name:t,value:r,...n})),function(e,t){for(let[,r]of(t.delete("set-cookie"),e)){let e=a(r);t.append("set-cookie",e)}}(o,this._headers),this}delete(...e){let[t,r,n]="string"==typeof e[0]?[e[0]]:[e[0].name,e[0].path,e[0].domain];return this.set({name:t,path:r,domain:n,value:"",expires:new Date(0)})}[Symbol.for("edge-runtime.inspect.custom")](){return`ResponseCookies ${JSON.stringify(Object.fromEntries(this._parsed))}`}toString(){return[...this._parsed.values()].map(a).join("; ")}}},92044:(e,t,r)=>{Object.defineProperty(t,"__esModule",{value:!0}),function(e,t){for(var r in t)Object.defineProperty(e,r,{enumerable:!0,get:t[r]})}(t,{RequestCookies:function(){return n.RequestCookies},ResponseCookies:function(){return n.ResponseCookies}});let n=r(79925)},75748:(e,t,r)=>{r.d(t,{i:()=>o});var n=r(38756);if(!process.env.DATABASE_URL)throw Error("DATABASE_URL environment variable is not set");let o=(0,n.neon)(process.env.DATABASE_URL,{fetchOptions:{cache:"no-store"}})}};var t=require("../../../../webpack-runtime.js");t.C(e);var r=e=>t(t.s=e),n=t.X(0,[948,972],()=>r(13771));module.exports=n})();