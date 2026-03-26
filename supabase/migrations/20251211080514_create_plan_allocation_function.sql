/*
  # Plan Allocation Function
  
  Creates a function to process plan allocations when income is received
*/

-- Function to allocate income to plans
CREATE OR REPLACE FUNCTION allocate_to_plans(
  p_user_id uuid,
  p_income_amount numeric,
  p_mandatory_expenses numeric DEFAULT 0,
  p_payout_cycle_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_plan expense_plans%ROWTYPE;
  v_wallet plan_wallets%ROWTYPE;
  v_available numeric;
  v_allocated numeric;
  v_needed numeric;
  v_amount_to_allocate numeric;
  v_allocations jsonb := '[]'::jsonb;
  v_allocation_id uuid;
  v_transaction_id uuid;
  v_total_required numeric := 0;
  v_insufficient boolean := false;
  v_result jsonb;
BEGIN
  -- Calculate available after mandatory expenses
  v_available := p_income_amount - p_mandatory_expenses;
  
  IF v_available < 0 THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Insufficient income for mandatory expenses',
      'income_received', p_income_amount,
      'mandatory_expenses', p_mandatory_expenses,
      'available', v_available,
      'shortfall', ABS(v_available)
    );
  END IF;

  -- Get all active plans that need funding (auto or hybrid, not paused, not completed)
  FOR v_plan IN
    SELECT * FROM expense_plans
    WHERE user_id = p_user_id
      AND status = 'active'
      AND is_paused = false
      AND funding_method IN ('auto', 'hybrid')
      AND current_balance < total_budget
    ORDER BY 
      CASE priority
        WHEN 'high' THEN 1
        WHEN 'medium' THEN 2
        WHEN 'low' THEN 3
      END,
      created_at ASC
  LOOP
    -- Get plan wallet
    SELECT * INTO v_wallet
    FROM plan_wallets
    WHERE plan_id = v_plan.id;
    
    IF NOT FOUND THEN
      CONTINUE; -- Skip if wallet doesn't exist
    END IF;

    -- Calculate how much is needed
    v_needed := v_plan.total_budget - v_plan.current_balance;
    
    IF v_needed <= 0 THEN
      CONTINUE; -- Plan is already fully funded
    END IF;

    -- Calculate amount to allocate
    IF v_plan.funding_method = 'auto' THEN
      -- Allocate required per cycle (or remaining needed, whichever is less)
      v_amount_to_allocate := LEAST(v_plan.required_per_cycle, v_needed, v_available);
    ELSIF v_plan.funding_method = 'hybrid' THEN
      -- Allocate minimum auto-fund amount
      v_amount_to_allocate := LEAST(COALESCE(v_plan.auto_fund_minimum, 0), v_needed, v_available);
    ELSE
      CONTINUE; -- Manual plans are skipped
    END IF;

    -- Add to total required for summary
    v_total_required := v_total_required + LEAST(
      COALESCE(v_plan.required_per_cycle, 0),
      v_needed
    );

    -- Allocate if we have available funds
    IF v_amount_to_allocate > 0 AND v_available >= v_amount_to_allocate THEN
      -- Create allocation record
      INSERT INTO plan_allocations (
        plan_id,
        allocation_date,
        amount,
        payout_cycle_id,
        status
      ) VALUES (
        v_plan.id,
        CURRENT_DATE,
        v_amount_to_allocate,
        p_payout_cycle_id,
        'completed'
      ) RETURNING id INTO v_allocation_id;

      -- Update plan wallet balance
      UPDATE plan_wallets
      SET balance = balance + v_amount_to_allocate,
          updated_at = now()
      WHERE id = v_wallet.id;

      -- Update plan current_balance
      UPDATE expense_plans
      SET current_balance = current_balance + v_amount_to_allocate,
          updated_at = now()
      WHERE id = v_plan.id;

      -- Create transaction record
      INSERT INTO plan_transactions (
        plan_id,
        wallet_id,
        type,
        amount,
        description
      ) VALUES (
        v_plan.id,
        v_wallet.id,
        'auto_allocation',
        v_amount_to_allocate,
        'Automatic allocation from income'
      ) RETURNING id INTO v_transaction_id;

      -- Add to allocations array
      v_allocations := v_allocations || jsonb_build_object(
        'plan_id', v_plan.id,
        'allocated_amount', v_amount_to_allocate,
        'status', CASE 
          WHEN v_amount_to_allocate >= v_plan.required_per_cycle THEN 'full'
          ELSE 'partial'
        END
      );

      -- Deduct from available
      v_available := v_available - v_amount_to_allocate;
    END IF;
  END LOOP;

  -- Check if income was insufficient
  v_insufficient := v_total_required > (p_income_amount - p_mandatory_expenses);

  -- Build result
  v_result := jsonb_build_object(
    'success', true,
    'income_received', p_income_amount,
    'mandatory_expenses', p_mandatory_expenses,
    'plans_funded', v_allocations,
    'free_to_spend', v_available,
    'insufficient_income', v_insufficient
  );

  IF v_insufficient THEN
    v_result := v_result || jsonb_build_object(
      'required_adjustment', jsonb_build_object(
        'total_required', v_total_required,
        'available', p_income_amount - p_mandatory_expenses,
        'shortfall', v_total_required - (p_income_amount - p_mandatory_expenses)
      )
    );
  END IF;

  RETURN v_result;
END;
$$;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION allocate_to_plans TO authenticated;
