/*
  Endpoint serverless para tentativa de captura automática de metadados de produto.

  Limitações importantes:
  - Alguns links/páginas usam anti-bot e podem bloquear a leitura do HTML.
  - Alguns dados só aparecem após execução de JavaScript no navegador (SSR ausente).
  - Em caso de falha parcial/total, o frontend permite preenchimento manual.
*/

function escapeRegex(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function parseMetaTag(html, key) {
  const safeKey = escapeRegex(key);
  const tags = html.match(/<meta\s+[^>]*>/gi) || [];

  for (const tag of tags) {
    const hasKey = new RegExp(`(?:property|name)=["']${safeKey}["']`, 'i').test(tag);
    if (!hasKey) continue;

    const contentMatch = tag.match(/content=["']([^"']+)["']/i);
    if (contentMatch?.[1]) return contentMatch[1].trim();
  }

  return null;
}

function parseTitle(html) {
  const og = parseMetaTag(html, 'og:title');
  if (og) return og;

  const match = html.match(/<title[^>]*>([^<]+)<\/title>/i);
  return match?.[1]?.trim() || null;
}

function parseImage(html, baseUrl) {
  const image =
    parseMetaTag(html, 'og:image') ||
    parseMetaTag(html, 'twitter:image') ||
    parseMetaTag(html, 'image');

  if (!image) return null;

  try {
    return new URL(image, baseUrl).toString();
  } catch {
    return image;
  }
}

function parsePrice(html) {
  const directMeta =
    parseMetaTag(html, 'product:price:amount') ||
    parseMetaTag(html, 'price') ||
    parseMetaTag(html, 'twitter:data1');

  if (directMeta) {
    const value = Number(String(directMeta).replace(/[^\d,.-]/g, '').replace(',', '.'));
    if (!Number.isNaN(value) && value > 0) return Number(value.toFixed(2));
  }

  // Fallback para JSON-LD com campo "price"
  const scripts = [...html.matchAll(/<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)];
  for (const script of scripts) {
    try {
      const content = script[1].trim();
      if (!content) continue;

      const json = JSON.parse(content);
      const candidates = Array.isArray(json) ? json : [json];

      for (const item of candidates) {
        const offerPrice = item?.offers?.price || item?.price;
        if (!offerPrice) continue;

        const value = Number(String(offerPrice).replace(/[^\d,.-]/g, '').replace(',', '.'));
        if (!Number.isNaN(value) && value > 0) return Number(value.toFixed(2));
      }
    } catch {
      // JSON-LD inválido é ignorado.
    }
  }

  // Último fallback: procurar padrão textual de preço em reais
  const textPrice = html.match(/R\$\s?([\d.]+,\d{2})/i);
  if (textPrice?.[1]) {
    const value = Number(textPrice[1].replace(/\./g, '').replace(',', '.'));
    if (!Number.isNaN(value) && value > 0) return Number(value.toFixed(2));
  }

  return null;
}

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ ok: false, error: 'Método não permitido.' });
  }

  const rawUrl = req.query?.url;
  if (!rawUrl || typeof rawUrl !== 'string') {
    return res.status(400).json({ ok: false, error: 'Parâmetro "url" é obrigatório.' });
  }

  let parsed;
  try {
    parsed = new URL(rawUrl);
  } catch {
    return res.status(400).json({ ok: false, error: 'URL inválida.' });
  }

  if (!['http:', 'https:'].includes(parsed.protocol)) {
    return res.status(400).json({ ok: false, error: 'Apenas URLs http/https são aceitas.' });
  }

  try {
    const response = await fetch(parsed.toString(), {
      headers: {
        'user-agent': 'Mozilla/5.0 (compatible; AffiliateCatalogBot/1.0; +https://vercel.com)',
        'accept-language': 'pt-BR,pt;q=0.9,en;q=0.8'
      },
      redirect: 'follow'
    });

    if (!response.ok) {
      return res.status(502).json({
        ok: false,
        error: `Falha ao acessar URL externa. Status: ${response.status}`
      });
    }

    const html = await response.text();
    const baseUrl = response.url || parsed.toString();

    const data = {
      title: parseTitle(html),
      image: parseImage(html, baseUrl),
      price: parsePrice(html),
      source_url: baseUrl
    };

    return res.status(200).json({
      ok: true,
      data,
      limitations: [
        'A extração depende de metadados públicos da página.',
        'Caso o site bloqueie bots ou renderize dados apenas via JavaScript, o preenchimento pode falhar.',
        'Quando a extração falhar, use o preenchimento manual no formulário.'
      ]
    });
  } catch (error) {
    return res.status(500).json({
      ok: false,
      error: `Erro interno ao processar URL: ${error.message}`
    });
  }
};
