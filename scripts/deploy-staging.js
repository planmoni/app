#!/usr/bin/env node

/**
 * Staging Deployment Script (Node.js version)
 * Deploys database migrations and edge functions to staging environment
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const readline = require('readline');

const ENV_FILE = '.env.staging';
const STAGING_FUNCTIONS = [
  'process-due-payouts',
  'process-automated-payouts',
  'schedule-automated-payouts',
  'safehaven-webhook',
  'paystack-webhook-updated',
  'send-push-notification',
  'check-new-transactions',
  'mono-webhook',
  'mono-api-proxy',
];

// Colors for console output
const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function loadEnvFile() {
  if (!fs.existsSync(ENV_FILE)) {
    log(`❌ Error: ${ENV_FILE} not found`, 'red');
    log('Please create .env.staging file with staging credentials', 'yellow');
    process.exit(1);
  }

  const envContent = fs.readFileSync(ENV_FILE, 'utf8');
  const envVars = {};
  
  envContent.split('\n').forEach(line => {
    line = line.trim();
    if (line && !line.startsWith('#')) {
      const [key, ...valueParts] = line.split('=');
      if (key && valueParts.length > 0) {
        envVars[key.trim()] = valueParts.join('=').trim().replace(/^["']|["']$/g, '');
      }
    }
  });

  return envVars;
}

function getProjectRef(envVars) {
  return envVars.SUPABASE_STAGING_PROJECT_REF || 
         process.env.SUPABASE_STAGING_PROJECT_REF ||
         null;
}

function deployDatabase(projectRef) {
  log('🗄️  Deploying database migrations...', 'green');
  try {
    execSync(`supabase db push --project-ref ${projectRef}`, {
      stdio: 'inherit',
      cwd: process.cwd()
    });
    log('✅ Database migrations deployed', 'green');
    return true;
  } catch (error) {
    log('❌ Database deployment failed', 'red');
    return false;
  }
}

function deployFunctions(projectRef) {
  log('⚡ Deploying edge functions...', 'green');
  let successCount = 0;
  let failCount = 0;

  STAGING_FUNCTIONS.forEach(func => {
    log(`  Deploying ${func}...`, 'yellow');
    try {
      execSync(`supabase functions deploy ${func} --project-ref ${projectRef}`, {
        stdio: 'inherit',
        cwd: process.cwd()
      });
      successCount++;
    } catch (error) {
      log(`  ❌ Failed to deploy ${func}`, 'red');
      failCount++;
    }
  });

  log(`✅ Deployed ${successCount} functions${failCount > 0 ? `, ${failCount} failed` : ''}`, 'green');
  return failCount === 0;
}

function setSecrets(projectRef, envVars) {
  log('🔐 Setting function secrets...', 'green');
  log('⚠️  Note: You may need to set secrets manually in Supabase Dashboard', 'yellow');

  const secrets = [];
  
  if (envVars.PAYSTACK_SECRET_KEY) {
    secrets.push(`PAYSTACK_SECRET_KEY=${envVars.PAYSTACK_SECRET_KEY}`);
  }
  
  if (envVars.PAYSTACK_LIVE_SECRET_KEY) {
    secrets.push(`PAYSTACK_LIVE_SECRET_KEY=${envVars.PAYSTACK_LIVE_SECRET_KEY}`);
  }
  
  if (envVars.SUPABASE_SERVICE_ROLE_KEY) {
    secrets.push(`SUPABASE_SERVICE_ROLE_KEY=${envVars.SUPABASE_SERVICE_ROLE_KEY}`);
  }
  
  if (envVars.SAFEHAVEN_CLIENT_ID) {
    secrets.push(`EXPO_PUBLIC_SAFEHAVEN_CLIENT_ID=${envVars.EXPO_PUBLIC_SAFEHAVEN_CLIENT_ID}`);
  }
  
  if (envVars.SAFEHAVEN_CLIENT_ASSERTION) {
    secrets.push(`EXPO_PUBLIC_SAFEHAVEN_CLIENT_ASSERTION=${envVars.EXPO_PUBLIC_SAFEHAVEN_CLIENT_ASSERTION}`);
  }

  if (secrets.length > 0) {
    try {
      const secretsCmd = secrets.join(' ');
      execSync(`supabase secrets set ${secretsCmd} --project-ref ${projectRef}`, {
        stdio: 'inherit',
        cwd: process.cwd()
      });
      log('✅ Secrets configured', 'green');
      return true;
    } catch (error) {
      log('⚠️  Failed to set some secrets. Set them manually in Supabase Dashboard', 'yellow');
      return false;
    }
  } else {
    log('⚠️  No secrets found in .env.staging', 'yellow');
    return false;
  }
}

function askQuestion(question) {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });

  return new Promise(resolve => {
    rl.question(question, answer => {
      rl.close();
      resolve(answer);
    });
  });
}

async function main() {
  log('🚀 Starting Staging Deployment', 'green');
  console.log('');

  const envVars = loadEnvFile();
  let projectRef = getProjectRef(envVars);

  if (!projectRef) {
    log('⚠️  SUPABASE_STAGING_PROJECT_REF not set', 'yellow');
    projectRef = await askQuestion('Enter staging project ref: ');
    if (!projectRef) {
      log('❌ Project ref required', 'red');
      process.exit(1);
    }
  }

  log(`📋 Staging Project: ${projectRef}`, 'green');
  console.log('');

  log('What would you like to deploy?', 'blue');
  log('1) Database only', 'blue');
  log('2) Functions only', 'blue');
  log('3) Everything (Database + Functions + Secrets)', 'blue');
  log('4) Secrets only', 'blue');
  log('5) Cancel', 'blue');
  
  const choice = await askQuestion('Enter choice [1-5]: ');

  let success = true;

  switch (choice) {
    case '1':
      success = deployDatabase(projectRef);
      break;
    case '2':
      success = deployFunctions(projectRef);
      break;
    case '3':
      success = deployDatabase(projectRef);
      success = deployFunctions(projectRef) && success;
      setSecrets(projectRef, envVars);
      break;
    case '4':
      setSecrets(projectRef, envVars);
      break;
    case '5':
      log('Deployment cancelled', 'yellow');
      process.exit(0);
      break;
    default:
      log('Invalid choice', 'red');
      process.exit(1);
  }

  console.log('');
  if (success) {
    log('🎉 Deployment complete!', 'green');
    console.log('');
    log('Next steps:', 'blue');
    log('1. Verify deployment in Supabase Dashboard', 'blue');
    log('2. Test functions in staging', 'blue');
    log('3. Check logs for any errors', 'blue');
  } else {
    log('⚠️  Deployment completed with some errors', 'yellow');
    log('Please check the output above for details', 'yellow');
  }
}

// Run if called directly
if (require.main === module) {
  main().catch(error => {
    log(`❌ Error: ${error.message}`, 'red');
    process.exit(1);
  });
}

module.exports = { deployDatabase, deployFunctions, setSecrets };
