/*
  Fix validate_payout_account_name to avoid referencing missing full_name column:
  - Use concat_ws on coalesce(full_name, first_name, last_name) but only select existing columns.
  - If full_name column truly absent, fallback to first_name + last_name without selecting full_name.
*/

create or replace function validate_payout_account_name(
  p_user_id uuid,
  p_account_name text
)
returns void
language plpgsql
as $$
declare
  v_full_name text;
  v_profile_tokens text[];
  v_account_tokens text[];
  v_matches int := 0;
begin
  if p_user_id is null then
    raise exception 'User not provided for payout account validation';
  end if;

  if p_account_name is null or length(trim(p_account_name)) = 0 then
    raise exception 'The payout account does not match your name, please contact support';
  end if;

  -- Attempt to select full_name; if it doesn't exist, fallback silently in the subselect
  -- We handle missing columns by using separate selects and COALESCE on existing fields.
  begin
    select coalesce(nullif(full_name, ''), concat_ws(' ', nullif(first_name, ''), nullif(last_name, '')))
      into v_full_name
      from profiles
     where id = p_user_id;
  exception
    when undefined_column then
      -- If full_name column does not exist, fallback to first_name + last_name
      select concat_ws(' ', nullif(first_name, ''), nullif(last_name, ''))
        into v_full_name
        from profiles
       where id = p_user_id;
  end;

  if v_full_name is null or length(trim(v_full_name)) = 0 then
    raise exception 'The payout account does not match your name, please contact support';
  end if;

  -- Tokenize to lower-case words and strip non-alphanumerics
  v_profile_tokens := array_remove(
    regexp_split_to_array(regexp_replace(lower(v_full_name), '[^a-z0-9\s]', '', 'g'), '\s+'),
    ''
  );
  v_account_tokens := array_remove(
    regexp_split_to_array(regexp_replace(lower(p_account_name), '[^a-z0-9\s]', '', 'g'), '\s+'),
    ''
  );

  if v_profile_tokens is null or v_account_tokens is null then
    raise exception 'The payout account does not match your name, please contact support';
  end if;

  -- Count matching tokens; require at least 2
  select count(*)
    into v_matches
    from unnest(v_account_tokens) atok
    where atok <> ''
      and atok = any(v_profile_tokens);

  if v_matches < 2 then
    raise exception 'The payout account does not match your name, please contact support';
  end if;
end;
$$;

-- Recreate trigger to ensure latest function is used
drop trigger if exists trg_enforce_payout_account_name on payout_accounts;
create trigger trg_enforce_payout_account_name
before insert on payout_accounts
for each row
execute function enforce_payout_account_name_match();

