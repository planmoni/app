# Approvals API

Manage approval workflows and process approval requests.

## List Approval Requests

```http
GET /api/v1/approvals?status=pending&wallet_id=uuid
```

**Query Parameters:**
- `status` (optional): Filter by status (`pending`, `approved`, `rejected`)
- `wallet_id` (optional): Filter by wallet

**Response:**
```json
{
  "requests": [
    {
      "id": "uuid",
      "workflow_id": "uuid",
      "wallet_id": "uuid",
      "request_type": "disbursement",
      "amount": 75000,
      "status": "pending",
      "current_step": 0,
      "total_steps": 2
    }
  ]
}
```

## Create Approval Request

```http
POST /api/v1/approvals
```

**Request Body:**
```json
{
  "workflow_id": "uuid",
  "wallet_id": "uuid",
  "request_type": "disbursement",
  "amount": 75000,
  "purpose": "Emergency payment",
  "metadata": {}
}
```

## Approve Request

```http
POST /api/v1/approvals/{request_id}/approve
```

**Request Body:**
```json
{
  "comments": "Approved for emergency use"
}
```

## Reject Request

```http
POST /api/v1/approvals/{request_id}/reject
```

**Request Body:**
```json
{
  "comments": "Amount exceeds limit"
}
```

## Approval Workflows

### Create Workflow

```http
POST /api/v1/approval-workflows
```

**Request Body:**
```json
{
  "name": "Multi-Level Approval",
  "description": "Requires manager and finance approval",
  "workflow_type": "disbursement",
  "steps": [
    {
      "step_number": 0,
      "approvers": ["user_id_1", "user_id_2"],
      "required_approvals": 1,
      "auto_approve_after": 24
    },
    {
      "step_number": 1,
      "approvers": ["user_id_3"],
      "required_approvals": 1
    }
  ],
  "auto_approve_rules": {
    "amount_threshold": 10000
  }
}
```

### Workflow Steps

Each step defines:
- `approvers`: Array of user IDs who can approve
- `required_approvals`: How many approvals needed (default: all)
- `auto_approve_after`: Hours until auto-approval (optional)
