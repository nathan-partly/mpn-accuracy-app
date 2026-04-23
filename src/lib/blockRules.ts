/**
 * Human-readable VIN block rules per brand, derived from block_rules.rs.
 * Each rule describes a class of vehicles that Interpreter filters out
 * when querying upstream EPC providers, and why.
 *
 * Keep in sync with:
 * https://www.notion.so/partly/Blocked-Interpreter-Vehicles-30c2cf96686280afa4afc63082378a8e
 */

export interface BlockRule {
  /** The upstream provider this rule applies to, shown as context only. */
  provider: string;
  rule: string;
  reason: string;
}

// Keyed by lowercase brand name matching the `brands.name` column
export const BLOCK_RULES_BY_BRAND: Record<string, BlockRule[]> = {
  toyota: [
    {
      provider: "YQService",
      rule: "Interpreter blocks partial decode VINs",
      reason: "When YQService can only resolve a VIN to a basic vehicle with no specific variant data, Interpreter excludes it as part lookups would be unreliable.",
    },
  ],

  renault: [
    {
      provider: "ADP",
      rule: "Interpreter blocks all vehicles produced after 2020",
      reason: "ADP data quality for Renault degrades significantly past 2020.",
    },
  ],

  vauxhall: [
    {
      provider: "ADP",
      rule: "Interpreter blocks all vehicles produced after 2023",
      reason: "ADP data quality for Vauxhall degrades past 2023.",
    },
  ],

  ford: [
    {
      provider: "PartsBond",
      rule: "Interpreter only uses VINs with WMI 'MNB'; all others are blocked",
      reason: "PartsBond Ford data is only reliable for the MNB world manufacturer identifier (NZ-assembled Rangers). All other Ford VINs resolve to invalid MPNs.",
    },
    {
      provider: "PartsBond",
      rule: "Interpreter blocks Ranger with WMI 'MPB'",
      reason: "MPB-prefix Ranger VINs resolve to invalid MPNs on PartsBond.",
    },
    {
      provider: "PartsBond",
      rule: "Interpreter blocks Ranger produced after 2021",
      reason: "2022+ Ranger VINs resolve to invalid MPNs on PartsBond.",
    },
    {
      provider: "PartsBond",
      rule: "Interpreter blocks Ranger with WMI 'MNA' produced after 2010",
      reason: "MNA-prefix Ranger VINs from 2011 onward resolve to invalid MPNs on PartsBond.",
    },
    {
      provider: "ADP",
      rule: "Interpreter blocks VINs with WMI '1FA'",
      reason: "1FA is the US Mustang WMI — ADP data for these VINs is unreliable.",
    },
    {
      provider: "ADP",
      rule: "Interpreter blocks VINs with WMI 'WF0' produced after 2019",
      reason: "WF0 (European Ford) VINs from 2020 onward return unreliable data on ADP.",
    },
    {
      provider: "ADP",
      rule: "Interpreter blocks Ranger with WMI 'MPB'",
      reason: "MPB-prefix Ranger VINs resolve to invalid MPNs on ADP.",
    },
    {
      provider: "ADP",
      rule: "Interpreter blocks Ranger produced after 2021",
      reason: "2022+ Ranger VINs resolve to invalid MPNs on ADP.",
    },
    {
      provider: "ADP",
      rule: "Interpreter blocks Ranger with WMI 'MNA' produced after 2010",
      reason: "MNA-prefix Ranger VINs from 2011 onward resolve to invalid MPNs on ADP.",
    },
    {
      provider: "YQService",
      rule: "Interpreter blocks VINs with WMI '1FA'",
      reason: "1FA is the US Mustang WMI — YQService data for these VINs is unreliable.",
    },
    {
      provider: "YQService",
      rule: "Interpreter blocks partial decode VINs",
      reason: "When YQService can only resolve a VIN to a basic vehicle with no specific variant data, Interpreter excludes it as part lookups would be unreliable.",
    },
    {
      provider: "YQService",
      rule: "Interpreter blocks Ranger with WMI 'MPB'",
      reason: "MPB-prefix Ranger VINs resolve to invalid MPNs on YQService.",
    },
    {
      provider: "YQService",
      rule: "Interpreter blocks Ranger produced after 2021",
      reason: "2022+ Ranger VINs resolve to invalid MPNs on YQService.",
    },
    {
      provider: "YQService",
      rule: "Interpreter blocks Ranger with WMI 'MNA' produced after 2010",
      reason: "MNA-prefix Ranger VINs from 2011 onward resolve to invalid MPNs on YQService.",
    },
  ],

  nissan: [
    {
      provider: "All providers",
      rule: "Interpreter blocks JDM Tiida with non-standard SC chassis number",
      reason: "Japanese-market Tiida vehicles use an SC-prefixed chassis number shorter than 17 characters. This non-standard format cannot be resolved to parts in any EPC.",
    },
  ],

  audi: [
    {
      provider: "ADP",
      rule: "Interpreter blocks US-market vehicles produced after 2023",
      reason: "ADP data quality for US-market Audi vehicles drops significantly from 2024 onward.",
    },
  ],

  suzuki: [
    {
      provider: "YQService",
      rule: "Interpreter blocks partial decode VINs",
      reason: "When YQService can only resolve a VIN to a basic vehicle with no specific variant data, Interpreter excludes it as part lookups would be unreliable.",
    },
    {
      provider: "YQService",
      rule: "Interpreter blocks all vehicles produced after 2018",
      reason: "YQService Suzuki data becomes unreliable from model year 2019 onward.",
    },
  ],

  lexus: [
    {
      provider: "YQService",
      rule: "Interpreter blocks partial decode VINs",
      reason: "When YQService can only resolve a VIN to a basic vehicle with no specific variant data, Interpreter excludes it as part lookups would be unreliable.",
    },
  ],

  holden: [
    {
      provider: "ADP",
      rule: "Interpreter blocks all vehicles produced after 2017",
      reason: "ADP Holden data becomes unreliable from 2018 onward.",
    },
    {
      provider: "YQService",
      rule: "Interpreter blocks 2018 Insignia/Commodore",
      reason: "Holden's 2018 Insignia-based Commodore VINs cross-resolve incorrectly in YQService, returning invalid MPNs.",
    },
  ],

  peugeot: [
    {
      provider: "YQService",
      rule: "Interpreter blocks partial decode VINs",
      reason: "When YQService can only resolve a VIN to a basic vehicle with no specific variant data, Interpreter excludes it as part lookups would be unreliable.",
    },
  ],

  citroen: [
    {
      provider: "YQService",
      rule: "Interpreter blocks partial decode VINs",
      reason: "When YQService can only resolve a VIN to a basic vehicle with no specific variant data, Interpreter excludes it as part lookups would be unreliable.",
    },
  ],

  ds: [
    {
      provider: "YQService",
      rule: "Interpreter blocks partial decode VINs",
      reason: "When YQService can only resolve a VIN to a basic vehicle with no specific variant data, Interpreter excludes it as part lookups would be unreliable.",
    },
  ],

  dacia: [
    {
      provider: "Tradesoft",
      rule: "Interpreter blocks all Dacia vehicles from Tradesoft",
      reason: "Tradesoft vehicle responses for Dacia are entirely unreliable — no usable data is returned.",
    },
  ],

  tesla: [
    {
      provider: "PartsBond",
      rule: "Interpreter blocks Model Y",
      reason: "PartsBond has insufficient part data for the Tesla Model Y.",
    },
  ],

  mazda: [
    {
      provider: "YQService",
      rule: "Interpreter blocks 3MV/3MZ WMI VINs decoded as Ford",
      reason: "Some Mazda VINs with WMI '3MV' or '3MZ' are incorrectly decoded as Ford by YQService, returning Ford MPNs for a Mazda vehicle.",
    },
  ],
};

/** Returns block rules for a brand name (case-insensitive). */
export function getBlockRulesForBrand(brandName: string): BlockRule[] {
  return BLOCK_RULES_BY_BRAND[brandName.toLowerCase()] ?? [];
}
