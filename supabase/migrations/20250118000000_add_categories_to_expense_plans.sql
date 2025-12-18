/*
  # Add Categories and Subcategories to Expense Plans
  
  This migration adds columns to store categories and subcategories at the plan level
  for easier filtering, searching, and analytics without needing to query buckets.
*/

-- Add categories and subcategories columns to expense_plans table
ALTER TABLE expense_plans
  ADD COLUMN IF NOT EXISTS categories jsonb DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS subcategories jsonb DEFAULT '[]'::jsonb;

-- Add comments for documentation
COMMENT ON COLUMN expense_plans.categories IS 'Array of category IDs used in this plan. Example: ["air_travel", "car_maintenance"]';
COMMENT ON COLUMN expense_plans.subcategories IS 'Array of objects with category_id and subcategory_id. Example: [{"category_id": "air_travel", "subcategory_id": "flight_tickets"}, {"category_id": "car_maintenance", "subcategory_id": "car_repair"}]';

-- Create index for faster category filtering
CREATE INDEX IF NOT EXISTS idx_expense_plans_categories ON expense_plans USING GIN (categories);

-- Create index for faster subcategory filtering
CREATE INDEX IF NOT EXISTS idx_expense_plans_subcategories ON expense_plans USING GIN (subcategories);

-- Function to automatically extract and update categories/subcategories from buckets
-- This can be called when buckets are created/updated
CREATE OR REPLACE FUNCTION update_plan_categories_from_buckets()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  v_plan_id uuid;
  v_categories jsonb := '[]'::jsonb;
  v_subcategories jsonb := '[]'::jsonb;
  v_category_id text;
  v_subcategory_id text;
  v_unique_categories text[] := ARRAY[]::text[];
BEGIN
  -- Determine plan_id based on trigger operation
  IF TG_OP = 'DELETE' THEN
    v_plan_id := OLD.expense_plan_id;
  ELSE
    v_plan_id := NEW.expense_plan_id;
  END IF;

  -- Collect unique categories and all subcategories from buckets
  FOR v_category_id, v_subcategory_id IN
    SELECT DISTINCT category_id, subcategory_id
    FROM expense_buckets
    WHERE expense_plan_id = v_plan_id
    ORDER BY category_id, subcategory_id
  LOOP
    -- Add unique category to array
    IF NOT (v_category_id = ANY(v_unique_categories)) THEN
      v_unique_categories := array_append(v_unique_categories, v_category_id);
    END IF;

    -- Add subcategory object
    v_subcategories := v_subcategories || jsonb_build_object(
      'category_id', v_category_id,
      'subcategory_id', v_subcategory_id
    );
  END LOOP;

  -- Convert unique categories array to JSONB array
  v_categories := to_jsonb(v_unique_categories);

  -- Update expense_plans with extracted categories and subcategories
  UPDATE expense_plans
  SET 
    categories = v_categories,
    subcategories = v_subcategories,
    updated_at = now()
  WHERE id = v_plan_id;

  RETURN COALESCE(NEW, OLD);
END;
$$;

-- Create trigger to automatically update categories/subcategories when buckets change
DROP TRIGGER IF EXISTS trg_update_plan_categories_from_buckets ON expense_buckets;
CREATE TRIGGER trg_update_plan_categories_from_buckets
  AFTER INSERT OR UPDATE OR DELETE ON expense_buckets
  FOR EACH ROW
  EXECUTE FUNCTION update_plan_categories_from_buckets();

-- Backfill existing plans with categories/subcategories from their buckets
DO $$
DECLARE
  v_plan expense_plans%ROWTYPE;
  v_categories jsonb;
  v_subcategories jsonb;
  v_category_id text;
  v_subcategory_id text;
  v_unique_categories text[] := ARRAY[]::text[];
BEGIN
  FOR v_plan IN SELECT * FROM expense_plans
  LOOP
    -- Reset for each plan
    v_unique_categories := ARRAY[]::text[];
    v_categories := '[]'::jsonb;
    v_subcategories := '[]'::jsonb;

    -- Collect categories and subcategories from buckets
    FOR v_category_id, v_subcategory_id IN
      SELECT DISTINCT category_id, subcategory_id
      FROM expense_buckets
      WHERE expense_plan_id = v_plan.id
      ORDER BY category_id, subcategory_id
    LOOP
      -- Add unique category
      IF NOT (v_category_id = ANY(v_unique_categories)) THEN
        v_unique_categories := array_append(v_unique_categories, v_category_id);
      END IF;

      -- Add subcategory object
      v_subcategories := v_subcategories || jsonb_build_object(
        'category_id', v_category_id,
        'subcategory_id', v_subcategory_id
      );
    END LOOP;

    -- Convert to JSONB
    v_categories := to_jsonb(v_unique_categories);

    -- Update plan
    UPDATE expense_plans
    SET 
      categories = v_categories,
      subcategories = v_subcategories
    WHERE id = v_plan.id;
  END LOOP;
END;
$$;

