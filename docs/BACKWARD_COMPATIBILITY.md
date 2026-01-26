# Backward Compatibility Guide

This document explains how Planmoni maintains backward compatibility with existing B2C functionality while adding Platform-as-a-Service features.

## Design Principles

1. **Nullable Partner Context**: All `partner_id` columns are nullable, allowing B2C users to continue without partner associations.

2. **Default Permissive Policies**: B2C wallets without policies default to permissive behavior (all transactions allowed).

3. **Existing Endpoints Preserved**: All existing B2C API endpoints continue to work unchanged.

4. **Optional Features**: Partner features (policies, approvals, restrictions) are optional and don't affect B2C users.

## B2C vs B2B Behavior

### B2C Users (No Partner)

- Wallets have `partner_id = NULL`
- No policies applied (default: allow all)
- No approval workflows
- No restrictions (unless manually set)
- Direct access to all features

### B2B Partners

- Wallets have `partner_id` set
- Policies can be applied
- Approval workflows enforced
- Restrictions managed via API
- Complete audit trail

## Migration Path

Existing B2C users:
1. Continue using app normally
2. No migration required
3. Can optionally create personal organization later
4. All existing data preserved

New partners:
1. Register via partner API
2. Get API keys
3. Create wallets with `partner_id`
4. Configure policies and restrictions

## API Compatibility

### Existing B2C Endpoints

All existing endpoints remain functional:
- `/api/paystack-api-proxy` - Still works
- `/api/process-payouts` - Still works
- All existing hooks and components - Still work

### New Partner Endpoints

New endpoints are available under `/api/v1/`:
- `/api/v1/wallets` - Partner wallet management
- `/api/v1/disbursements` - Controlled disbursements
- `/api/v1/policies` - Policy management
- `/api/v1/approvals` - Approval workflows

## Database Compatibility

- All existing tables remain unchanged
- New columns are nullable
- Existing RLS policies still apply
- New policies are additive

## Testing Backward Compatibility

1. **Existing B2C App**: Should work exactly as before
2. **New Partner API**: Should work independently
3. **Mixed Usage**: Both can coexist

## Rollback Plan

If issues arise:
1. Partner features can be disabled via feature flags
2. B2C functionality is unaffected
3. Database migrations are reversible (soft deletes)
