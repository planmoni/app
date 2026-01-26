# Wallets API

Manage restricted wallets for controlled money access.

## List Wallets

```http
GET /api/v1/wallets
```

**Query Parameters:**
- `external_user_id` (optional): Filter by partner's external user ID

**Response:**
```json
{
  "wallets": [
    {
      "id": "uuid",
      "user_id": "uuid",
      "partner_id": "uuid",
      "balance": 100000,
      "available_balance": 80000,
      "locked_balance": 20000,
      "is_restricted": true,
      "requires_approval": false,
      "restrictions": [...]
    }
  ]
}
```

## Get Wallet

```http
GET /api/v1/wallets/{wallet_id}
```

**Response:**
```json
{
  "wallet": {
    "id": "uuid",
    "balance": 100000,
    "restrictions": [...],
    "policy": {...}
  }
}
```

## Create Wallet

```http
POST /api/v1/wallets
```

**Request Body:**
```json
{
  "external_user_id": "user_123",
  "user_id": "uuid",
  "policy_id": "uuid",
  "is_restricted": true,
  "requires_approval": false,
  "restrictions": [
    {
      "type": "max_balance",
      "value": { "amount": 500000 }
    },
    {
      "type": "daily_limit",
      "value": { "daily_amount": 100000 }
    }
  ]
}
```

## Get Wallet Balance

```http
GET /api/v1/wallets/{wallet_id}/balance
```

**Response:**
```json
{
  "balance": {
    "total": 100000,
    "available": 80000,
    "locked": 20000,
    "restricted": 0,
    "currency": "NGN"
  }
}
```

## Add Restriction

```http
POST /api/v1/wallets/{wallet_id}/restrictions
```

**Request Body:**
```json
{
  "restriction_type": "max_balance",
  "restriction_value": {
    "amount": 500000
  }
}
```

## Remove Restriction

```http
DELETE /api/v1/wallets/{wallet_id}/restrictions/{restriction_id}
```
