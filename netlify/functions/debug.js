// GET /api/debug
// 调试端点：返回最近一次 POST 的 body 字节流，诊断中文乱码

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Content-Type': 'application/json'
};

let lastPost = null;

exports.handler = async (event) => {
  if (event.httpMethod === 'POST') {
    lastPost = {
      ts: new Date().toISOString(),
      isBase64Encoded: event.isBase64Encoded,
      bodyLength: (event.body || '').length,
      bodyPreview: (event.body || '').slice(0, 200),
      bodyBytes: Array.from(Buffer.from(event.body || '', 'utf8'))
                     .slice(0, 50)
                     .map(b => b.toString(16).padStart(2, '0'))
                     .join(' ')
    };
    return {
      statusCode: 200,
      headers: corsHeaders,
      body: JSON.stringify({ ok: true, received: true })
    };
  }
  return {
    statusCode: 200,
    headers: corsHeaders,
    body: JSON.stringify({ lastPost }, null, 2)
  };
};