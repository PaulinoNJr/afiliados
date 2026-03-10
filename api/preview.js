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
    const hasKey = new RegExp(`(?:property|name|itemprop)=["']${safeKey}["']`, 'i').test(tag);
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

function parseMoneyValue(raw) {
  if (raw === null || raw === undefined) return null;
  const str = String(raw).replace(/[^\d,.-]/g, '').trim();
  if (!str) return null;

  const hasComma = str.includes(',');
  const hasDot = str.includes('.');

  // Quando há vírgula e ponto, assumimos ponto como milhar e vírgula como decimal.
  if (hasComma && hasDot) {
    const normalized = str.replace(/\./g, '').replace(',', '.');
    const value = Number(normalized);
    return Number.isFinite(value) && value > 0 ? Number(value.toFixed(2)) : null;
  }

  // Apenas vírgula -> decimal pt-BR.
  if (hasComma) {
    const value = Number(str.replace(',', '.'));
    return Number.isFinite(value) && value > 0 ? Number(value.toFixed(2)) : null;
  }

  // Apenas ponto: se termina com .dd, tratamos como decimal; caso contrário, milhar.
  if (hasDot) {
    const normalized = /\.\d{1,2}$/.test(str) ? str : str.replace(/\./g, '');
    const value = Number(normalized);
    return Number.isFinite(value) && value > 0 ? Number(value.toFixed(2)) : null;
  }

  const value = Number(str);
  return Number.isFinite(value) && value > 0 ? Number(value.toFixed(2)) : null;
}

function collectJsonLdItems(root, output = []) {
  if (!root || typeof root !== 'object') return output;

  if (Array.isArray(root)) {
    for (const item of root) collectJsonLdItems(item, output);
    return output;
  }

  output.push(root);
  if (Array.isArray(root['@graph'])) {
    for (const item of root['@graph']) collectJsonLdItems(item, output);
  }

  return output;
}

function parsePriceFromTitle(html) {
  const candidates = [
    { source: 'meta:og:title', text: parseMetaTag(html, 'og:title') },
    { source: 'meta:twitter:title', text: parseMetaTag(html, 'twitter:title') },
    { source: 'tag:title', text: html.match(/<title[^>]*>([^<]+)<\/title>/i)?.[1] || null }
  ];

  for (const candidate of candidates) {
    if (!candidate.text) continue;

    const match = String(candidate.text).match(/R\$\s*([\d.]+(?:,\d{1,2})?)/i);
    if (!match?.[1]) continue;

    const value = parseMoneyValue(match[1]);
    if (value !== null) {
      return {
        value,
        source: `title:${candidate.source}`
      };
    }
  }

  return null;
}

function parsePriceFromText(html) {
  const matches = [...html.matchAll(/R\$\s*([\d.]+,\d{2})/gi)];
  if (!matches.length) return null;

  const candidates = [];
  for (const match of matches) {
    const value = parseMoneyValue(match[1]);
    if (value === null) continue;

    const index = match.index || 0;
    const context = html.slice(Math.max(0, index - 80), Math.min(html.length, index + 120)).toLowerCase();
    let score = 0;

    // Penaliza textos de frete/parcela que normalmente não representam o preço principal do produto.
    if (/frete|shipping|entrega|parcelas?|x sem juros|juros|cupom/.test(context)) score -= 3;
    if (/price|pre[cç]o|amount|offer|valor/.test(context)) score += 2;
    if (/og:title|itemprop=["']price["']|application\/ld\+json/.test(context)) score += 3;

    candidates.push({ value, score });
  }

  candidates.sort((a, b) => (b.score - a.score) || (b.value - a.value));
  if (!candidates[0]) return null;

  return {
    value: candidates[0].value,
    source: 'text-fallback'
  };
}

function parsePrice(html) {
  const metaKeys = [
    'product:price:amount',
    'og:price:amount',
    'price:amount',
    'price',
    'twitter:data1'
  ];

  for (const key of metaKeys) {
    const raw = parseMetaTag(html, key);
    if (!raw) continue;

    const value = parseMoneyValue(raw);
    if (value !== null) {
      return {
        value,
        source: `meta:${key}`
      };
    }
  }

  const titlePrice = parsePriceFromTitle(html);
  if (titlePrice !== null) {
    return titlePrice;
  }

  // Fallback para JSON-LD com campo "price"
  const scripts = [...html.matchAll(/<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)];
  for (const script of scripts) {
    try {
      const content = script[1].trim();
      if (!content) continue;

      const json = JSON.parse(content);
      const items = collectJsonLdItems(json);

      for (const item of items) {
        const offers = Array.isArray(item?.offers) ? item.offers : [item?.offers].filter(Boolean);
        for (const offer of offers) {
          const offerPrice = offer?.price;
          if (!offerPrice) continue;

          const value = parseMoneyValue(offerPrice);
          if (value !== null) {
            return {
              value,
              source: 'jsonld:offers.price'
            };
          }
        }

        if (!offers.length && item?.price) {
          const value = parseMoneyValue(item.price);
          if (value !== null) {
            return {
              value,
              source: 'jsonld:price'
            };
          }
        }
      }
    } catch {
      // JSON-LD inválido é ignorado.
    }
  }

  // Último fallback: procurar padrão textual de preço em reais
  return parsePriceFromText(html);
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
    console.info('[preview] request started', {
      url: parsed.toString()
    });

    const response = await fetch(parsed.toString(), {
      headers: {
        'user-agent': 'Mozilla/5.0 (compatible; AffiliateCatalogBot/1.0; +https://vercel.com)',
        'accept-language': 'pt-BR,pt;q=0.9,en;q=0.8'
      },
      redirect: 'follow'
    });

    if (!response.ok) {
      console.warn('[preview] upstream request failed', {
        url: parsed.toString(),
        status: response.status
      });
      return res.status(502).json({
        ok: false,
        error: `Falha ao acessar URL externa. Status: ${response.status}`
      });
    }

    const html = await response.text();
    const baseUrl = response.url || parsed.toString();
    const priceResult = parsePrice(html);

    const data = {
      title: parseTitle(html),
      image: parseImage(html, baseUrl),
      price: priceResult?.value ?? null,
      price_source: priceResult?.source || null,
      source_url: baseUrl
    };

    console.info('[preview] extraction result', {
      source_url: baseUrl,
      title_found: Boolean(data.title),
      image_found: Boolean(data.image),
      price: data.price,
      price_source: data.price_source
    });

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
    console.error('[preview] internal error', {
      url: parsed.toString(),
      message: error.message
    });
    return res.status(500).json({
      ok: false,
      error: `Erro interno ao processar URL: ${error.message}`
    });
  }
};
