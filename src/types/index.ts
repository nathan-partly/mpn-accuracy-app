export interface Brand {
  id: string;
  name: string;
  status: "active" | "completed" | "pending";
  created_at: string;
  // computed from latest snapshot
  latest_snapshot_date?: string;
  latest_accuracy_pct?: number;
  latest_total_vins?: number;
  latest_total_parts?: number;
  latest_valid_count?: number;
  latest_invalid_count?: number;
  snapshot_count?: number;
}

export interface BenchmarkSnapshot {
  id: string;
  brand_id: string;
  brand_name?: string;
  snapshot_date: string;
  notes?: string;
  uploaded_by?: string;
  total_vins: number;
  active_vins: number;
  total_parts: number;
  valid_count: number;
  invalid_count: number;
  skipped_count: number;
  accuracy_pct: number;
  created_at: string;
}

export interface BenchmarkRecord {
  id: string;
  snapshot_id: string;
  brand_id: string;
  region?: string;
  vin: string;
  make?: string;
  model?: string;
  year?: number;
  upstream_provider?: string;
  part_type: string;
  interpreter_output?: string;
  epc_output?: string;
  pl24_output?: string;
  is_valid: boolean | null; // null = skipped (missing diagram/hotspot etc.)
  epc_source?: string | null; // 'Original EPC' | 'PL24' | 'Both' | null
  notes?: string;
  created_at: string;
}

export interface AccuracyPoint {
  snapshot_date: string;
  accuracy_pct: number;
  total_parts: number;
  valid_count: number;
  invalid_count: number;
}

export interface ModelBreakdown {
  model: string;
  year?: number;
  region?: string;
  total_parts: number;
  valid_count: number;
  invalid_count: number;
  accuracy_pct: number;
}

export interface PartTypeBreakdown {
  part_type: string;
  total_parts: number;
  valid_count: number;
  invalid_count: number;
  accuracy_pct: number;
}

export interface ProviderBreakdown {
  upstream_provider: string;
  vin_count: number;
  pct: number;
}

export interface RegionBreakdown {
  region: string;
  vin_count: number;
  pct: number;
}

export interface EpcSourceBreakdown {
  epc_source: string;
  part_count: number;
  pct: number;
}

export interface GlobalProviderStat {
  provider: string;
  total_parts: number;
  valid_count: number;
  invalid_count: number;
  accuracy_pct: number;
}

export interface CsvRow {
  region?: string;
  vin: string;
  make?: string;
  model?: string;
  year?: string | number;
  upstream_provider?: string;
  part_type: string;
  interpreter_output?: string;
  epc_output?: string;
  pl24_output?: string;
  epc_source?: string;
  is_valid: string | boolean;
  notes?: string;
}
