# Policies API

Manage wallet policies that control money access.

## List Policies

```http
GET /api/v1/policies
```

**Response:**
```json
{
  "policies": [
    {
      "id": "uuid",
      "name": "Standard Policy",
      "description": "Default policy for all wallets",
      "policy_rules": {
        "rules": [...]
      },
      "is_default": true,
      "is_active": true
    }
  ]
}
```

## Create Policy

```http
POST /api/v1/policies
```

**Request Body:**
```json
{
  "name": "Emergency Fund Policy",
  "description": "Policy for emergency funds",
  "policy_rules": {
    "rules": [
      {
        "id": "rule-1",
        "name": "Max Amount Rule",
        "condition": {
          "type": "amount",
          "operator": "lte",
          "value": 100000
        },
        "action": "allow",
        "priority": 1
      },
      {
        "id": "rule-2",
        "name": "Approval Required",
        "condition": {
          "type": "amount",
          "operator": "gt",
          "value": 50000
        },
        "action": "require_approval",
        "priority": 2
      }
    ]
  },
  "is_default": false
}
```

## Policy Rules

Policy rules consist of:
- **Condition**: When the rule applies
- **Action**: What to do (`allow`, `deny`, `require_approval`)
- **Priority**: Evaluation order (higher priority first)

### Condition Types

- `balance`: Check wallet balance
- `amount`: Check transaction amount
- `time`: Check time/day restrictions
- `frequency`: Check transaction frequency
- `purpose`: Check transaction purpose
- `combined`: Multiple conditions with AND/OR logic

### Operators

- `gt`, `gte`, `lt`, `lte`: Numeric comparisons
- `eq`, `neq`: Equality checks
- `in`, `not_in`: Array membership
- `between`: Range check
