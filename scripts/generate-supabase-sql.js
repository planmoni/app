/**
 * Script to generate SQL for inserting bank comparison data into Supabase
 * 
 * Usage: node scripts/generate-supabase-sql.js
 * 
 * This script generates SQL INSERT statements that can be run in Supabase SQL Editor
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

// Escape SQL strings
function escapeSQL(str) {
  if (!str) return 'NULL';
  return "'" + str.replace(/'/g, "''") + "'";
}

// Generate SQL CREATE TABLE statement
const createTableSQL = `
-- Create bank_comparison table in Supabase
CREATE TABLE IF NOT EXISTS bank_comparison (
  id BIGSERIAL PRIMARY KEY,
  bank_name TEXT NOT NULL,
  paystack_code TEXT NOT NULL,
  safehaven_code TEXT,
  status TEXT NOT NULL,
  provider TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_bank_comparison_paystack_code ON bank_comparison(paystack_code);
CREATE INDEX IF NOT EXISTS idx_bank_comparison_safehaven_code ON bank_comparison(safehaven_code);
CREATE INDEX IF NOT EXISTS idx_bank_comparison_provider ON bank_comparison(provider);

-- Add comment
COMMENT ON TABLE bank_comparison IS 'Comparison table of Paystack and SafeHaven banks';
`;

// Generate comparison data
const comparisonData = paystackBanks.map(bank => {
  const safeHavenCode = findSafeHavenCode(bank.code, bank.name);
  return {
    bankName: bank.name,
    paystackCode: bank.code,
    safeHavenCode: safeHavenCode || null,
    status: safeHavenCode ? 'Available in SafeHaven' : 'Paystack Only',
    provider: safeHavenCode ? 'SafeHaven' : 'Paystack'
  };
});

// Generate INSERT statements
const insertStatements = comparisonData.map((row, index) => {
  return `INSERT INTO bank_comparison (bank_name, paystack_code, safehaven_code, status, provider) 
VALUES (${escapeSQL(row.bankName)}, ${escapeSQL(row.paystackCode)}, ${row.safeHavenCode ? escapeSQL(row.safeHavenCode) : 'NULL'}, ${escapeSQL(row.status)}, ${escapeSQL(row.provider)});`;
}).join('\n');

// Combine all SQL
const fullSQL = createTableSQL + '\n\n-- Insert bank comparison data\n' + insertStatements;

// Write SQL file
const sqlPath = path.join(__dirname, '..', 'supabase-bank-comparison.sql');
fs.writeFileSync(sqlPath, fullSQL, 'utf8');
console.log(`✅ SQL file written to: ${sqlPath}`);
console.log(`📊 Total banks: ${comparisonData.length}`);
console.log(`\n📝 Instructions:`);
console.log(`   1. Open Supabase Dashboard`);
console.log(`   2. Go to SQL Editor`);
console.log(`   3. Copy the contents of: ${sqlPath}`);
console.log(`   4. Paste into SQL Editor`);
console.log(`   5. Click "Run" to execute`);

// Also generate a simpler version for direct copy-paste
const simpleSQL = `-- Bank Comparison Table
-- Copy and paste this entire block into Supabase SQL Editor

${createTableSQL}

-- Insert data (${comparisonData.length} banks)
${insertStatements}
`;

const simplePath = path.join(__dirname, '..', 'supabase-bank-comparison-simple.sql');
fs.writeFileSync(simplePath, simpleSQL, 'utf8');
console.log(`✅ Simple SQL file written to: ${simplePath}`);

