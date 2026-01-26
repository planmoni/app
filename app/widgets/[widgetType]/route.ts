/**
 * Widget Hosting Route
 * 
 * Serves widget HTML/JS for embedding in partner applications.
 * Handles CORS and partner authentication.
 */

import { readFile } from 'fs/promises';
import { join } from 'path';

export async function GET(
  request: NextRequest,
  { params }: { params: { widgetType: string } }
) {
  try {
    const widgetType = params.widgetType;
    const validTypes = ['wallet-balance', 'disbursement-request'];

    if (!validTypes.includes(widgetType)) {
      return new NextResponse('Widget type not found', { status: 404 });
    }

    // Get widget HTML file
    const widgetPath = join(process.cwd(), 'widgets', widgetType, 'index.html');
    
    try {
      const widgetHtml = await readFile(widgetPath, 'utf-8');

      // Add CORS headers for embedding
      return new NextResponse(widgetHtml, {
        status: 200,
        headers: {
          'Content-Type': 'text/html',
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type',
          'X-Frame-Options': 'ALLOWALL', // Allow embedding
        },
      });
    } catch (fileError) {
      // If file doesn't exist, return a basic widget HTML
      return new NextResponse(
        generateBasicWidget(widgetType),
        {
          status: 200,
          headers: {
            'Content-Type': 'text/html',
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'GET, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type',
            'X-Frame-Options': 'ALLOWALL',
          },
        }
      );
    }
  } catch (error) {
    console.error('Widget serving error:', error);
    return new NextResponse('Internal server error', { status: 500 });
  }
}

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  });
}

function generateBasicWidget(widgetType: string): string {
  if (widgetType === 'wallet-balance') {
    return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Planmoni Wallet Balance</title>
</head>
<body>
  <div id="planmoni-widget">Loading...</div>
  <script>
    // Widget will be loaded here
    console.log('Planmoni Wallet Balance Widget');
  </script>
</body>
</html>
    `;
  }

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Planmoni Widget</title>
</head>
<body>
  <div id="planmoni-widget">Widget not found</div>
</body>
</html>
  `;
}
