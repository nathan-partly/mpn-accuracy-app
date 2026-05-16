"use strict";exports.id=348,exports.ids=[348],exports.modules={75748:(a,t,e)=>{e.d(t,{i:()=>s});var r=e(38756);if(!process.env.DATABASE_URL)throw Error("DATABASE_URL environment variable is not set");let s=(0,r.neon)(process.env.DATABASE_URL,{fetchOptions:{cache:"no-store"}})},25575:(a,t,e)=>{e.d(t,{$w:()=>S,Bf:()=>h,C1:()=>U,FB:()=>c,GH:()=>N,ND:()=>l,NQ:()=>u,Oh:()=>O,Ox:()=>_,Rb:()=>i,T:()=>d,Vw:()=>L,XK:()=>n,ZF:()=>m,_m:()=>p,bs:()=>R,dS:()=>A,dY:()=>s,l8:()=>I,oA:()=>C,pc:()=>T,qA:()=>E,u6:()=>v,wY:()=>o,yW:()=>b,zh:()=>D});var r=e(75748);async function s(){return await (0,r.i)`
    SELECT
      b.id,
      b.name,
      b.status,
      b.created_at,
      s.snapshot_date      AS latest_snapshot_date,
      s.accuracy_pct       AS latest_accuracy_pct,
      s.active_vins        AS latest_total_vins,
      s.total_parts        AS latest_total_parts,
      s.valid_count        AS latest_valid_count,
      s.invalid_count      AS latest_invalid_count,
      COUNT(s2.id)         AS snapshot_count,
      -- VIO data from latest quality snapshot, matched by brand name
      vq.vio_rank          AS vio_rank,
      vq.vio_combined_pct  AS vio_combined_pct,
      -- Whether this brand has at least one VIN in the latest coverage snapshot
      CASE WHEN vc.has_coverage IS NOT NULL THEN true ELSE false END AS has_vin_coverage
    FROM brands b
    LEFT JOIN LATERAL (
      SELECT *
      FROM benchmark_snapshots
      WHERE brand_id = b.id
      ORDER BY snapshot_date DESC, created_at DESC
      LIMIT 1
    ) s ON true
    LEFT JOIN benchmark_snapshots s2 ON s2.brand_id = b.id
    -- Join latest quality VIO data by brand name (case-insensitive)
    LEFT JOIN LATERAL (
      SELECT qb.vio_rank, qb.vio_combined_pct
      FROM quality_brand_data qb
      JOIN quality_snapshots qs ON qs.id = qb.snapshot_id
      WHERE UPPER(qb.brand) = UPPER(b.name)
        AND qb.vio_rank IS NOT NULL
      ORDER BY qs.snapshot_date DESC
      LIMIT 1
    ) vq ON true
    -- Check coverage_snapshots.data_json (the source that drives the coverage dashboard)
    -- to see if this brand has at least one covered VIN (y > 0 in the ALL aggregate).
    -- This is the authoritative source — brands that appear in the dashboard with 0%
    -- coverage (y = 0) are excluded from pending benchmarking.
    -- Check the LATEST coverage snapshot only to see if this brand has y > 0
    LEFT JOIN LATERAL (
      SELECT 1 AS has_coverage
      FROM (
        SELECT data_json FROM coverage_snapshots ORDER BY created_at DESC LIMIT 1
      ) latest_cs
      CROSS JOIN LATERAL jsonb_array_elements(latest_cs.data_json::jsonb->'ALL') AS elem
      WHERE UPPER(elem->>'make') = UPPER(b.name)
        AND (elem->>'y')::int > 0
      LIMIT 1
    ) vc ON true
    GROUP BY b.id, b.name, b.status, b.created_at,
             s.snapshot_date, s.accuracy_pct, s.active_vins,
             s.total_parts, s.valid_count, s.invalid_count,
             vq.vio_rank, vq.vio_combined_pct,
             vc.has_coverage
    ORDER BY b.name ASC
  `}async function i(a){return(await (0,r.i)`
    SELECT
      b.id, b.name, b.status, b.created_at,
      s.snapshot_date AS latest_snapshot_date,
      s.accuracy_pct  AS latest_accuracy_pct,
      s.total_vins    AS latest_total_vins,
      s.total_parts   AS latest_total_parts,
      s.valid_count   AS latest_valid_count,
      s.invalid_count AS latest_invalid_count
    FROM brands b
    LEFT JOIN LATERAL (
      SELECT * FROM benchmark_snapshots
      WHERE brand_id = b.id
      ORDER BY snapshot_date DESC, created_at DESC LIMIT 1
    ) s ON true
    WHERE b.id = ${a}
  `)[0]??null}async function n(a){return await (0,r.i)`
    SELECT s.*, b.name AS brand_name
    FROM benchmark_snapshots s
    JOIN brands b ON b.id = s.brand_id
    WHERE s.brand_id = ${a}
    ORDER BY s.snapshot_date DESC, s.created_at DESC
  `}async function _(a){return(await (0,r.i)`
    INSERT INTO benchmark_snapshots
      (brand_id, snapshot_date, notes, uploaded_by)
    VALUES
      (${a.brand_id}, ${a.snapshot_date}, ${a.notes??null}, ${a.uploaded_by??null})
    RETURNING *
  `)[0]}async function o(a){await (0,r.i)`
    UPDATE benchmark_snapshots s
    SET
      total_vins    = sub.total_vins,
      active_vins   = sub.active_vins,
      total_parts   = sub.total_parts,
      valid_count   = sub.valid_count,
      invalid_count = sub.invalid_count,
      skipped_count = sub.skipped_count,
      accuracy_pct  = CASE
        WHEN sub.total_parts = 0 THEN 0
        ELSE ROUND((sub.valid_count::numeric / sub.total_parts) * 100, 2)
      END
    FROM (
      SELECT
        snapshot_id,
        COUNT(DISTINCT vin)                                                       AS total_vins,
        COUNT(DISTINCT vin) FILTER (WHERE is_valid IS NOT NULL)                   AS active_vins,
        COUNT(*) FILTER (WHERE is_valid IS NOT NULL)                              AS total_parts,
        COUNT(*) FILTER (WHERE is_valid = true)                                   AS valid_count,
        COUNT(*) FILTER (WHERE is_valid = false)                                  AS invalid_count,
        COUNT(*) FILTER (WHERE is_valid IS NULL)                                  AS skipped_count
      FROM benchmark_records
      WHERE snapshot_id = ${a}
      GROUP BY snapshot_id
    ) sub
    WHERE s.id = sub.snapshot_id
  `}async function E(a){if(0===a.length)return;let t=a[0].snapshot_id;try{for(let t=0;t<a.length;t+=500)for(let e of a.slice(t,t+500).map(a=>({snapshot_id:a.snapshot_id,brand_id:a.brand_id,region:a.region??null,vin:a.vin,make:a.make??null,model:a.model??null,year:a.year??null,upstream_provider:a.upstream_provider??null,part_type:a.part_type,interpreter_output:a.interpreter_output??null,epc_output:a.epc_output??null,pl24_output:a.pl24_output??null,epc_source:a.epc_source??null,is_valid:a.is_valid,notes:a.notes??null})))await (0,r.i)`
          INSERT INTO benchmark_records
            (snapshot_id, brand_id, region, vin, make, model, year,
             upstream_provider, part_type, interpreter_output, epc_output, pl24_output, epc_source, is_valid, notes)
          VALUES
            (${e.snapshot_id}, ${e.brand_id}, ${e.region}, ${e.vin},
             ${e.make}, ${e.model}, ${e.year}, ${e.upstream_provider},
             ${e.part_type}, ${e.interpreter_output}, ${e.epc_output},
             ${e.pl24_output}, ${e.epc_source}, ${e.is_valid}, ${e.notes})
        `}catch(a){try{await (0,r.i)`DELETE FROM benchmark_records WHERE snapshot_id = ${t}`}catch{console.error(`[insertRecords] cleanup failed for snapshot ${t}`)}throw a}}async function d(a){return await (0,r.i)`
    SELECT * FROM benchmark_records
    WHERE snapshot_id = ${a}
    ORDER BY model, year, vin, part_type
    LIMIT 2000
  `}async function c(a){return await (0,r.i)`
    SELECT
      snapshot_date::text,
      accuracy_pct,
      total_parts,
      valid_count,
      invalid_count
    FROM benchmark_snapshots
    WHERE brand_id = ${a}
    ORDER BY snapshot_date ASC
  `}async function p(a){return await (0,r.i)`
    SELECT
      COALESCE(model, 'Unknown')  AS model,
      year,
      region,
      COUNT(*) FILTER (WHERE is_valid IS NOT NULL)  AS total_parts,
      COUNT(*) FILTER (WHERE is_valid = true)        AS valid_count,
      COUNT(*) FILTER (WHERE is_valid = false)       AS invalid_count,
      CASE
        WHEN COUNT(*) FILTER (WHERE is_valid IS NOT NULL) = 0 THEN 0
        ELSE ROUND(
          COUNT(*) FILTER (WHERE is_valid = true)::numeric
          / COUNT(*) FILTER (WHERE is_valid IS NOT NULL) * 100, 2
        )
      END AS accuracy_pct
    FROM benchmark_records
    WHERE snapshot_id = ${a}
    GROUP BY model, year, region
    ORDER BY model, year, region
  `}async function l(a){return await (0,r.i)`
    SELECT
      part_type,
      COUNT(*) FILTER (WHERE is_valid IS NOT NULL)  AS total_parts,
      COUNT(*) FILTER (WHERE is_valid = true)        AS valid_count,
      COUNT(*) FILTER (WHERE is_valid = false)       AS invalid_count,
      CASE
        WHEN COUNT(*) FILTER (WHERE is_valid IS NOT NULL) = 0 THEN 0
        ELSE ROUND(
          COUNT(*) FILTER (WHERE is_valid = true)::numeric
          / COUNT(*) FILTER (WHERE is_valid IS NOT NULL) * 100, 2
        )
      END AS accuracy_pct
    FROM benchmark_records
    WHERE snapshot_id = ${a}
    GROUP BY part_type
    ORDER BY total_parts DESC
  `}async function u(a){return await (0,r.i)`
    SELECT
      COALESCE(region, 'Unknown') AS region,
      COUNT(DISTINCT vin)         AS vin_count,
      ROUND(
        COUNT(DISTINCT vin)::numeric
        / NULLIF(SUM(COUNT(DISTINCT vin)) OVER (), 0) * 100, 1
      )                           AS pct
    FROM benchmark_records
    WHERE snapshot_id = ${a}
    GROUP BY region
    ORDER BY vin_count DESC
  `}async function v(){return await (0,r.i)`
    SELECT
      CASE
        WHEN LOWER(TRIM(r.upstream_provider)) IN ('yqservice', 'yqservices')
          OR r.upstream_provider ILIKE 'yq%service%'              THEN 'YQService'
        WHEN LOWER(TRIM(r.upstream_provider)) = 'adp'             THEN 'ADP'
        WHEN r.upstream_provider ILIKE '%parts%bond%'
          OR LOWER(TRIM(r.upstream_provider)) = 'partsbond'       THEN 'Parts Bond'
        WHEN r.upstream_provider ILIKE '%mazda%'
          AND r.upstream_provider ILIKE '%offline%'               THEN 'Mazda EU Offline'
        WHEN r.upstream_provider ILIKE '%holden%'
          AND r.upstream_provider ILIKE '%offline%'               THEN 'Holden Offline'
        WHEN r.upstream_provider ILIKE '%honda%'
          AND r.upstream_provider ILIKE '%offline%'               THEN 'Honda Offline'
        WHEN r.upstream_provider ILIKE '%tradesoft%'
          OR r.upstream_provider ILIKE '%trade%soft%'             THEN 'TradeSoft'
        ELSE 'No upstream provider'
      END                                                             AS provider,
      COUNT(*) FILTER (WHERE r.is_valid IS NOT NULL)                  AS total_parts,
      COUNT(*) FILTER (WHERE r.is_valid = true)                       AS valid_count,
      COUNT(*) FILTER (WHERE r.is_valid = false)                      AS invalid_count,
      CASE
        WHEN COUNT(*) FILTER (WHERE r.is_valid IS NOT NULL) = 0 THEN 0
        ELSE ROUND(
          COUNT(*) FILTER (WHERE r.is_valid = true)::numeric
          / COUNT(*) FILTER (WHERE r.is_valid IS NOT NULL) * 100, 2
        )
      END                                                             AS accuracy_pct
    FROM brands b
    JOIN LATERAL (
      SELECT id FROM benchmark_snapshots
      WHERE brand_id = b.id
      ORDER BY snapshot_date DESC, created_at DESC LIMIT 1
    ) latest ON true
    JOIN benchmark_records r ON r.snapshot_id = latest.id
    GROUP BY 1
    ORDER BY total_parts DESC
  `}async function R(a,t){return(await (0,r.i)`
    WITH
    prev_records AS (
      SELECT vin, part_type, is_valid
      FROM benchmark_records
      WHERE snapshot_id = ${t}
    ),
    curr_records AS (
      SELECT vin, part_type, is_valid
      FROM benchmark_records
      WHERE snapshot_id = ${a}
    ),
    new_vins AS (
      SELECT COUNT(DISTINCT vin)::int AS cnt
      FROM curr_records c
      WHERE NOT EXISTS (SELECT 1 FROM prev_records p WHERE p.vin = c.vin)
    ),
    removed_vins AS (
      SELECT COUNT(DISTINCT vin)::int AS cnt
      FROM prev_records p
      WHERE NOT EXISTS (SELECT 1 FROM curr_records c WHERE c.vin = p.vin)
    ),
    changes AS (
      SELECT
        COUNT(*) FILTER (
          WHERE c.is_valid = true AND (p.is_valid = false OR p.is_valid IS NULL)
        )::int AS improved,
        COUNT(*) FILTER (
          WHERE (c.is_valid = false OR c.is_valid IS NULL) AND p.is_valid = true
        )::int AS regressed
      FROM curr_records c
      JOIN prev_records p ON p.vin = c.vin AND p.part_type = c.part_type
    )
    SELECT
      (SELECT cnt FROM new_vins)      AS new_vin_count,
      (SELECT cnt FROM removed_vins)  AS removed_vin_count,
      (SELECT improved  FROM changes) AS improved_count,
      (SELECT regressed FROM changes) AS regressed_count
  `)[0]}async function S(a){return await (0,r.i)`
    SELECT
      CASE
        WHEN LOWER(TRIM(upstream_provider)) IN ('yqservice', 'yqservices')
          OR upstream_provider ILIKE 'yq%service%'             THEN 'YQService'
        WHEN LOWER(TRIM(upstream_provider)) = 'adp'            THEN 'ADP'
        WHEN upstream_provider ILIKE '%parts%bond%'
          OR LOWER(TRIM(upstream_provider)) = 'partsbond'      THEN 'Parts Bond'
        WHEN upstream_provider ILIKE '%mazda%'
          AND upstream_provider ILIKE '%offline%'              THEN 'Mazda EU Offline'
        WHEN upstream_provider ILIKE '%holden%'
          AND upstream_provider ILIKE '%offline%'              THEN 'Holden Offline'
        WHEN upstream_provider ILIKE '%honda%'
          AND upstream_provider ILIKE '%offline%'              THEN 'Honda Offline'
        WHEN upstream_provider ILIKE '%tradesoft%'
          OR upstream_provider ILIKE '%trade%soft%'            THEN 'TradeSoft'
        ELSE 'No upstream provider'
      END                                                           AS upstream_provider,
      COUNT(DISTINCT vin)                                           AS vin_count,
      COUNT(*) FILTER (WHERE is_valid IS NOT NULL)                  AS total_parts,
      COUNT(*) FILTER (WHERE is_valid = true)                       AS valid_count,
      COUNT(*) FILTER (WHERE is_valid = false)                      AS invalid_count,
      CASE
        WHEN COUNT(*) FILTER (WHERE is_valid IS NOT NULL) = 0 THEN 0
        ELSE ROUND(
          COUNT(*) FILTER (WHERE is_valid = true)::numeric
          / COUNT(*) FILTER (WHERE is_valid IS NOT NULL) * 100, 2
        )
      END                                                           AS accuracy_pct,
      ROUND(
        COUNT(DISTINCT vin)::numeric
        / NULLIF(SUM(COUNT(DISTINCT vin)) OVER (), 0) * 100, 1
      )                                                             AS pct
    FROM benchmark_records
    WHERE snapshot_id = ${a}
    GROUP BY 1
    ORDER BY vin_count DESC
  `}async function T(){return(await (0,r.i)`
    SELECT
      COUNT(DISTINCT b.id)                                        AS total_brands,
      COALESCE(SUM(s.active_vins), 0)                            AS total_vins,
      COALESCE(SUM(s.total_parts), 0)                            AS total_parts,
      COALESCE(SUM(s.valid_count), 0)                            AS valid_count,
      COALESCE(SUM(s.invalid_count), 0)                          AS invalid_count,
      CASE
        WHEN COALESCE(SUM(s.total_parts), 0) = 0 THEN 0
        ELSE ROUND(SUM(s.valid_count)::numeric / SUM(s.total_parts) * 100, 2)
      END AS overall_accuracy_pct
    FROM brands b
    LEFT JOIN LATERAL (
      SELECT * FROM benchmark_snapshots
      WHERE brand_id = b.id
      ORDER BY snapshot_date DESC, created_at DESC LIMIT 1
    ) s ON true
    WHERE s.id IS NOT NULL
  `)[0]}async function N(){return await (0,r.i)`
    SELECT
      qs.id,
      qs.snapshot_date,
      qs.notes,
      qs.uploaded_by,
      qs.created_at,
      COUNT(qb.id) AS brand_count
    FROM quality_snapshots qs
    LEFT JOIN quality_brand_data qb ON qb.snapshot_id = qs.id
    GROUP BY qs.id
    ORDER BY qs.snapshot_date DESC
  `}async function L(){let a=await (0,r.i)`
    SELECT id, snapshot_date, notes, uploaded_by, created_at,
      (SELECT COUNT(*) FROM quality_brand_data WHERE snapshot_id = qs.id) AS brand_count
    FROM quality_snapshots qs
    ORDER BY snapshot_date DESC, created_at DESC
    LIMIT 1
  `;if(0===a.length)return null;let t=a[0],e=(await (0,r.i)`
    SELECT id, snapshot_id, brand, classification_pct, annotation_pct, total_diagrams,
           vio_rank, vio_combined_pct, vio_nz_pct, vio_uk_pct, vio_au_pct, vio_us_pct,
           req_diagram_style, req_diagram_cleanup, req_titles_rephrased,
           req_irrelevant_removed, req_accuracy_verified, req_part_variant_l2
    FROM quality_brand_data
    WHERE snapshot_id = ${t.id}
    ORDER BY vio_rank ASC NULLS LAST, total_diagrams DESC NULLS LAST, brand ASC
  `).map(a=>({...a,level:function(a,t,e){let r=a??0,s=t??0,i=!!e&&!!(e.req_diagram_cleanup&&e.req_titles_rephrased&&e.req_irrelevant_removed&&e.req_part_variant_l2);return r>=80&&s>=80?"L3":r>=70&&s>=70&&i?"L2":r>=20&&s>=20?"L1":r>0||s>0?"L0":"Unsupported"}(a.classification_pct,a.annotation_pct,{req_diagram_cleanup:a.req_diagram_cleanup,req_titles_rephrased:a.req_titles_rephrased,req_irrelevant_removed:a.req_irrelevant_removed,req_part_variant_l2:a.req_part_variant_l2})}));return{snapshot:t,brands:e}}async function O(a,t,e,s){let[i]=await (0,r.i)`
    INSERT INTO quality_snapshots (snapshot_date, uploaded_by, notes)
    VALUES (${a}, ${e??null}, ${s??null})
    RETURNING id
  `,n=i.id;for(let a of t)await (0,r.i)`
      INSERT INTO quality_brand_data (
        snapshot_id, brand, classification_pct, annotation_pct, total_diagrams,
        req_diagram_style, req_diagram_cleanup, req_titles_rephrased,
        req_irrelevant_removed, req_accuracy_verified, req_part_variant_l2
      )
      VALUES (
        ${n},
        ${a.brand},
        ${a.classification_pct},
        ${a.annotation_pct},
        ${a.total_diagrams},
        ${a.req_diagram_style??!1},
        ${a.req_diagram_cleanup??!1},
        ${a.req_titles_rephrased??!1},
        ${a.req_irrelevant_removed??!1},
        ${a.req_accuracy_verified??!1},
        ${a.req_part_variant_l2??!1}
      )
      ON CONFLICT (snapshot_id, brand) DO UPDATE SET
        classification_pct    = EXCLUDED.classification_pct,
        annotation_pct        = EXCLUDED.annotation_pct,
        total_diagrams        = EXCLUDED.total_diagrams,
        req_diagram_style     = EXCLUDED.req_diagram_style,
        req_diagram_cleanup   = EXCLUDED.req_diagram_cleanup,
        req_titles_rephrased  = EXCLUDED.req_titles_rephrased,
        req_irrelevant_removed = EXCLUDED.req_irrelevant_removed,
        req_accuracy_verified = EXCLUDED.req_accuracy_verified,
        req_part_variant_l2   = EXCLUDED.req_part_variant_l2
    `;return await (0,r.i)`
    UPDATE quality_brand_data qbd
    SET
      vio_rank         = prev.vio_rank,
      vio_combined_pct = prev.vio_combined_pct,
      vio_nz_pct       = prev.vio_nz_pct,
      vio_uk_pct       = prev.vio_uk_pct,
      vio_au_pct       = prev.vio_au_pct,
      vio_us_pct       = prev.vio_us_pct
    FROM (
      SELECT DISTINCT ON (REGEXP_REPLACE(UPPER(brand), '[^A-Z0-9]', '', 'g'))
        brand, vio_rank, vio_combined_pct, vio_nz_pct, vio_uk_pct, vio_au_pct, vio_us_pct
      FROM quality_brand_data
      WHERE snapshot_id != ${n}
        AND vio_rank IS NOT NULL
      ORDER BY REGEXP_REPLACE(UPPER(brand), '[^A-Z0-9]', '', 'g'), snapshot_id DESC
    ) prev
    WHERE qbd.snapshot_id = ${n}
      AND REGEXP_REPLACE(UPPER(qbd.brand), '[^A-Z0-9]', '', 'g')
        = REGEXP_REPLACE(UPPER(prev.brand), '[^A-Z0-9]', '', 'g')
      AND qbd.vio_rank IS NULL
  `,n}async function I(){return await (0,r.i)`
    WITH latest_per_date AS (
      SELECT DISTINCT ON (snapshot_date)
        id, snapshot_date
      FROM quality_snapshots
      ORDER BY snapshot_date, created_at DESC
    )
    SELECT
      lpd.snapshot_date::text AS snapshot_date,
      qb.brand,
      qb.classification_pct,
      qb.annotation_pct
    FROM quality_brand_data qb
    JOIN latest_per_date lpd ON lpd.id = qb.snapshot_id
    ORDER BY lpd.snapshot_date ASC, qb.brand ASC
  `}async function C(){return await (0,r.i)`
    SELECT
      s.id,
      s.brand_id,
      b.name AS brand_name,
      s.snapshot_date,
      s.notes,
      s.uploaded_by,
      s.total_vins,
      s.active_vins,
      s.total_parts,
      s.valid_count,
      s.invalid_count,
      s.skipped_count,
      s.accuracy_pct,
      s.created_at
    FROM benchmark_snapshots s
    JOIN brands b ON b.id = s.brand_id
    ORDER BY s.created_at DESC
    LIMIT 100
  `}async function h(a,t,e){let[s]=await (0,r.i)`
    INSERT INTO coverage_snapshots (html_content, uploaded_by, data_json)
    VALUES (${a}, ${t??null}, ${e??null})
    RETURNING id
  `;return s.id}async function b(){return(await (0,r.i)`
    SELECT id, html_content, data_json, uploaded_by, created_at
    FROM coverage_snapshots
    ORDER BY created_at DESC
    LIMIT 1
  `)[0]??null}async function A(){let a=await (0,r.i)`
    SELECT data_json
    FROM coverage_snapshots
    WHERE data_json IS NOT NULL
    ORDER BY created_at DESC
    LIMIT 1
  `;return a[0]?.data_json??null}async function m(){return await (0,r.i)`
    SELECT id, region, snapshot_date::text, uploaded_by, notes, row_count, is_baseline, created_at
    FROM coverage_sample_snapshots
    ORDER BY snapshot_date DESC, created_at DESC
  `}async function U(a){let t={},e=null,s=null;if(a){let t=await (0,r.i)`
      SELECT region FROM coverage_sample_snapshots WHERE id = ${a}
    `;t[0]&&(e=t[0].region,s=await (0,r.i)`
        SELECT make, logo, y, n, total, rate::float, share::float
        FROM coverage_sample_rows WHERE snapshot_id = ${a}
        ORDER BY total DESC
      `)}for(let a of["UK","NZ","AU","US","ALL"]){if(e&&a===e&&s){t[a]=s;continue}let i=await (0,r.i)`
      SELECT DISTINCT ON (r.make)
        r.make, r.logo,
        r.y::int, r.n::int, r.total::int,
        r.rate::float, r.share::float
      FROM coverage_sample_rows r
      JOIN coverage_sample_snapshots s ON s.id = r.snapshot_id
      WHERE s.region = ${a}
      ORDER BY r.make, s.snapshot_date DESC, s.is_baseline ASC, s.created_at DESC
    `;t[a]=i}return t}async function D(a,t,e,s,i){let[n]=await (0,r.i)`
    INSERT INTO coverage_sample_snapshots (region, snapshot_date, uploaded_by, notes, row_count, is_baseline)
    VALUES (${a}, ${t}, ${s??null}, ${i??null}, ${e.length}, FALSE)
    RETURNING id
  `,_=n.id;for(let a of e)await (0,r.i)`
      INSERT INTO coverage_sample_rows (snapshot_id, make, logo, y, n, total, rate, share)
      VALUES (${_}, ${a.make}, ${a.logo}, ${a.y}, ${a.n}, ${a.total}, ${a.rate}, ${a.share})
    `;return _}}};