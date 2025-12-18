# Migration Fix Summary - Categories/Subcategories Storage

## Issue
Categories and subcategories were not being saved to the database when creating expense plans. The columns existed but were showing empty arrays `[]`.

## Root Causes
1. **Draft Plan Creation**: Categories/subcategories were being saved in `plan-details.tsx` but only to draft plans
2. **Final Plan Creation**: When finalizing the plan in `review.tsx`, `createCompletePlan` creates a NEW active plan without reading categories from the draft
3. **Missing Extraction**: Categories/subcategories weren't being extracted from buckets before plan creation

## Fixes Applied

### 1. Updated `saveDraftExpensePlan` (hooks/useExpensePlans.ts)
- Added `categories` and `subcategories` parameters
- Saves these fields when creating or updating draft plans
- Categories saved as array of category IDs: `["air_travel", "car_maintenance"]`
- Subcategories saved as array of objects: `[{"category_id": "air_travel", "subcategory_id": "flight_tickets"}]`

### 2. Updated `plan-details.tsx` handleContinue
- Extracts categories and subcategories from `selectedSubCategories` state
- Passes them to `saveDraftExpensePlan` when saving draft plan
- Ensures categories are saved immediately when selected

### 3. Updated `createCompletePlan` (hooks/useExpensePlans.ts)
- Extracts categories/subcategories from buckets BEFORE creating the plan
- Includes them in the initial plan insert
- Also includes them in fallback data if column errors occur
- The trigger will also update them when buckets are created/updated

## Migration File
`supabase/migrations/20250118000000_add_categories_to_expense_plans.sql`
- Adds `categories` and `subcategories` JSONB columns
- Creates GIN indexes for performance
- Creates trigger to auto-update from buckets
- Backfills existing plans

## Testing Checklist
1. ✅ Create new budget plan
2. ✅ Select categories on "What are you planning for?" page
3. ✅ Verify categories saved to draft plan
4. ✅ Complete plan creation
5. ✅ Verify categories/subcategories in final plan
6. ✅ Check database columns show correct data

## Next Steps
1. Run the migration if not already applied: `npx supabase migration up`
2. Test creating a new plan with categories
3. Verify data appears in database
4. If still empty, check:
   - Migration has been applied
   - No errors in console when saving
   - Buckets are being created with correct category_id/subcategory_id

