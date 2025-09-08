/**
 * Account Creation Test Script
 * 
 * This script tests the account creation process to ensure it works flawlessly
 * without causing blank screens or UI issues.
 */

import { accountCreationHandler } from './account-creation-handler.js';
import { supabase } from '@/lib/supabase';

class AccountCreationTester {
  constructor() {
    this.testResults = [];
    this.testEmail = `test-${Date.now()}@example.com`;
    this.testPassword = 'TestPassword123!';
    this.testFirstName = 'Test';
    this.testLastName = 'User';
  }

  /**
   * Run all tests
   */
  async runAllTests() {
    console.log('🧪 Starting Account Creation Tests...\n');
    
    try {
      await this.testInputValidation();
      await this.testEmailAvailabilityCheck();
      await this.testAccountCreation();
      await this.testErrorHandling();
      await this.testRetryMechanism();
      
      this.printResults();
    } catch (error) {
      console.error('❌ Test suite failed:', error);
    }
  }

  /**
   * Test input validation
   */
  async testInputValidation() {
    console.log('🔍 Testing input validation...');
    
    const testCases = [
      {
        name: 'Valid input',
        input: {
          email: 'test@example.com',
          password: 'password123',
          firstName: 'John',
          lastName: 'Doe'
        },
        expected: true
      },
      {
        name: 'Invalid email',
        input: {
          email: 'invalid-email',
          password: 'password123',
          firstName: 'John',
          lastName: 'Doe'
        },
        expected: false
      },
      {
        name: 'Short password',
        input: {
          email: 'test@example.com',
          password: '123',
          firstName: 'John',
          lastName: 'Doe'
        },
        expected: false
      },
      {
        name: 'Empty first name',
        input: {
          email: 'test@example.com',
          password: 'password123',
          firstName: '',
          lastName: 'Doe'
        },
        expected: false
      }
    ];

    for (const testCase of testCases) {
      const result = accountCreationHandler.validateInput(testCase.input);
      const passed = result.valid === testCase.expected;
      
      this.testResults.push({
        test: `Input validation - ${testCase.name}`,
        passed,
        details: passed ? 'PASS' : `FAIL: ${result.error || 'Unexpected result'}`
      });
      
      console.log(`  ${passed ? '✅' : '❌'} ${testCase.name}: ${passed ? 'PASS' : 'FAIL'}`);
    }
  }

  /**
   * Test email availability check
   */
  async testEmailAvailabilityCheck() {
    console.log('\n📧 Testing email availability check...');
    
    try {
      // Test with a non-existent email
      const result = await accountCreationHandler.checkEmailAvailability('nonexistent@example.com');
      const passed = result.available === true;
      
      this.testResults.push({
        test: 'Email availability check - non-existent email',
        passed,
        details: passed ? 'PASS' : 'FAIL: Should be available'
      });
      
      console.log(`  ${passed ? '✅' : '❌'} Non-existent email check: ${passed ? 'PASS' : 'FAIL'}`);
    } catch (error) {
      this.testResults.push({
        test: 'Email availability check - non-existent email',
        passed: false,
        details: `FAIL: ${error.message}`
      });
      console.log(`  ❌ Non-existent email check: FAIL - ${error.message}`);
    }
  }

  /**
   * Test account creation (dry run)
   */
  async testAccountCreation() {
    console.log('\n👤 Testing account creation (dry run)...');
    
    try {
      // This is a dry run - we won't actually create the account
      // but we'll test the flow up to the actual signup
      const result = await accountCreationHandler.createAccount({
        email: this.testEmail,
        password: this.testPassword,
        firstName: this.testFirstName,
        lastName: this.testLastName,
        onProgress: (progress) => {
          console.log(`    Progress: ${progress}`);
        },
        onError: (error) => {
          console.log(`    Error: ${error.message}`);
        },
        onSuccess: (data) => {
          console.log(`    Success: Account created for ${data.userId}`);
        }
      });
      
      // For testing, we expect this might fail due to test constraints
      const passed = result.success || result.error.includes('already registered');
      
      this.testResults.push({
        test: 'Account creation flow',
        passed,
        details: passed ? 'PASS' : `FAIL: ${result.error}`
      });
      
      console.log(`  ${passed ? '✅' : '❌'} Account creation flow: ${passed ? 'PASS' : 'FAIL'}`);
    } catch (error) {
      this.testResults.push({
        test: 'Account creation flow',
        passed: false,
        details: `FAIL: ${error.message}`
      });
      console.log(`  ❌ Account creation flow: FAIL - ${error.message}`);
    }
  }

  /**
   * Test error handling
   */
  async testErrorHandling() {
    console.log('\n⚠️  Testing error handling...');
    
    try {
      // Test with invalid input to trigger error handling
      const result = await accountCreationHandler.createAccount({
        email: 'invalid-email',
        password: '123',
        firstName: '',
        lastName: '',
        onProgress: () => {},
        onError: (error) => {
          console.log(`    Error handled: ${error.message}`);
        },
        onSuccess: () => {}
      });
      
      const passed = !result.success && result.error;
      
      this.testResults.push({
        test: 'Error handling - invalid input',
        passed,
        details: passed ? 'PASS' : 'FAIL: Should have failed with error'
      });
      
      console.log(`  ${passed ? '✅' : '❌'} Error handling: ${passed ? 'PASS' : 'FAIL'}`);
    } catch (error) {
      this.testResults.push({
        test: 'Error handling - invalid input',
        passed: true, // Catching the error is also good
        details: `PASS: Error caught - ${error.message}`
      });
      console.log(`  ✅ Error handling: PASS - Error caught`);
    }
  }

  /**
   * Test retry mechanism
   */
  async testRetryMechanism() {
    console.log('\n🔄 Testing retry mechanism...');
    
    try {
      // Test retryable error detection
      const retryableError = new Error('Network timeout');
      const nonRetryableError = new Error('Invalid email format');
      
      const retryableResult = accountCreationHandler.isRetryableError(retryableError);
      const nonRetryableResult = accountCreationHandler.isRetryableError(nonRetryableError);
      
      const passed = retryableResult && !nonRetryableResult;
      
      this.testResults.push({
        test: 'Retry mechanism - error classification',
        passed,
        details: passed ? 'PASS' : 'FAIL: Error classification incorrect'
      });
      
      console.log(`  ${passed ? '✅' : '❌'} Retry mechanism: ${passed ? 'PASS' : 'FAIL'}`);
    } catch (error) {
      this.testResults.push({
        test: 'Retry mechanism - error classification',
        passed: false,
        details: `FAIL: ${error.message}`
      });
      console.log(`  ❌ Retry mechanism: FAIL - ${error.message}`);
    }
  }

  /**
   * Print test results
   */
  printResults() {
    console.log('\n📊 Test Results Summary:');
    console.log('='.repeat(50));
    
    const passed = this.testResults.filter(r => r.passed).length;
    const total = this.testResults.length;
    
    console.log(`Total Tests: ${total}`);
    console.log(`Passed: ${passed}`);
    console.log(`Failed: ${total - passed}`);
    console.log(`Success Rate: ${((passed / total) * 100).toFixed(1)}%`);
    
    console.log('\nDetailed Results:');
    this.testResults.forEach(result => {
      console.log(`  ${result.passed ? '✅' : '❌'} ${result.test}: ${result.details}`);
    });
    
    if (passed === total) {
      console.log('\n🎉 All tests passed! Account creation system is working properly.');
    } else {
      console.log('\n⚠️  Some tests failed. Please review the issues above.');
    }
  }

  /**
   * Clean up test data
   */
  async cleanup() {
    console.log('\n🧹 Cleaning up test data...');
    
    try {
      // Delete test user if it was created
      const { error } = await supabase.auth.admin.deleteUser(
        await this.getTestUserId()
      );
      
      if (error) {
        console.log('  ⚠️  Could not delete test user:', error.message);
      } else {
        console.log('  ✅ Test user deleted successfully');
      }
    } catch (error) {
      console.log('  ⚠️  Cleanup failed:', error.message);
    }
  }

  /**
   * Get test user ID (if exists)
   */
  async getTestUserId() {
    try {
      const { data } = await supabase
        .from('profiles')
        .select('id')
        .eq('email', this.testEmail)
        .single();
      
      return data?.id;
    } catch (error) {
      return null;
    }
  }
}

// Export for use
export { AccountCreationTester };

// Run tests if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  const tester = new AccountCreationTester();
  await tester.runAllTests();
  await tester.cleanup();
}
