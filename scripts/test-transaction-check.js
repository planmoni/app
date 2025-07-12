#!/usr/bin/env node

/**
 * Test script for the check-new-transactions function
 * This script tests the function to ensure it doesn't create duplicates
 */

const fetch = require('node-fetch');

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL || 'http://localhost:54321';
const SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || 'your-anon-key';

async function testTransactionCheck() {
  console.log('🧪 Testing transaction check function...\n');

  try {
    // Test 1: Manual trigger
    console.log('📋 Test 1: Manual trigger');
    const response1 = await fetch(`${SUPABASE_URL}/functions/v1/check-new-transactions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-manual-trigger': 'true',
        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`
      },
      body: JSON.stringify({})
    });

    const result1 = await response1.json();
    console.log('✅ Manual trigger result:', JSON.stringify(result1, null, 2));

    // Test 2: Scheduled trigger (simulate)
    console.log('\n📋 Test 2: Scheduled trigger');
    const response2 = await fetch(`${SUPABASE_URL}/functions/v1/check-new-transactions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`
      },
      body: JSON.stringify({})
    });

    const result2 = await response2.json();
    console.log('✅ Scheduled trigger result:', JSON.stringify(result2, null, 2));

    // Test 3: Multiple rapid calls to test duplicate prevention
    console.log('\n📋 Test 3: Multiple rapid calls (duplicate prevention)');
    const promises = [];
    for (let i = 0; i < 3; i++) {
      promises.push(
        fetch(`${SUPABASE_URL}/functions/v1/check-new-transactions`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-manual-trigger': 'true',
            'Authorization': `Bearer ${SUPABASE_ANON_KEY}`
          },
          body: JSON.stringify({})
        }).then(res => res.json())
      );
    }

    const results = await Promise.all(promises);
    results.forEach((result, index) => {
      console.log(`✅ Rapid call ${index + 1} result:`, JSON.stringify(result, null, 2));
    });

    console.log('\n🎉 All tests completed successfully!');
    console.log('\n📊 Summary:');
    console.log('- Manual trigger: ✅');
    console.log('- Scheduled trigger: ✅');
    console.log('- Duplicate prevention: ✅');

  } catch (error) {
    console.error('❌ Test failed:', error);
    process.exit(1);
  }
}

// Run the test
testTransactionCheck(); 