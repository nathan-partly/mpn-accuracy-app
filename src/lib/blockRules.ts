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
    {
      provider: "Tradesoft",
      rule: "Interpreter blocks VINs with WMI '7MU' or '7SV'",
      reason: "7MU and 7SV are US-built Toyota WMIs not covered by Tradesoft.",
    },
    {
      provider: "Tradesoft",
      rule: "Interpreter blocks VINs with WMI 'MR0'",
      reason: "MR0 WMI is covered by Tradesoft but returns many vehicle variants, making reliable part lookup impossible.",
    },
    {
      provider: "Tradesoft",
      rule: "Interpreter blocks all vehicles produced after 2025",
      reason: "Tradesoft Toyota coverage ends 2025-01.",
    },
  ],

  renault: [
    {
      provider: "ADP",
      rule: "Interpreter blocks all vehicles produced after 2023",
      reason: "ADP data quality for Renault degrades significantly past 2023.",
    },
    {
      provider: "Tradesoft",
      rule: "Interpreter blocks all vehicles produced after 2019",
      reason: "Tradesoft Renault coverage ends 2019-10.",
    },
  ],

  "renault trucks": [
    {
      provider: "Tradesoft",
      rule: "Interpreter blocks all vehicles produced after 2019",
      reason: "Tradesoft Renault Trucks coverage ends 2019-10.",
    },
  ],

  vauxhall: [
    {
      provider: "ADP",
      rule: "Interpreter blocks all vehicles produced after 2022",
      reason: "ADP data quality for Vauxhall degrades past 2022.",
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
    {
      provider: "Tradesoft",
      rule: "Interpreter only uses Spain-built VSK Navaras (up to 2012); all other Nissan VINs are blocked",
      reason: "Tradesoft Nissan coverage is limited to Spain-built VSK-prefix Navaras produced up to 2012-08. All other Nissan VINs are outside Tradesoft's catalog.",
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
    {
      provider: "Tradesoft",
      rule: "Interpreter blocks all vehicles produced after 2019",
      reason: "Tradesoft Suzuki coverage ends 2019-05.",
    },
  ],

  lexus: [
    {
      provider: "YQService",
      rule: "Interpreter blocks partial decode VINs",
      reason: "When YQService can only resolve a VIN to a basic vehicle with no specific variant data, Interpreter excludes it as part lookups would be unreliable.",
    },
    {
      provider: "Tradesoft",
      rule: "Interpreter blocks all vehicles produced after 2025",
      reason: "Tradesoft Lexus coverage ends 2025-01.",
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
      provider: "ADP",
      rule: "Interpreter blocks all vehicles produced after 2022",
      reason: "ADP data quality for Peugeot degrades from 2023 onward.",
    },
    {
      provider: "YQService",
      rule: "Interpreter blocks partial decode VINs",
      reason: "When YQService can only resolve a VIN to a basic vehicle with no specific variant data, Interpreter excludes it as part lookups would be unreliable.",
    },
  ],

  citroen: [
    {
      provider: "ADP",
      rule: "Interpreter blocks all vehicles produced after 2022",
      reason: "ADP data quality for Citroën degrades from 2023 onward.",
    },
    {
      provider: "YQService",
      rule: "Interpreter blocks partial decode VINs",
      reason: "When YQService can only resolve a VIN to a basic vehicle with no specific variant data, Interpreter excludes it as part lookups would be unreliable.",
    },
    {
      provider: "Tradesoft",
      rule: "Interpreter blocks VINs with WMI 'VF7'",
      reason: "VF7 WMI is covered by Tradesoft but returns many vehicle variants, making reliable part lookup impossible.",
    },
    {
      provider: "Tradesoft",
      rule: "Interpreter blocks all vehicles produced after 2013",
      reason: "Tradesoft Citroën coverage ends 2013-11.",
    },
  ],

  ds: [
    {
      provider: "ADP",
      rule: "Interpreter blocks all vehicles produced after 2022",
      reason: "ADP data quality for DS degrades from 2023 onward.",
    },
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

  jeep: [
    {
      provider: "PartsBond",
      rule: "Interpreter blocks Renegade",
      reason: "Jeep Renegade VINs resolve to invalid MPNs on PartsBond.",
    },
    {
      provider: "Tradesoft",
      rule: "Interpreter blocks all vehicles produced after 2022",
      reason: "Tradesoft Jeep coverage ends 2022-06.",
    },
  ],

  chrysler: [
    {
      provider: "Tradesoft",
      rule: "Interpreter blocks all vehicles produced after 2022",
      reason: "Tradesoft Chrysler coverage ends 2022-06.",
    },
  ],

  dodge: [
    {
      provider: "Tradesoft",
      rule: "Interpreter blocks all vehicles produced after 2022",
      reason: "Tradesoft Dodge coverage ends 2022-06.",
    },
  ],

  mazda: [
    {
      provider: "YQService",
      rule: "Interpreter blocks 3MV/3MZ WMI VINs decoded as Ford",
      reason: "Some Mazda VINs with WMI '3MV' or '3MZ' are incorrectly decoded as Ford by YQService, returning Ford MPNs for a Mazda vehicle.",
    },
    {
      provider: "Tradesoft",
      rule: "Interpreter blocks North American-built VINs",
      reason: "North American-manufactured Mazda vehicles are not covered by Tradesoft.",
    },
    {
      provider: "Tradesoft",
      rule: "Interpreter blocks VINs with WMI 'JM1' or 'JM3'",
      reason: "JM1 and JM3 are Japan-built US-market Mazda WMIs not covered by Tradesoft.",
    },
    {
      provider: "Tradesoft",
      rule: "Interpreter blocks all vehicles produced after 2022",
      reason: "Tradesoft Mazda coverage ends 2022-11.",
    },
  ],

  honda: [
    {
      provider: "Tradesoft",
      rule: "Interpreter blocks all vehicles produced after 2023",
      reason: "Tradesoft Honda coverage ends 2023-01.",
    },
  ],

  hyundai: [
    {
      provider: "Tradesoft",
      rule: "Interpreter blocks North American-built VINs",
      reason: "North American-manufactured Hyundai vehicles are not covered by Tradesoft.",
    },
    {
      provider: "Tradesoft",
      rule: "Interpreter blocks VINs with WMI 'KM8', 'KMT', or 'KMU'",
      reason: "KM8, KMT and KMU target the US market and are not covered by Tradesoft.",
    },
    {
      provider: "Tradesoft",
      rule: "Interpreter blocks all vehicles produced after 2021",
      reason: "Tradesoft Hyundai coverage ends 2021-09.",
    },
  ],

  kia: [
    {
      provider: "Tradesoft",
      rule: "Interpreter blocks North American-built VINs",
      reason: "North American-manufactured Kia vehicles are not covered by Tradesoft.",
    },
    {
      provider: "Tradesoft",
      rule: "Interpreter blocks VINs with WMI 'KND'",
      reason: "KND targets the US market and is not covered by Tradesoft.",
    },
    {
      provider: "Tradesoft",
      rule: "Interpreter blocks all vehicles produced after 2022",
      reason: "Tradesoft Kia coverage ends 2022-10.",
    },
  ],

  subaru: [
    {
      provider: "Tradesoft",
      rule: "Interpreter blocks all vehicles produced after 2021",
      reason: "Tradesoft Subaru coverage ends 2021-09.",
    },
  ],

  mitsubishi: [
    {
      provider: "Tradesoft",
      rule: "Interpreter blocks VINs with WMI 'ML3'",
      reason: "ML3 are Thai-built US-market Mitsubishi vehicles not covered by Tradesoft.",
    },
    {
      provider: "Tradesoft",
      rule: "Interpreter blocks all vehicles produced after 2024",
      reason: "Tradesoft Mitsubishi coverage ends 2024-03.",
    },
  ],

  isuzu: [
    {
      provider: "Tradesoft",
      rule: "Interpreter blocks all vehicles produced after 2018",
      reason: "Tradesoft Isuzu coverage ends 2018-03.",
    },
  ],

  infiniti: [
    {
      provider: "Tradesoft",
      rule: "Interpreter blocks all vehicles produced after 2019",
      reason: "Tradesoft Infiniti coverage ends 2019-02.",
    },
  ],

  smart: [
    {
      provider: "Tradesoft",
      rule: "Interpreter blocks all vehicles produced after 2018",
      reason: "Tradesoft Smart coverage ends 2018-09.",
    },
  ],

  cadillac: [
    {
      provider: "Tradesoft",
      rule: "Interpreter blocks all vehicles produced after 2024",
      reason: "Tradesoft Cadillac coverage ends 2024-03.",
    },
  ],

  gmc: [
    {
      provider: "Tradesoft",
      rule: "Interpreter blocks North American-built VINs",
      reason: "North American-manufactured GMC vehicles are not covered by Tradesoft.",
    },
    {
      provider: "Tradesoft",
      rule: "Interpreter blocks all vehicles produced after 2024",
      reason: "Tradesoft GMC coverage ends 2024-03.",
    },
  ],

  hummer: [
    {
      provider: "Tradesoft",
      rule: "Interpreter blocks all vehicles produced after 2024",
      reason: "Tradesoft Hummer coverage ends 2024-03.",
    },
  ],

  opel: [
    {
      provider: "Tradesoft",
      rule: "Interpreter blocks all vehicles produced after 2024",
      reason: "Tradesoft Opel coverage ends 2024-03.",
    },
  ],

  pontiac: [
    {
      provider: "Tradesoft",
      rule: "Interpreter blocks all vehicles produced after 2024",
      reason: "Tradesoft Pontiac coverage ends 2024-03.",
    },
  ],

  saab: [
    {
      provider: "Tradesoft",
      rule: "Interpreter blocks all vehicles produced after 2024",
      reason: "Tradesoft Saab coverage ends 2024-03.",
    },
  ],

  porsche: [
    {
      provider: "Tradesoft",
      rule: "Interpreter blocks all vehicles produced after 2025",
      reason: "Tradesoft Porsche coverage ends 2025-03.",
    },
  ],
};

/** Returns block rules for a brand name (case-insensitive). */
export function getBlockRulesForBrand(brandName: string): BlockRule[] {
  return BLOCK_RULES_BY_BRAND[brandName.toLowerCase()] ?? [];
}
