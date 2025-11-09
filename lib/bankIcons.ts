// Comprehensive bank icon mapping utility
// This file provides consistent bank icon mapping across all pages

export interface BankIcon {
  logo?: any;
  logoSvg?: any;
}

// Map bank names to their corresponding asset files
const bankNameToAsset: { [key: string]: string } = {
  // Major Nigerian Banks
  'Access Bank': 'access_bank.svg',
  'Guaranty Trust Bank': 'gt_bank.svg',
  'First Bank of Nigeria': 'first_bank.svg',
  'First City Monument Bank': 'fcmb_bank.svg',
  'United Bank for Africa': 'united_bank.png',
  'Zenith Bank': 'zenith_bank.png',
  'Ecobank Nigeria': 'eco_bank.svg',
  'Fidelity Bank': 'fidelity_bank.svg',
  'Union Bank of Nigeria': 'union_bank.svg',
  'Wema Bank': 'wema_bank.png',
  'Sterling Bank': 'sterling_bank.svg',
  'Stanbic IBTC Bank': 'stanbic_bank.svg',
  'Standard Chartered Bank': 'standard_chartered_bank.svg',
  'Heritage Bank': 'heritage_bank.svg',
  'Keystone Bank': 'keystone_bank.svg',
  'Polaris Bank': 'polaris_bank.svg',
  'Unity Bank': 'unity_bank.png',
  'Jaiz Bank': 'jaiz_bank.png',
  'Titan Trust Bank': 'titan_bank.png',
  'Providus Bank': 'providus_bank.svg',
  'SunTrust Bank': 'suntrust_bank.png',
  'VFD Merchant Bank': 'vfd_bank.png',
  'Sparkle Bank': 'sparkle_bank.png',
  
  // Digital Banks & Fintech
  'Kuda Bank': 'kuda_bank.svg',
  'Moniepoint': 'moniepoint_bank.svg',
  'Opay': 'opay_bank.svg',
  'Palmpay': 'palmpay.svg',
  'Eyowo': 'eyowo_bank.svg',
  'Carbon': 'carbon_bank.svg',
  'FairMoney': 'fair_money_bank.png',
  'Paga': 'paga_bank.svg',
  'MTN MoMo': 'mtn_mono_bank.png',
  'Airtel Money': 'airtel_smartcash_bank.svg',
  '9mobile': '9mobile_bank.png',
  
  // Other Banks
  'VFD': 'vfd_bank.png',
  'Waya Bank': 'waya_bank.png',
  'Vale Bank': 'vale_bank.png',
  'Uhuru Bank': 'uhuru_bank.png',
  'Taj Bank': 'taj_bank.png',
  'Rubies Bank': 'rubies_bank.png',
  'Rehoboth Bank': 'rehoboth_bank.png',
  'Refuge Bank': 'refuge_bank.png',
  'Quick Fund Bank': 'quick_fund_bank.png',
  'Prosperis Bank': 'prosperis_bank.png',
  'Platinum Bank': 'platinum_bank.png',
  'Personal Trust Bank': 'personal_trust_bank.png',
  'Parkway ReadyCash': 'parkway_readycash_bank.png',
  'Navy Bank': 'navy_bank.png',
  'NDCC Bank': 'ndcc_bank.png',
  'Main Street Bank': 'main_street_bank.png',
  'Lotus Bank': 'lotus_bank.png',
  'Living Trust Bank': 'living_trust_bank.png',
  'Links Bank': 'links_bank.png',
  'Kredi Bank': 'kredi_bank.png',
  'Kongapay': 'kongapay_bank.png',
  'Kolomoni Bank': 'kolomoni_bank.png',
  'Imperial Bank': 'imperial_bank.png',
  'IBILE Bank': 'ibile_bank.png',
  'Hasal Bank': 'hasal_bank.png',
  'Greenwich Bank': 'greenwich_bank.png',
  'Gateway Bank': 'gateway_bank.png',
  'Firmus Bank': 'firmus_bank.png',
  'Fedeth Bank': 'fedeth_bank.png',
  'Excel Bank': 'excel_bank.png',
  'Ekimogun Bank': 'ekimogun_bank.png',
  'Davenport Bank': 'davenport_bank.png',
  'Country Bank': 'country_bank.png',
  'Consumer Bank': 'consumer_bank.png',
  'Citycode Bank': 'citycode_bank.png',
  'Chanelle Bank': 'chanelle_bank.png',
  'CEMCS Bank': 'cemcs_bank.png',
  'Cashconnect Bank': 'cashconnect_bank.png',
  'Bowen Bank': 'bowen_bank.png',
  'Bell Bank': 'bell_bank.png',
  'Awacash Bank': 'awacash_bank.png',
  'Astrapolaris Bank': 'astrapolaris_bank.png',
  'AG Bank': 'ag_bank.png',
  'Accion Bank': 'accion_bank.png',
  
  // Additional banks with different naming variations
  'Access': 'access_bank.svg',
  'GT Bank': 'gt_bank.svg',
  'GTB': 'gt_bank.svg',
  'First Bank': 'first_bank.svg',
  'FCMB': 'fcmb_bank.svg',
  'UBA': 'united_bank.png',
  'Zenith': 'zenith_bank.png',
  'Ecobank': 'eco_bank.svg',
  'Fidelity': 'fidelity_bank.svg',
  'Union Bank': 'union_bank.svg',
  'Wema': 'wema_bank.png',
  'Sterling': 'sterling_bank.svg',
  'Stanbic': 'stanbic_bank.svg',
  'Standard Chartered': 'standard_chartered_bank.svg',
  'Heritage': 'heritage_bank.svg',
  'Keystone': 'keystone_bank.svg',
  'Polaris': 'polaris_bank.svg',
  'Unity': 'unity_bank.png',
  'Jaiz': 'jaiz_bank.png',
  'Titan': 'titan_bank.png',
  'Providus': 'providus_bank.svg',
  'SunTrust': 'suntrust_bank.png',
  'VFD Bank': 'vfd_bank.png',
  'Sparkle': 'sparkle_bank.png',
  'Kuda': 'kuda_bank.svg',
  'Moniepoint Bank': 'moniepoint_bank.svg',
  'Opay Bank': 'opay_bank.svg',
  'PalmPay': 'palmpay.svg',
  'Eyowo Bank': 'eyowo_bank.svg',
  'Carbon Bank': 'carbon_bank.svg',
  'Fair Money': 'fair_money_bank.png',
  'Paga Bank': 'paga_bank.svg',
  'MTN': 'mtn_mono_bank.png',
  'Airtel': 'airtel_smartcash_bank.svg',
  '9mobile Bank': '9mobile_bank.png',
  
  // Microfinance Banks
  'SafeHaven MFB': 'safe_haven_bank.svg',
  'SAFEHAVEN MFB': 'safe_haven_bank.svg',
  'SafeHaven Microfinance Bank': 'safe_haven_bank.svg',
  'SafeHaven': 'safe_haven_bank.svg',
  'Safe Haven MFB': 'safe_haven_bank.svg',
};

// SVG files mapping
const svgFiles: { [key: string]: any } = {
  'access_bank.svg': require('@/assets/banks/access_bank.svg'),
  'gt_bank.svg': require('@/assets/banks/gt_bank.svg'),
  'first_bank.svg': require('@/assets/banks/first_bank.svg'),
  'fcmb_bank.svg': require('@/assets/banks/fcmb_bank.svg'),
  'union_bank.svg': require('@/assets/banks/union_bank.svg'),
  'sterling_bank.svg': require('@/assets/banks/sterling_bank.svg'),
  'stanbic_bank.svg': require('@/assets/banks/stanbic_bank.svg'),
  'standard_chartered_bank.svg': require('@/assets/banks/standard_chartered_bank.svg'),
  'heritage_bank.svg': require('@/assets/banks/heritage_bank.svg'),
  'keystone_bank.svg': require('@/assets/banks/keystone_bank.svg'),
  'polaris_bank.svg': require('@/assets/banks/polaris_bank.svg'),
  'providus_bank.svg': require('@/assets/banks/providus_bank.svg'),
  'eco_bank.svg': require('@/assets/banks/eco_bank.svg'),
  'fidelity_bank.svg': require('@/assets/banks/fidelity_bank.svg'),
  'kuda_bank.svg': require('@/assets/banks/kuda_bank.svg'),
  'moniepoint_bank.svg': require('@/assets/banks/moniepoint_bank.svg'),
  'opay_bank.svg': require('@/assets/banks/opay_bank.svg'),
  'palmpay.svg': require('@/assets/banks/palmpay.svg'),
  'eyowo_bank.svg': require('@/assets/banks/eyowo_bank.svg'),
  'carbon_bank.svg': require('@/assets/banks/carbon_bank.svg'),
  'paga_bank.svg': require('@/assets/banks/paga_bank.svg'),
  'airtel_smartcash_bank.svg': require('@/assets/banks/airtel_smartcash_bank.svg'),
  'tangerine_bank.svg': require('@/assets/banks/tangerine_bank.svg'),
  'stallas_bank.svg': require('@/assets/banks/stallas_bank.svg'),
  'rehoboth_bank.png': require('@/assets/banks/rehoboth_bank.png'),
  'rubies_bank.png': require('@/assets/banks/rubies_bank.png'),
  'safe_haven_bank.svg': require('@/assets/banks/safe_haven_bank.svg'),
  'signature_bank.svg': require('@/assets/banks/signature_bank.svg'),
  'quick_fund_bank.png': require('@/assets/banks/quick_fund_bank.png'),
  'rand_marchant_bank.svg': require('@/assets/banks/rand_marchant_bank.svg'),
  'refuge_bank.png': require('@/assets/banks/refuge_bank.png'),
  'premium_trust_bank.svg': require('@/assets/banks/premium_trust_bank.svg'),
  'prosperis_bank.png': require('@/assets/banks/prosperis_bank.png'),
  'pocket_bank.svg': require('@/assets/banks/pocket_bank.svg'),
  'platinum_bank.png': require('@/assets/banks/platinum_bank.png'),
  'pecan_trust_bank.svg': require('@/assets/banks/pecan_trust_bank.svg'),
  'personal_trust_bank.png': require('@/assets/banks/personal_trust_bank.png'),
  'paycom.png': require('@/assets/banks/paycom.png'),
  'parrallex_bank.svg': require('@/assets/banks/parrallex_bank.svg'),
  'optimus_bank.svg': require('@/assets/banks/optimus_bank.svg'),
  'parkway_readycash_bank.png': require('@/assets/banks/parkway_readycash_bank.png'),
  'mtn_mono_bank.png': require('@/assets/banks/mtn_mono_bank.png'),
  'navy_bank.png': require('@/assets/banks/navy_bank.png'),
  'ndcc_bank.png': require('@/assets/banks/ndcc_bank.png'),
  'main_street_bank.png': require('@/assets/banks/main_street_bank.png'),
  'loma_bank.svg': require('@/assets/banks/loma_bank.svg'),
  'lotus_bank.png': require('@/assets/banks/lotus_bank.png'),
  'living_trust_bank.png': require('@/assets/banks/living_trust_bank.png'),
  'kolomoni_bank.png': require('@/assets/banks/kolomoni_bank.png'),
  'kongapay_bank.png': require('@/assets/banks/kongapay_bank.png'),
  'kredi_bank.png': require('@/assets/banks/kredi_bank.png'),
  'links_bank.png': require('@/assets/banks/links_bank.png'),
  'jaiz_bank.png': require('@/assets/banks/jaiz_bank.png'),
  'hasal_bank.png': require('@/assets/banks/hasal_bank.png'),
  'hope_bank.svg': require('@/assets/banks/hope_bank.svg'),
  'ibile_bank.png': require('@/assets/banks/ibile_bank.png'),
  'imperial_bank.png': require('@/assets/banks/imperial_bank.png'),
  'gateway_bank.png': require('@/assets/banks/gateway_bank.png'),
  'globus_bank.svg': require('@/assets/banks/globus_bank.svg'),
  'go_bank.svg': require('@/assets/banks/go_bank.svg'),
  'goldman_bank.svg': require('@/assets/banks/goldman_bank.svg'),
  'greenwich_bank.png': require('@/assets/banks/greenwich_bank.png'),
  'first_trust_bank.svg': require('@/assets/banks/first_trust_bank.svg'),
  'fsdh_bank.svg': require('@/assets/banks/fsdh_bank.svg'),
  'firmus_bank.png': require('@/assets/banks/firmus_bank.png'),
  'fair_money_bank.png': require('@/assets/banks/fair_money_bank.png'),
  'fedeth_bank.png': require('@/assets/banks/fedeth_bank.png'),
  'excel_bank.png': require('@/assets/banks/excel_bank.png'),
  'ekimogun_bank.png': require('@/assets/banks/ekimogun_bank.png'),
  'ekondo_bank.svg': require('@/assets/banks/ekondo_bank.svg'),
  'dot_bank.svg': require('@/assets/banks/dot_bank.svg'),
  'crust_bank.svg': require('@/assets/banks/crust_bank.svg'),
  'davenport_bank.png': require('@/assets/banks/davenport_bank.png'),
  'consumer_bank.png': require('@/assets/banks/consumer_bank.png'),
  'corestep_bank.svg': require('@/assets/banks/corestep_bank.svg'),
  'coronation_bank.svg': require('@/assets/banks/coronation_bank.svg'),
  'country_bank.png': require('@/assets/banks/country_bank.png'),
  'credit_direct_bank.svg': require('@/assets/banks/credit_direct_bank.svg'),
  'chanelle_bank.png': require('@/assets/banks/chanelle_bank.png'),
  'citi_bank.svg': require('@/assets/banks/citi_bank.svg'),
  'citycode_bank.png': require('@/assets/banks/citycode_bank.png'),
  'cemcs_bank.png': require('@/assets/banks/cemcs_bank.png'),
  'cashconnect_bank.png': require('@/assets/banks/cashconnect_bank.png'),
  'cashbridge_bank.svg': require('@/assets/banks/cashbridge_bank.svg'),
  'buypower_bank.svg': require('@/assets/banks/buypower_bank.svg'),
  'bell_bank.png': require('@/assets/banks/bell_bank.png'),
  'bowen_bank.png': require('@/assets/banks/bowen_bank.png'),
  'branch_bank.svg': require('@/assets/banks/branch_bank.svg'),
  'awacash_bank.png': require('@/assets/banks/awacash_bank.png'),
  '9mobile_bank.png': require('@/assets/banks/9mobile_bank.png'),
  'wema_bank.png': require('@/assets/banks/wema_bank.png'),
  'zenith_bank.png': require('@/assets/banks/zenith_bank.png'),
  'vfd_bank.png': require('@/assets/banks/vfd_bank.png'),
  'waya_bank.png': require('@/assets/banks/waya_bank.png'),
  'united_bank.png': require('@/assets/banks/united_bank.png'),
  'unity_bank.png': require('@/assets/banks/unity_bank.png'),
  'vale_bank.png': require('@/assets/banks/vale_bank.png'),
  'titan_bank.png': require('@/assets/banks/titan_bank.png'),
  'uhuru_bank.png': require('@/assets/banks/uhuru_bank.png'),
  'taj_bank.png': require('@/assets/banks/taj_bank.png'),
  'suntrust_bank.png': require('@/assets/banks/suntrust_bank.png'),
  'sparkle_bank.png': require('@/assets/banks/sparkle_bank.png'),
};

export function getBankIcon(bankName: string): BankIcon {
  if (!bankName) {
    return {};
  }

  // Normalize bank name for better matching
  const normalizedName = bankName.trim();
  
  // Try exact match first
  const assetName = bankNameToAsset[normalizedName];
  if (assetName && svgFiles[assetName]) {
    return { logoSvg: svgFiles[assetName] };
  }

  // Try partial matches
  for (const [key, asset] of Object.entries(bankNameToAsset)) {
    if (
      normalizedName.toLowerCase().includes(key.toLowerCase()) ||
      key.toLowerCase().includes(normalizedName.toLowerCase())
    ) {
      if (svgFiles[asset]) {
        return { logoSvg: svgFiles[asset] };
      }
    }
  }

  // Return empty object if no match found
  return {};
}

// Alternative function that returns logo instead of logoSvg for PNG files
export function getBankIconLogo(bankName: string): BankIcon {
  if (!bankName) {
    return {};
  }

  const normalizedName = bankName.trim();
  const assetName = bankNameToAsset[normalizedName];
  
  if (assetName && svgFiles[assetName]) {
    // Check if it's a PNG file
    if (assetName.endsWith('.png')) {
      return { logo: svgFiles[assetName] };
    } else {
      return { logoSvg: svgFiles[assetName] };
    }
  }

  // Try partial matches
  for (const [key, asset] of Object.entries(bankNameToAsset)) {
    if (
      normalizedName.toLowerCase().includes(key.toLowerCase()) ||
      key.toLowerCase().includes(normalizedName.toLowerCase())
    ) {
      if (svgFiles[asset]) {
        if (asset.endsWith('.png')) {
          return { logo: svgFiles[asset] };
        } else {
          return { logoSvg: svgFiles[asset] };
        }
      }
    }
  }

  return {};
} 