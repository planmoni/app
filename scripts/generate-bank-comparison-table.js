/**
 * Script to generate a comparison table of Paystack and SafeHaven banks
 * 
 * Usage: node scripts/generate-bank-comparison-table.js
 * 
 * This script generates a CSV and Markdown table showing:
 * - Bank Name
 * - Paystack Bank Code
 * - SafeHaven Bank Code (if available)
 * - Status (Available in SafeHaven / Paystack Only)
 */

const fs = require('fs');
const path = require('path');

// Load Paystack banks
let paystackBanks = [];
try {
  const paystackData = JSON.parse(
    fs.readFileSync(path.join(__dirname, '..', 'lib', 'paystack-banks.json'), 'utf8')
  );
  paystackBanks = paystackData.data || [];
} catch (e) {
  console.error('❌ Error loading Paystack banks:', e.message);
  process.exit(1);
}

// Load SafeHaven banks
let safeHavenBanks = [];
try {
  const safeHavenData = JSON.parse(
    fs.readFileSync(path.join(__dirname, '..', 'lib', 'safehaven-banks.json'), 'utf8')
  );
  safeHavenBanks = safeHavenData.data || [];
} catch (e) {
  console.error('❌ Error loading SafeHaven banks:', e.message);
  process.exit(1);
}

// Normalize bank name for comparison
function normalizeBankName(name) {
  return name.toUpperCase().trim().replace(/\s+/g, ' ');
}

// Find SafeHaven bank code by Paystack code or name
function findSafeHavenCode(paystackCode, bankName) {
  // Direct mapping (from the mapper)
  const PAYSTACK_TO_SAFEHAVEN_MAP = {
    '044': '000014', // Access Bank
    '063': '000005', // Access Bank (Diamond)
    '050': '000010', // Ecobank
    '070': '000007', // Fidelity Bank
    '011': '000016', // First Bank
    '214': '000003', // FCMB
    '058': '000013', // GTBank
    '301': '000006', // Jaiz Bank
    '082': '000002', // Keystone Bank
    '232': '000001', // Sterling Bank
    '032': '000018', // Union Bank
    '033': '000004', // UBA
    '215': '000011', // Unity Bank
    '035': '000017', // Wema Bank
    '057': '000015', // Zenith Bank
    '101': '000023', // Providus Bank
    '102': '000025', // Titan Trust Bank
    '100': '000022', // Suntrust Bank
    '302': '000026', // Taj Bank
    '00103': '000027', // Globus Bank
    '303': '000029', // Lotus Bank
    '104': '000030', // Parallex Bank
    '105': '000031', // Premium Trust Bank
    '106': '000034', // Signature Bank
    '107': '000036', // Optimus Bank
    '076': '000008', // Polaris Bank
    '221': '000012', // Stanbic IBTC
    '068': '000021', // Standard Chartered
    '023': '000009', // Citi Bank
    '50211': '090267', // Kuda
    '999992': '100004', // OPay
    '999991': '100033', // PalmPay
    '565': '100026', // Carbon
    '50515': '090405', // Moniepoint
  };

  // Try direct code mapping first
  if (paystackCode && PAYSTACK_TO_SAFEHAVEN_MAP[paystackCode]) {
    return PAYSTACK_TO_SAFEHAVEN_MAP[paystackCode];
  }

  // Try to find by bank name
  if (bankName) {
    const normalizedName = normalizeBankName(bankName);
    
    // Exact match
    for (const bank of safeHavenBanks) {
      if (normalizeBankName(bank.name) === normalizedName) {
        return bank.bankCode;
      }
    }

    // Alias match
    for (const bank of safeHavenBanks) {
      if (bank.alias && bank.alias.length > 0) {
        for (const alias of bank.alias) {
          if (normalizeBankName(alias) === normalizedName) {
            return bank.bankCode;
          }
        }
      }
    }

    // Partial match
    for (const bank of safeHavenBanks) {
      const bankNameNormalized = normalizeBankName(bank.name);
      if (bankNameNormalized.includes(normalizedName) || normalizedName.includes(bankNameNormalized)) {
        return bank.bankCode;
      }
      
      if (bank.alias && bank.alias.length > 0) {
        for (const alias of bank.alias) {
          const aliasNormalized = normalizeBankName(alias);
          if (aliasNormalized.includes(normalizedName) || normalizedName.includes(aliasNormalized)) {
            return bank.bankCode;
          }
        }
      }
    }
  }

  return null;
}

// Generate comparison data
const comparisonData = paystackBanks.map(bank => {
  const safeHavenCode = findSafeHavenCode(bank.code, bank.name);
  return {
    bankName: bank.name,
    paystackCode: bank.code,
    safeHavenCode: safeHavenCode || 'N/A',
    status: safeHavenCode ? 'Available in SafeHaven' : 'Paystack Only',
    provider: safeHavenCode ? 'SafeHaven' : 'Paystack'
  };
});

// Sort by status (Paystack Only first, then Available in SafeHaven)
comparisonData.sort((a, b) => {
  if (a.status === 'Paystack Only' && b.status !== 'Paystack Only') return -1;
  if (a.status !== 'Paystack Only' && b.status === 'Paystack Only') return 1;
  return a.bankName.localeCompare(b.bankName);
});

// Generate CSV
const csvHeader = 'Bank Name,Paystack Code,SafeHaven Code,Status,Provider\n';
const csvRows = comparisonData.map(row => 
  `"${row.bankName}","${row.paystackCode}","${row.safeHavenCode}","${row.status}","${row.provider}"`
).join('\n');
const csvContent = csvHeader + csvRows;

// Generate Markdown table
const mdHeader = '| Bank Name | Paystack Code | SafeHaven Code | Status | Provider |\n';
const mdSeparator = '|------------|---------------|----------------|--------|----------|\n';
const mdRows = comparisonData.map(row => 
  `| ${row.bankName} | ${row.paystackCode} | ${row.safeHavenCode} | ${row.status} | ${row.provider} |`
).join('\n');
const mdContent = mdHeader + mdSeparator + mdRows;

// Write CSV file
const csvPath = path.join(__dirname, '..', 'bank-comparison-table.csv');
fs.writeFileSync(csvPath, csvContent, 'utf8');
console.log(`✅ CSV table written to: ${csvPath}`);

// Write Markdown file
const mdPath = path.join(__dirname, '..', 'bank-comparison-table.md');
fs.writeFileSync(mdPath, mdContent, 'utf8');
console.log(`✅ Markdown table written to: ${mdPath}`);

// Statistics
const paystackOnlyCount = comparisonData.filter(r => r.status === 'Paystack Only').length;
const safeHavenAvailableCount = comparisonData.filter(r => r.status === 'Available in SafeHaven').length;

console.log('\n📊 Statistics:');
console.log(`   Total Paystack banks: ${paystackBanks.length}`);
console.log(`   Available in SafeHaven: ${safeHavenAvailableCount}`);
console.log(`   Paystack Only (use Paystack): ${paystackOnlyCount}`);
console.log(`   Coverage: ${((safeHavenAvailableCount / paystackBanks.length) * 100).toFixed(2)}%`);

// Generate summary of Paystack-only banks
const paystackOnlyBanks = comparisonData.filter(r => r.status === 'Paystack Only');
const summaryPath = path.join(__dirname, '..', 'paystack-only-banks.md');
const summaryContent = `# Banks Available Only in Paystack

These banks are NOT available in SafeHaven and should use Paystack for transfers.

Total: ${paystackOnlyBanks.length} banks

| Bank Name | Paystack Code |
|-----------|---------------|
${paystackOnlyBanks.map(b => `| ${b.bankName} | ${b.paystackCode} |`).join('\n')}
`;

fs.writeFileSync(summaryPath, summaryContent, 'utf8');
console.log(`✅ Paystack-only banks summary written to: ${summaryPath}`);

