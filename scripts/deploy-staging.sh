#!/bin/bash

# Staging Deployment Script
# This script deploys database migrations and edge functions to staging

set -e  # Exit on error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Configuration
STAGING_PROJECT_REF="${SUPABASE_STAGING_PROJECT_REF:-}"
ENV_FILE=".env.staging"

echo -e "${GREEN}🚀 Starting Staging Deployment${NC}"
echo ""

# Check if .env.staging exists
if [ ! -f "$ENV_FILE" ]; then
    echo -e "${RED}❌ Error: $ENV_FILE not found${NC}"
    echo "Please create .env.staging file with staging credentials"
    exit 1
fi

# Load environment variables
export $(cat $ENV_FILE | grep -v '^#' | xargs)

# Check if project ref is set
if [ -z "$STAGING_PROJECT_REF" ]; then
    echo -e "${YELLOW}⚠️  SUPABASE_STAGING_PROJECT_REF not set${NC}"
    echo "Please set it in .env.staging or as environment variable"
    read -p "Enter staging project ref: " STAGING_PROJECT_REF
fi

echo -e "${GREEN}📋 Staging Project: $STAGING_PROJECT_REF${NC}"
echo ""

# Function to deploy database
deploy_database() {
    echo -e "${GREEN}🗄️  Deploying database migrations...${NC}"
    supabase db push --project-ref "$STAGING_PROJECT_REF" || {
        echo -e "${RED}❌ Database deployment failed${NC}"
        exit 1
    }
    echo -e "${GREEN}✅ Database migrations deployed${NC}"
    echo ""
}

# Function to deploy functions
deploy_functions() {
    echo -e "${GREEN}⚡ Deploying edge functions...${NC}"
    
    # List of functions to deploy
    FUNCTIONS=(
        "process-due-payouts"
        "process-automated-payouts"
        "schedule-automated-payouts"
        "safehaven-webhook"
        "paystack-webhook-updated"
        "send-push-notification"
        "check-new-transactions"
        "mono-webhook"
        "mono-api-proxy"
    )
    
    for func in "${FUNCTIONS[@]}"; do
        echo -e "${YELLOW}  Deploying $func...${NC}"
        supabase functions deploy "$func" --project-ref "$STAGING_PROJECT_REF" || {
            echo -e "${RED}❌ Failed to deploy $func${NC}"
            # Continue with other functions
        }
    done
    
    echo -e "${GREEN}✅ Edge functions deployed${NC}"
    echo ""
}

# Function to set secrets
set_secrets() {
    echo -e "${GREEN}🔐 Setting function secrets...${NC}"
    echo -e "${YELLOW}⚠️  Note: You may need to set secrets manually${NC}"
    echo ""
    
    # Check if secrets are set in env file
    if [ -n "$PAYSTACK_SECRET_KEY" ]; then
        echo "Setting Paystack secrets..."
        supabase secrets set \
            PAYSTACK_SECRET_KEY="$PAYSTACK_SECRET_KEY" \
            PAYSTACK_LIVE_SECRET_KEY="${PAYSTACK_LIVE_SECRET_KEY:-$PAYSTACK_SECRET_KEY}" \
            --project-ref "$STAGING_PROJECT_REF" || echo "Failed to set Paystack secrets"
    fi
    
    if [ -n "$SUPABASE_SERVICE_ROLE_KEY" ]; then
        echo "Setting Supabase service role key..."
        supabase secrets set \
            SUPABASE_SERVICE_ROLE_KEY="$SUPABASE_SERVICE_ROLE_KEY" \
            --project-ref "$STAGING_PROJECT_REF" || echo "Failed to set Supabase secrets"
    fi
    
    echo -e "${GREEN}✅ Secrets configured${NC}"
    echo ""
}

# Main deployment flow
main() {
    echo "What would you like to deploy?"
    echo "1) Database only"
    echo "2) Functions only"
    echo "3) Everything (Database + Functions)"
    echo "4) Secrets only"
    echo "5) Cancel"
    read -p "Enter choice [1-5]: " choice
    
    case $choice in
        1)
            deploy_database
            ;;
        2)
            deploy_functions
            ;;
        3)
            deploy_database
            deploy_functions
            set_secrets
            ;;
        4)
            set_secrets
            ;;
        5)
            echo "Deployment cancelled"
            exit 0
            ;;
        *)
            echo -e "${RED}Invalid choice${NC}"
            exit 1
            ;;
    esac
    
    echo -e "${GREEN}🎉 Deployment complete!${NC}"
    echo ""
    echo "Next steps:"
    echo "1. Verify deployment in Supabase Dashboard"
    echo "2. Test functions in staging"
    echo "3. Check logs for any errors"
}

# Run main function
main
