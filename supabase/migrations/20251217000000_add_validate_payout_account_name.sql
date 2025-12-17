/*
  Enforce payout account name matching user profile full_name:
  - Function validate_payout_account_name(p_user_id, p_account_name) returns void, raises exception on failure.
  - BEFORE INSERT trigger on payout_accounts to enforce rule.
  Requirements:
  - profiles table with full_name column keyed by id = user_id.
*/

-- Function
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

  select full_name
    into v_full_name
    from profiles
   where id = p_user_id;

  if v_full_name is null or length(trim(v_full_name)) = 0 then
    raise exception 'The payout account does not match your name, please contact support';
  end if;

  -- Tokenize to lower-case words
  v_profile_tokens := regexp_split_to_array(lower(v_full_name), '\s+');
  v_account_tokens := regexp_split_to_array(lower(p_account_name), '\s+');

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

-- Trigger function to enforce before insert
create or replace function enforce_payout_account_name_match()
returns trigger
language plpgsql
as $$
begin
  perform validate_payout_account_name(NEW.user_id, NEW.account_name);
  return NEW;
end;
$$;

-- Attach trigger
drop trigger if exists trg_enforce_payout_account_name on payout_accounts;
create trigger trg_enforce_payout_account_name
before insert on payout_accounts
for each row
execute function enforce_payout_account_name_match();

