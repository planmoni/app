/**
 * Script to generate SQL INSERT statements for bank_comparison table
 * 
 * Usage: node scripts/generate-bank-comparison-insert-sql.js
 * 
 * This generates SQL INSERT statements that you can copy and paste into Supabase SQL Editor
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
  const PAYSTACK_TO_SAFEHAVEN_MAP = {
    '044': '000014', '063': '000005', '050': '000010', '070': '000007',
    '011': '000016', '214': '000003', '058': '000013', '301': '000006',
    '082': '000002', '232': '000001', '032': '000018', '033': '000004',
    '215': '000011', '035': '000017', '057': '000015', '101': '000023',
    '102': '000025', '100': '000022', '302': '000026', '00103': '000027',
    '303': '000029', '104': '000030', '105': '000031', '106': '000034',
    '107': '000036', '076': '000008', '221': '000012', '068': '000021',
    '023': '000009', '50211': '090267', '999992': '100004', '999991': '100033',
    '565': '100026', '50515': '090405',
  };

  if (paystackCode && PAYSTACK_TO_SAFEHAVEN_MAP[paystackCode]) {
    return PAYSTACK_TO_SAFEHAVEN_MAP[paystackCode];
  }

  if (bankName) {
    const normalizedName = normalizeBankName(bankName);
    
    for (const bank of safeHavenBanks) {
      if (normalizeBankName(bank.name) === normalizedName) {
        return bank.bankCode;
      }
    }

    for (const bank of safeHavenBanks) {
      if (bank.alias && bank.alias.length > 0) {
        for (const alias of bank.alias) {
          if (normalizeBankName(alias) === normalizedName) {
            return bank.bankCode;
          }
        }
      }
    }

    for (const bank of safeHavenBanks) {
      const bankNameNormalized = normalizeBankName(bank.name);
      if (bankNameNormalized.includes(normalizedName) || normalizedName.includes(bankNameNormalized)) {
        return bank.bankCode;
      }
    }
  }

  return null;
}

// Escape single quotes for SQL
function escapeSQL(str) {
  return str.replace(/'/g, "''");
}

// Generate INSERT statements
const insertStatements = paystackBanks.map(bank => {
  const safeHavenCode = findSafeHavenCode(bank.code, bank.name);
  const status = safeHavenCode ? 'Available in SafeHaven' : 'Paystack Only';
  const provider = safeHavenCode ? 'SafeHaven' : 'Paystack';
  const safeHavenCodeValue = safeHavenCode ? `'${safeHavenCode}'` : 'NULL';
  
  return `INSERT INTO bank_comparison (bank_name, paystack_code, safehaven_code, status, provider) VALUES ('${escapeSQL(bank.name)}', '${escapeSQL(bank.code)}', ${safeHavenCodeValue}, '${status}', '${provider}');`;
});

// Combine all statements
const sqlContent = `-- Bank Comparison Data
-- Generated: ${new Date().toISOString()}
-- Total banks: ${paystackBanks.length}

-- Clear existing data (optional - comment out if you want to keep existing data)
-- TRUNCATE TABLE bank_comparison;

-- Insert bank comparison data
${insertStatements.join('\n')}

-- Verify the data
SELECT 
  status,
  COUNT(*) as count
FROM bank_comparison
GROUP BY status
ORDER BY status;
`;

// Write SQL file
const sqlPath = path.join(__dirname, '..', 'bank-comparison-insert.sql');
fs.writeFileSync(sqlPath, sqlContent, 'utf8');
console.log(`✅ SQL INSERT statements written to: ${sqlPath}`);
console.log(`📋 You can now copy and paste this into Supabase SQL Editor`);
console.log(`📊 Total INSERT statements: ${insertStatements.length}`);

