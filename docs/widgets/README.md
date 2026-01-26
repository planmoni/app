# Planmoni Embedded Widgets

Embed Planmoni functionality directly into your application with our embeddable widgets.

## Available Widgets

### 1. Wallet Balance Widget

Display wallet balance in your application.

**Embed Code:**
```html
<iframe 
  src="https://api.planmoni.com/widgets/wallet-balance?wallet_id=WALLET_ID&api_key=API_KEY"
  width="300"
  height="150"
  frameborder="0"
></iframe>
```

**Parameters:**
- `wallet_id` (required) - Wallet ID
- `api_key` (required) - Partner API key
- `theme` (optional) - 'light' or 'dark'
- `show_restrictions` (optional) - Show restriction info

### 2. Disbursement Request Widget

Allow users to request disbursements directly from your application.

**Embed Code:**
```html
<iframe 
  src="https://api.planmoni.com/widgets/disbursement-request?wallet_id=WALLET_ID&api_key=API_KEY"
  width="400"
  height="500"
  frameborder="0"
></iframe>
```

**Parameters:**
- `wallet_id` (required) - Wallet ID
- `api_key` (required) - Partner API key
- `default_amount` (optional) - Pre-fill amount
- `show_purpose_field` (optional) - Show purpose field

## Widget Events

Widgets communicate with parent window via postMessage:

```javascript
window.addEventListener('message', (event) => {
  if (event.data.source === 'planmoni-widget') {
    switch (event.data.type) {
      case 'balance_updated':
        console.log('Balance updated:', event.data.data);
        break;
      case 'disbursement_requested':
        console.log('Disbursement requested:', event.data.data);
        break;
      case 'error':
        console.error('Widget error:', event.data.data);
        break;
    }
  }
});
```

## Security

- Widgets require valid API keys
- CORS is configured for embedding
- All API requests are authenticated
- Widgets are sandboxed in iframes

## Customization

Widgets can be customized via URL parameters and CSS (when using iframe).
