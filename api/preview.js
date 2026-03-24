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

const MERCADO_LIVRE_ITEM_ID_REGEX = /MLB[A-Z]{0,3}\d{7,}/i;

function extractMercadoLivreItemId(value) {
  const match = String(value || '').match(MERCADO_LIVRE_ITEM_ID_REGEX);
  return match?.[0]?.toUpperCase() || null;
}

function hasMercadoLivreProductPath(pathname) {
  const path = String(pathname || '');
  return (
    /\/up\/MLB[A-Z]{0,3}\d{7,}/i.test(path) ||
    /\/p\/MLB[A-Z]{0,3}\d{7,}/i.test(path)
  );
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

function sanitizeMercadoLivreTitle(value) {
  const text = normalizeText(value, 220);
  if (!text) return null;

  let cleaned = text
    .replace(/\s*\|\s*Mercado\s*Livre\s*$/i, '')
    .replace(/\s*-\s*R\$\s*[\d.]+(?:,\d{1,2})?(?:\s*.*)?$/i, '')
    .trim();

  if (!cleaned) cleaned = text;
  return cleaned;
}

function parseTitle(html) {
  const candidates = [];

  const ogTitle = sanitizeMercadoLivreTitle(parseMetaTag(html, 'og:title'));
  if (ogTitle) {
    candidates.push({ value: ogTitle, score: 120 });
  }

  const twitterTitle = sanitizeMercadoLivreTitle(parseMetaTag(html, 'twitter:title'));
  if (twitterTitle) {
    candidates.push({ value: twitterTitle, score: 100 });
  }

  const pageTitle = sanitizeMercadoLivreTitle(html.match(/<title[^>]*>([^<]+)<\/title>/i)?.[1] || null);
  if (pageTitle) {
    candidates.push({ value: pageTitle, score: 90 });
  }

  const scripts = [...html.matchAll(/<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)];
  for (const script of scripts) {
    try {
      const content = script[1].trim();
      if (!content) continue;

      const json = JSON.parse(content);
      const items = collectJsonLdItems(json);

      for (const item of items) {
        const name = sanitizeMercadoLivreTitle(item?.name);
        if (!name) continue;

        const type = String(item?.['@type'] || '').toLowerCase();
        candidates.push({
          value: name,
          score: type.includes('product') ? 140 : 80
        });
      }
    } catch {
      // JSON-LD inválido é ignorado.
    }
  }

  if (!candidates.length) return null;
  candidates.sort((a, b) => (b.score - a.score) || (b.value.length - a.value.length));
  return candidates[0].value;
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

function decodeHtmlEntities(value) {
  if (!value) return '';

  const named = value
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&nbsp;/gi, ' ');

  // Suporte básico para entidades numéricas (decimal e hexadecimal).
  return named
    .replace(/&#(\d+);/g, (_, dec) => String.fromCharCode(Number(dec)))
    .replace(/&#x([a-f\d]+);/gi, (_, hex) => String.fromCharCode(parseInt(hex, 16)));
}

function safeDecodeURIComponent(value) {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

function normalizeText(raw, maxLength = 500) {
  if (raw === null || raw === undefined) return null;

  const plain = decodeHtmlEntities(String(raw))
    .replace(/<[^>]*>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  if (!plain) return null;
  if (plain.length <= maxLength) return plain;
  return `${plain.slice(0, maxLength - 3).trim()}...`;
}

function normalizeMultilineText(raw, maxLength = 6000) {
  if (raw === null || raw === undefined) return null;

  const withBreaks = decodeHtmlEntities(String(raw))
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(p|div|li|h1|h2|h3|h4|h5|h6|section|article)>/gi, '\n')
    .replace(/<[^>]*>/g, '')
    .replace(/\r\n?/g, '\n');

  const normalized = withBreaks
    .split('\n')
    .map((line) => line.replace(/[ \t]+/g, ' ').trim())
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();

  if (!normalized) return null;
  if (normalized.length <= maxLength) return normalized;
  return `${normalized.slice(0, maxLength - 3).trim()}...`;
}

function getOpenClawConfig() {
  const baseUrl = String(process.env.OPENCLAW_BASE_URL || '').trim().replace(/\/+$/, '');
  const token = String(process.env.OPENCLAW_GATEWAY_TOKEN || '').trim();
  const password = String(process.env.OPENCLAW_GATEWAY_PASSWORD || '').trim();

  if (!baseUrl) {
    return {
      enabled: false,
      reason: 'OPENCLAW_BASE_URL ausente'
    };
  }

  if (!token && !password) {
    return {
      enabled: false,
      reason: 'OPENCLAW_GATEWAY_TOKEN/OPENCLAW_GATEWAY_PASSWORD ausente'
    };
  }

  const agentId = String(process.env.OPENCLAW_AGENT_ID || 'main').trim() || 'main';
  const model = String(process.env.OPENCLAW_MODEL || `openclaw:${agentId}`).trim() || `openclaw:${agentId}`;
  const timeoutMs = Math.max(3000, Number(process.env.OPENCLAW_TIMEOUT_MS || 30000) || 30000);

  return {
    enabled: true,
    baseUrl,
    agentId,
    model,
    timeoutMs,
    authHeader: `Bearer ${token || password}`
  };
}

function extractAssistantTextFromChatCompletion(payload) {
  const content = payload?.choices?.[0]?.message?.content;

  if (typeof content === 'string') {
    return content.trim();
  }

  if (Array.isArray(content)) {
    return content
      .map((part) => {
        if (typeof part === 'string') return part;
        if (typeof part?.text === 'string') return part.text;
        return '';
      })
      .join('\n')
      .trim();
  }

  return null;
}

function extractJsonObjectFromText(value) {
  const text = String(value || '').trim();
  if (!text) return null;

  const directCandidates = [
    text,
    text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim()
  ];

  for (const candidate of directCandidates) {
    if (!candidate) continue;

    try {
      return JSON.parse(candidate);
    } catch {
      // Continua para heurística abaixo.
    }
  }

  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start === -1 || end === -1 || end <= start) return null;

  try {
    return JSON.parse(text.slice(start, end + 1));
  } catch {
    return null;
  }
}

function normalizeOpenClawProductPayload(raw, originalUrl) {
  if (!raw || typeof raw !== 'object') return null;

  const title = normalizeText(raw.title || raw.name || null, 220);
  const image = normalizeText(raw.image || raw.image_url || raw.thumbnail || null, 2000);
  const description = normalizeMultilineText(raw.description || raw.descricao || null, 6000);
  const price = typeof raw.price === 'number'
    ? Number.isFinite(raw.price) && raw.price > 0 ? Number(raw.price.toFixed(2)) : null
    : parseMoneyValue(raw.price);

  const sourceUrl = normalizeText(raw.source_url || raw.sourceUrl || originalUrl || null, 2000);
  const resolvedProductUrl = normalizeText(
    raw.resolved_product_url || raw.resolvedUrl || raw.product_url || raw.productUrl || null,
    2000
  );

  const hasSignal = Boolean(title || image || description || price !== null);
  if (!hasSignal) return null;

  return {
    title,
    image,
    price,
    description,
    source_url: sourceUrl,
    resolved_product_url: resolvedProductUrl
  };
}

function hasPreviewSignal(data) {
  return Boolean(
    data &&
    (
      data.title ||
      data.image ||
      data.description ||
      (typeof data.price === 'number' && Number.isFinite(data.price) && data.price > 0)
    )
  );
}

function isCompletePreviewData(data) {
  return Boolean(
    data &&
    data.title &&
    data.image &&
    data.description &&
    typeof data.price === 'number' &&
    Number.isFinite(data.price) &&
    data.price > 0
  );
}

function mergePreviewData(primary, secondary) {
  if (!hasPreviewSignal(primary)) return secondary;
  if (!hasPreviewSignal(secondary)) return primary;

  const primaryHasPrice = typeof primary.price === 'number' && Number.isFinite(primary.price) && primary.price > 0;
  const secondaryHasPrice = typeof secondary.price === 'number' && Number.isFinite(secondary.price) && secondary.price > 0;
  const primaryPictures = Array.isArray(primary.ml_pictures) ? primary.ml_pictures.filter(Boolean) : [];
  const secondaryPictures = Array.isArray(secondary.ml_pictures) ? secondary.ml_pictures.filter(Boolean) : [];

  return {
    title: primary.title || secondary.title || null,
    image: primary.image || secondary.image || null,
    price: primaryHasPrice ? primary.price : (secondaryHasPrice ? secondary.price : null),
    price_source: primaryHasPrice ? (primary.price_source || null) : (secondary.price_source || null),
    price_confidence: primaryHasPrice
      ? (primary.price_confidence ?? secondary.price_confidence ?? null)
      : (secondary.price_confidence ?? null),
    description: primary.description || secondary.description || null,
    description_source: primary.description
      ? (primary.description_source || null)
      : (secondary.description_source || null),
    source_url: primary.source_url || secondary.source_url || null,
    resolved_product_url: primary.resolved_product_url || secondary.resolved_product_url || null,
    ml_item_id: primary.ml_item_id || secondary.ml_item_id || null,
    ml_currency: primary.ml_currency || secondary.ml_currency || null,
    ml_permalink: primary.ml_permalink || secondary.ml_permalink || null,
    ml_thumbnail: primary.ml_thumbnail || secondary.ml_thumbnail || null,
    ml_pictures: primaryPictures.length ? primaryPictures : secondaryPictures
  };
}

function getCaptureSourceLabel(source) {
  const normalized = String(source || '').trim().toLowerCase();
  if (!normalized) return null;
  if (normalized === 'openclaw') return 'Open.Claw';
  if (normalized === 'mercadolivre_api') return 'Mercado Livre';
  if (normalized === 'html') return 'Mercado Livre';
  if (normalized === 'openclaw+mercadolivre_api') return 'Open.Claw + Mercado Livre';
  if (normalized === 'openclaw+html') return 'Open.Claw + Mercado Livre';
  return normalized;
}

function withCaptureSource(data, source) {
  return {
    ...data,
    capture_source: source || null,
    capture_source_label: getCaptureSourceLabel(source)
  };
}

function withCaptureDiagnostics(data, diagnostics) {
  return {
    ...data,
    capture_diagnostics: diagnostics || null
  };
}

function buildOpenClawPreviewData(product, originalUrl) {
  if (!product) return null;

  const sourceUrl = product.source_url || originalUrl || null;
  const resolvedProductUrl = product.resolved_product_url || null;
  const itemId = extractMercadoLivreItemIdFromUrl(resolvedProductUrl || sourceUrl || originalUrl || '');
  const image = product.image || null;

  return {
    title: product.title || null,
    image,
    price: product.price ?? null,
    price_source: product.price !== null ? 'openclaw:chat_completions' : null,
    price_confidence: product.price !== null ? 260 : null,
    description: product.description || null,
    description_source: product.description ? 'openclaw:chat_completions' : null,
    source_url: sourceUrl || originalUrl || null,
    resolved_product_url: resolvedProductUrl,
    ml_item_id: itemId,
    ml_currency: null,
    ml_permalink: resolvedProductUrl || null,
    ml_thumbnail: image,
    ml_pictures: image ? [image] : []
  };
}

async function getOpenClawProduct(link) {
  const config = getOpenClawConfig();
  if (!config?.enabled) {
    return {
      product: null,
      diagnostics: {
        attempted: false,
        available: false,
        status: 'not_configured',
        reason: config?.reason || 'Open.Claw desabilitada'
      }
    };
  }

  const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
  const timeout = controller
    ? setTimeout(() => controller.abort(new Error('Open.Claw timeout')), config.timeoutMs)
    : null;

  try {
    const response = await fetch(`${config.baseUrl}/v1/chat/completions`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'authorization': config.authHeader,
        'x-openclaw-agent-id': config.agentId
      },
      body: JSON.stringify({
        model: config.model,
        temperature: 0,
        user: 'affiliate-preview',
        messages: [
          {
            role: 'system',
            content: [
              'Você extrai dados de produto a partir de links de afiliado.',
              'Abra o link informado, siga redirecionamentos até a página do produto e responda somente com JSON válido.',
              'Campos obrigatórios do JSON: title, image, price, description, source_url, resolved_product_url.',
              'Use null quando um campo não puder ser obtido com confiança.',
              'Em price, retorne apenas número decimal sem símbolo de moeda.',
              'Em image, retorne uma URL absoluta da imagem principal.',
              'Não inclua markdown, comentários ou texto fora do JSON.'
            ].join(' ')
          },
          {
            role: 'user',
            content: `Extraia os dados do produto deste link de afiliado: ${link}`
          }
        ]
      }),
      signal: controller?.signal
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Open.Claw HTTP ${response.status}: ${normalizeText(errorText, 160) || 'sem detalhes'}`);
    }

    const payload = await response.json();
    const assistantText = extractAssistantTextFromChatCompletion(payload);
    const parsedPayload = extractJsonObjectFromText(assistantText);
    const product = normalizeOpenClawProductPayload(parsedPayload, link);

    if (!product) {
      throw new Error('Open.Claw não retornou um JSON de produto utilizável.');
    }

    return {
      product,
      diagnostics: {
        attempted: true,
        available: true,
        status: 'ok',
        reason: null
      }
    };
  } catch (error) {
    console.warn('[preview] openclaw lookup failed', {
      url: link,
      message: error.message
    });
    return {
      product: null,
      diagnostics: {
        attempted: true,
        available: true,
        status: 'error',
        reason: error.message
      }
    };
  } finally {
    if (timeout) clearTimeout(timeout);
  }
}

function parseMercadoLivreSocialFeaturedData(html) {
  if (!/rl-social-desktop|ui-ms-profile|poly-component__title/i.test(String(html || ''))) {
    return null;
  }

  const anchorMatch =
    html.match(/<a[^>]*class=["'][^"']*poly-component__title[^"']*["'][^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/i) ||
    html.match(/<a[^>]*href=["']([^"']+)["'][^>]*class=["'][^"']*poly-component__title[^"']*["'][^>]*>([\s\S]*?)<\/a>/i);

  if (!anchorMatch) return null;

  const href = decodeHtmlEntities(anchorMatch[1] || '').trim();
  const title = normalizeText(anchorMatch[2], 220);
  const anchorIndex = anchorMatch.index || 0;
  const cardWindow = html.slice(anchorIndex, Math.min(html.length, anchorIndex + 12000));

  let price = null;
  const currentPriceBlock = cardWindow.match(/<div[^>]*class=["'][^"']*poly-price__current[^"']*["'][^>]*>([\s\S]*?)<\/div>/i)?.[1] || '';
  if (currentPriceBlock) {
    const fraction = currentPriceBlock.match(/andes-money-amount__fraction[^>]*>([\d.]+)</i)?.[1] || null;
    const cents = currentPriceBlock.match(/andes-money-amount__cents[^>]*>(\d{1,2})</i)?.[1] || null;
    const composed = fraction ? `${fraction}${cents ? `,${String(cents).padStart(2, '0')}` : ''}` : null;
    price = parseMoneyValue(composed);
  }

  if (price === null) {
    const nowLabelMatch = cardWindow.match(/aria-label=["'][^"']*(?:ahora|agora):\s*([\d.]+)(?:\s*(?:reales|real|reais|real))?(?:\s*con\s*(\d{1,2})\s*(?:centavos|centavo))?/i);
    if (nowLabelMatch?.[1]) {
      const raw = `${nowLabelMatch[1]}${nowLabelMatch[2] ? `,${String(nowLabelMatch[2]).padStart(2, '0')}` : ''}`;
      price = parseMoneyValue(raw);
    }
  }

  const sellerRaw = cardWindow.match(/<span[^>]*class=["'][^"']*poly-component__seller[^"']*["'][^>]*>([\s\S]*?)<\/span>/i)?.[1] || null;
  const sellerText = normalizeText(sellerRaw, 140);
  const seller = sellerText
    ? sellerText.replace(/^por\s+/i, '').replace(/\s*loja oficial\s*$/i, '').trim()
    : null;

  const shippingRaw = cardWindow.match(/<div[^>]*class=["'][^"']*poly-component__shipping[^"']*["'][^>]*>([\s\S]*?)<\/div>/i)?.[1] || null;
  const shipping = normalizeText(shippingRaw, 220);

  const descriptionParts = [];
  if (seller) descriptionParts.push(`Vendido por ${seller}.`);
  if (shipping) {
    const normalizedShipping = shipping.endsWith('.') ? shipping : `${shipping}.`;
    descriptionParts.push(normalizedShipping);
  }

  return {
    title,
    href: href || null,
    price,
    description: descriptionParts.length ? descriptionParts.join(' ') : null
  };
}

function parseMercadoLivrePdpDescription(html) {
  const match =
    html.match(/<p[^>]*class=["'][^"']*ui-pdp-description__content[^"']*["'][^>]*>([\s\S]*?)<\/p>/i) ||
    html.match(/<div[^>]*class=["'][^"']*ui-pdp-description__content[^"']*["'][^>]*>([\s\S]*?)<\/div>/i);

  if (!match?.[1]) return null;
  return normalizeMultilineText(match[1], 6000);
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

function parseDescription(html) {
  const candidates = [];

  const socialFeatured = parseMercadoLivreSocialFeaturedData(html);
  if (socialFeatured?.description) {
    candidates.push({
      value: socialFeatured.description,
      source: 'html:social.featured.summary',
      score: 88
    });
  }

  const pdpDescription = parseMercadoLivrePdpDescription(html);
  if (pdpDescription) {
    candidates.push({
      value: pdpDescription,
      source: 'html:pdp.description',
      score: 190
    });
  }

  const metaCandidates = [
    { source: 'meta:og:description', value: parseMetaTag(html, 'og:description'), score: 110 },
    { source: 'meta:description', value: parseMetaTag(html, 'description'), score: 100 },
    { source: 'meta:twitter:description', value: parseMetaTag(html, 'twitter:description'), score: 90 }
  ];

  for (const candidate of metaCandidates) {
    const text = normalizeText(candidate.value, 500);
    if (!text) continue;
    const normalized = text.toLowerCase();
    const isEcommerceGeneric =
      normalized.includes('compre online com segurança') ||
      normalized.includes('compra garantida') ||
      normalized.includes('entrega rápida') ||
      normalized.includes('devolução grátis');

    candidates.push({
      value: text,
      source: candidate.source,
      score: candidate.score - (isEcommerceGeneric ? 60 : 0)
    });
  }

  const scripts = [...html.matchAll(/<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)];
  for (const script of scripts) {
    try {
      const content = script[1].trim();
      if (!content) continue;

      const json = JSON.parse(content);
      const items = collectJsonLdItems(json);

      for (const item of items) {
        const text = normalizeText(item?.description, 500);
        if (!text) continue;

        const type = String(item?.['@type'] || '').toLowerCase();
        candidates.push({
          value: text,
          source: type.includes('product') ? 'jsonld:product.description' : 'jsonld:item.description',
          score: type.includes('product') ? 125 : 85
        });
      }
    } catch {
      // JSON-LD inválido é ignorado.
    }
  }

  if (!candidates.length) return null;

  candidates.sort((a, b) => (b.score - a.score) || (b.value.length - a.value.length));
  return {
    value: candidates[0].value,
    source: candidates[0].source
  };
}

function selectHtmlDescriptionCandidate(html, maxLength = 6000) {
  const parsed = parseDescription(html);
  if (!parsed?.value) return null;

  const description = normalizeMultilineText(parsed.value, maxLength);
  if (!description || isGenericAffiliateDescription(description)) return null;

  return {
    description,
    source: parsed.source
  };
}

function isMercadoLivreHost(hostname) {
  const host = String(hostname || '').toLowerCase();
  return host.includes('mercadolivre.com.br') || host.includes('mercadolibre.com');
}

function isMercadoLivreVerificationPath(pathname) {
  const path = String(pathname || '').toLowerCase();
  return path.includes('/gz/account-verification') || path.includes('/gz/webdevice/config');
}

function isMercadoLivreVerificationUrl(urlValue) {
  try {
    const parsed = typeof urlValue === 'string' ? new URL(urlValue) : urlValue;
    return isMercadoLivreHost(parsed.hostname) && isMercadoLivreVerificationPath(parsed.pathname);
  } catch {
    return false;
  }
}

function extractMercadoLivreVerificationTargetUrl(urlValue) {
  let parsed;
  try {
    parsed = typeof urlValue === 'string' ? new URL(urlValue) : urlValue;
  } catch {
    return null;
  }

  if (!isMercadoLivreHost(parsed.hostname) || !isMercadoLivreVerificationPath(parsed.pathname)) {
    return null;
  }

  const goParam = parsed.searchParams.get('go');
  if (!goParam) return null;

  const decoded = decodeHtmlEntities(safeDecodeURIComponent(goParam));
  if (!/^https?:\/\//i.test(decoded)) return null;

  try {
    const target = new URL(decoded);
    if (!isMercadoLivreHost(target.hostname)) return null;
    return target.toString();
  } catch {
    return null;
  }
}

function isLikelyProductPath(pathname) {
  return hasMercadoLivreProductPath(pathname) || MERCADO_LIVRE_ITEM_ID_REGEX.test(String(pathname || ''));
}

function normalizeSlug(value) {
  return decodeHtmlEntities(String(value || ''))
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s*-\s*r\$\s*[\d.,]+.*$/i, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function extractMercadoLivreItemIdFromUrl(urlValue) {
  let parsed;
  try {
    parsed = typeof urlValue === 'string' ? new URL(urlValue) : urlValue;
  } catch {
    return null;
  }

  const fromParams = [
    parsed.searchParams.get('wid'),
    parsed.searchParams.get('item_id'),
    parsed.searchParams.get('itemId'),
    parsed.searchParams.get('id')
  ].find((value) => MERCADO_LIVRE_ITEM_ID_REGEX.test(String(value || '')));

  if (fromParams) {
    const id = extractMercadoLivreItemId(fromParams);
    if (id) return id;
  }

  for (const [, value] of parsed.searchParams.entries()) {
    const directId = extractMercadoLivreItemId(value);
    if (directId) return directId;

    const embeddedItemId = String(value || '').match(/item_id[:=](MLB[A-Z]{0,3}\d{7,})/i)?.[1];
    if (embeddedItemId) {
      const id = extractMercadoLivreItemId(embeddedItemId);
      if (id) return id;
    }
  }

  const fromText = extractMercadoLivreItemIdsFromText(`${parsed.pathname}${parsed.search}`);
  if (fromText.length) {
    fromText.sort((a, b) => {
      const aDigits = a.replace(/\D/g, '').length;
      const bDigits = b.replace(/\D/g, '').length;
      return (bDigits - aDigits) || (b.length - a.length);
    });
    return fromText[0];
  }

  return null;
}

function extractMercadoLivreItemIdsFromText(value) {
  const matches = String(value || '').match(/MLB[A-Z]{0,3}\d{7,}/gi) || [];
  const unique = new Set();

  for (const match of matches) {
    const normalized = extractMercadoLivreItemId(match);
    if (normalized) unique.add(normalized);
  }

  return [...unique];
}

function scoreMercadoLivreItemIdCandidate({ id, source }) {
  const digits = String(id || '').replace(/\D/g, '').length;
  let score = digits * 2;

  if (source === 'query:wid' || source === 'query:item_id' || source === 'query:itemId') {
    score += 120;
  } else if (source === 'query:go') {
    score += 95;
  } else if (source.startsWith('social:featured')) {
    score += 85;
  } else if (source.startsWith('social:link')) {
    score += 80;
  } else if (source === 'url:path-search') {
    score += 55;
  } else {
    score += 30;
  }

  if (digits >= 10) score += 22;
  if (digits <= 8) score -= 16;

  return score;
}

function collectMercadoLivreItemIdCandidates({ finalUrl, html }) {
  const candidates = [];
  const seen = new Set();

  const pushCandidate = (id, source, url = null) => {
    const normalizedId = extractMercadoLivreItemId(id);
    if (!normalizedId) return;

    const key = `${normalizedId}|${source}`;
    if (seen.has(key)) return;
    seen.add(key);

    candidates.push({
      id: normalizedId,
      source,
      url,
      score: scoreMercadoLivreItemIdCandidate({ id: normalizedId, source })
    });
  };

  let parsedFinalUrl = null;
  try {
    parsedFinalUrl = typeof finalUrl === 'string' ? new URL(finalUrl) : finalUrl;
  } catch {
    parsedFinalUrl = null;
  }

  if (parsedFinalUrl) {
    const queryCandidates = [
      ['wid', parsedFinalUrl.searchParams.get('wid')],
      ['item_id', parsedFinalUrl.searchParams.get('item_id')],
      ['itemId', parsedFinalUrl.searchParams.get('itemId')],
      ['id', parsedFinalUrl.searchParams.get('id')]
    ];

    for (const [name, value] of queryCandidates) {
      if (!value) continue;
      pushCandidate(value, `query:${name}`, parsedFinalUrl.toString());
    }

    const goParam = parsedFinalUrl.searchParams.get('go');
    if (goParam) {
      const decodedGo = decodeHtmlEntities(safeDecodeURIComponent(goParam));
      pushCandidate(decodedGo, 'query:go', decodedGo);

      try {
        const goUrl = new URL(decodedGo);
        pushCandidate(goUrl.searchParams.get('wid'), 'query:go:wid', goUrl.toString());
        pushCandidate(goUrl.searchParams.get('item_id'), 'query:go:item_id', goUrl.toString());
      } catch {
        // Ignora URL inválida no parâmetro go.
      }
    }

    const fromUrlText = extractMercadoLivreItemIdsFromText(`${parsedFinalUrl.pathname}${parsedFinalUrl.search}`);
    for (const id of fromUrlText) {
      pushCandidate(id, 'url:path-search', parsedFinalUrl.toString());
    }
  }

  const socialFeatured = parseMercadoLivreSocialFeaturedData(html);
  if (socialFeatured?.href) {
    pushCandidate(extractMercadoLivreItemIdFromUrl(socialFeatured.href), 'social:featured.href', socialFeatured.href);
    for (const id of extractMercadoLivreItemIdsFromText(socialFeatured.href)) {
      pushCandidate(id, 'social:featured.href:text', socialFeatured.href);
    }
  }

  const socialLinks = extractMercadoLivreProductLinks(html).slice(0, 10);
  for (const link of socialLinks) {
    pushCandidate(extractMercadoLivreItemIdFromUrl(link), 'social:link:url', link);
    for (const id of extractMercadoLivreItemIdsFromText(link)) {
      pushCandidate(id, 'social:link:text', link);
    }
  }

  candidates.sort((a, b) => (b.score - a.score) || (b.id.length - a.id.length));
  return candidates;
}

async function getMercadoLivreProduct(link, requestHeaders = {}) {
  try {
    const response = await fetch(link, {
      method: 'GET',
      headers: requestHeaders,
      redirect: 'follow'
    });

    if (!response.ok) {
      throw new Error(`Falha ao acessar link de origem. Status: ${response.status}`);
    }

    const finalUrl = response.url || link;
    const html = await response.text();
    const itemCandidates = collectMercadoLivreItemIdCandidates({ finalUrl, html });

    if (!itemCandidates.length) {
      throw new Error('Não foi possível encontrar o ID do produto.');
    }

    let lastError = null;

    for (const candidate of itemCandidates.slice(0, 8)) {
      try {
        const itemResponse = await fetch(`https://api.mercadolibre.com/items/${candidate.id}`, {
          headers: requestHeaders,
          redirect: 'follow'
        });

        if (!itemResponse.ok) {
          throw new Error(`Falha ao consultar item ${candidate.id}. Status: ${itemResponse.status}`);
        }

        const itemData = await itemResponse.json();
        if (!itemData?.id) {
          throw new Error(`Resposta inválida para item ${candidate.id}.`);
        }

        let descData = null;
        try {
          const descResponse = await fetch(`https://api.mercadolibre.com/items/${itemData.id}/description`, {
            headers: requestHeaders,
            redirect: 'follow'
          });
          if (descResponse.ok) {
            descData = await descResponse.json();
          }
        } catch {
          // Descrição pode falhar e não deve abortar o item principal.
        }

        const pictures = Array.isArray(itemData.pictures)
          ? itemData.pictures.map((picture) => picture?.url).filter(Boolean)
          : [];

        const descriptionPlainText = normalizeMultilineText(descData?.plain_text || null, 6000);
        const descriptionText = normalizeMultilineText(descData?.text || null, 6000);
        const fallbackShortDescription = normalizeMultilineText(itemData?.short_description || null, 6000);
        let description = descriptionPlainText || descriptionText || fallbackShortDescription || null;
        let descriptionSource = descriptionPlainText
          ? 'api:items.description.plain_text'
          : descriptionText
            ? 'api:items.description.text'
            : fallbackShortDescription
              ? 'api:items.short_description'
              : null;

        if (!description || isGenericAffiliateDescription(description)) {
          const fallbackFromInitialHtml = selectHtmlDescriptionCandidate(html, 6000);
          if (fallbackFromInitialHtml) {
            description = fallbackFromInitialHtml.description;
            descriptionSource = fallbackFromInitialHtml.source;
          }
        }

        const permalink = typeof itemData?.permalink === 'string' ? itemData.permalink : null;
        if ((!description || isGenericAffiliateDescription(description)) && permalink) {
          try {
            const permalinkResponse = await fetch(permalink, {
              headers: requestHeaders,
              redirect: 'follow'
            });

            if (permalinkResponse.ok) {
              const permalinkHtml = await permalinkResponse.text();
              const fallbackFromPermalinkHtml = selectHtmlDescriptionCandidate(permalinkHtml, 6000);
              if (fallbackFromPermalinkHtml) {
                description = fallbackFromPermalinkHtml.description;
                descriptionSource = fallbackFromPermalinkHtml.source;
              }
            }
          } catch {
            // Fallback HTML é opcional e não deve abortar o item principal.
          }
        }

        return {
          id: itemData.id,
          title: normalizeText(itemData.title, 220),
          price: parseMoneyValue(itemData.price),
          currency: normalizeText(itemData.currency_id, 20),
          permalink: itemData.permalink || candidate.url || finalUrl,
          thumbnail: itemData.thumbnail || pictures[0] || parseImage(html, finalUrl),
          pictures,
          description,
          description_source: descriptionSource,
          source_url: finalUrl,
          item_source: candidate.source
        };
      } catch (candidateError) {
        lastError = candidateError;
      }
    }

    if (lastError) throw lastError;
    throw new Error('Não foi possível consultar os dados do produto na API do Mercado Livre.');
  } catch (error) {
    console.warn('[preview] mercadolivre api lookup failed', {
      url: link,
      message: error.message
    });
    return null;
  }
}

function isGenericAffiliateDescription(text) {
  const normalized = normalizeText(text, 500)?.toLowerCase() || '';
  if (!normalized) return false;

  return (
    normalized.includes('visite a página e encontre todos os produtos') ||
    normalized.includes('perfil social') ||
    normalized.includes('achadinhos em um só lugar') ||
    normalized.includes('todos os produtos em um só lugar')
  );
}

function isGenericMarketplaceTitle(text) {
  const normalized = normalizeText(text, 220)?.toLowerCase() || '';
  if (!normalized) return true;

  return (
    normalized === 'mercado livre' ||
    normalized === 'mercadolivre' ||
    normalized === 'mercado livre brasil' ||
    normalized.includes('perfil social') ||
    normalized.includes('mercado livre brasil')
  );
}

function extractMercadoLivreProductLinks(html) {
  const rawLinks = [
    ...[...html.matchAll(/https:\/\/(?:www\.)?(?:mercadolivre\.com\.br|mercadolibre\.com)\/[^"'<>\s)]+/gi)].map((match) => match[0]),
    ...[...html.matchAll(/https:\\\/\\\/(?:www\.)?(?:mercadolivre\.com\.br|mercadolibre\.com)\\\/[^"'<>\s)]+/gi)].map((match) => match[0]),
    ...[...html.matchAll(/https%3A%2F%2F(?:www\.)?(?:mercadolivre\.com\.br|mercadolibre\.com)%2F[^"'<>\s)]+/gi)].map((match) => match[0])
  ];
  const links = new Set();
  const visitedCandidates = new Set();

  const enqueueCandidate = (rawValue) => {
    if (!rawValue) return;

    let normalized = decodeHtmlEntities(String(rawValue))
      .replace(/\\u002F/gi, '/')
      .replace(/\\\//g, '/')
      .trim();

    if (!normalized) return;

    if (/^https%3a/i.test(normalized)) {
      normalized = safeDecodeURIComponent(normalized);
    }

    if (/^https?:\/\/.+%[0-9a-f]{2}/i.test(normalized)) {
      const decodedUrl = safeDecodeURIComponent(normalized);
      if (/^https?:\/\//i.test(decodedUrl)) {
        normalized = decodedUrl;
      }
    }

    if (visitedCandidates.has(normalized)) return;
    visitedCandidates.add(normalized);

    let parsed;
    try {
      parsed = new URL(normalized);
    } catch {
      return;
    }

    if (!isMercadoLivreHost(parsed.hostname)) return;
    if (parsed.pathname.includes('/social/')) return;

    const full = parsed.toString();
    const hasProductShape =
      hasMercadoLivreProductPath(parsed.pathname) ||
      MERCADO_LIVRE_ITEM_ID_REGEX.test(`${parsed.pathname}${parsed.search}`) ||
      /[?&]wid=MLB[A-Z]{0,3}\d{7,}/i.test(full) ||
      /item_id=MLB[A-Z]{0,3}\d{7,}/i.test(full);

    if (hasProductShape) {
      links.add(full);
    }

    for (const [, paramValue] of parsed.searchParams.entries()) {
      if (!paramValue) continue;
      const maybeUrl = decodeHtmlEntities(paramValue);
      if (!/(?:https?:\/\/|https%3A%2F%2F|mercadolivre\.com\.br|mercadolibre\.com)/i.test(maybeUrl)) continue;
      enqueueCandidate(maybeUrl);
    }
  };

  for (const rawLink of rawLinks) {
    const decoded = decodeHtmlEntities(rawLink)
      .replace(/\\u002F/gi, '/')
      .replace(/\\\//g, '/');

    enqueueCandidate(decoded);
  }

  const encodedUrlMatches = [...html.matchAll(/https%3A%2F%2F(?:www\.)?(?:mercadolivre\.com\.br|mercadolibre\.com)%2F[^"'<>\s)]+/gi)];
  for (const match of encodedUrlMatches) {
    enqueueCandidate(match[0]);
  }

  if (links.size) {
    return [...links];
  }

  // Fallback legado: tentativa direta para formatos sem escape.
  for (const rawLink of rawLinks) {
    const decoded = decodeHtmlEntities(rawLink)
      .replace(/\\u002F/gi, '/')
      .replace(/\\\//g, '/');

    let parsed;
    try {
      parsed = new URL(decoded);
    } catch {
      continue;
    }

    if (!isMercadoLivreHost(parsed.hostname)) continue;
    if (parsed.pathname.includes('/social/')) continue;

    const full = parsed.toString();
    const hasProductShape =
      hasMercadoLivreProductPath(parsed.pathname) ||
      MERCADO_LIVRE_ITEM_ID_REGEX.test(`${parsed.pathname}${parsed.search}`) ||
      /[?&]wid=MLB[A-Z]{0,3}\d{7,}/i.test(full) ||
      /item_id=MLB[A-Z]{0,3}\d{7,}/i.test(full);

    if (!hasProductShape) continue;
    links.add(full);
  }

  return [...links];
}

function scoreMercadoLivreProductLink(link, { preferredItemId = null, titleSlug = '' } = {}) {
  let score = 0;

  let parsed;
  try {
    parsed = new URL(link);
  } catch {
    return -999;
  }

  if (hasMercadoLivreProductPath(parsed.pathname)) score += 45;
  if (/[?&]wid=MLB[A-Z]{0,3}\d{7,}/i.test(parsed.search)) score += 20;

  const itemId = extractMercadoLivreItemIdFromUrl(parsed);
  if (itemId) score += 15;
  if (preferredItemId && itemId === preferredItemId) score += 90;

  if (titleSlug) {
    const pathSlug = normalizeSlug(parsed.pathname);
    const pathTokens = pathSlug.split('-').filter(Boolean);
    const titleTokens = titleSlug.split('-').filter(Boolean);
    const significantTitleTokens = titleTokens.filter((token) => token.length > 2);
    const matchedTokens = significantTitleTokens.filter((token) => pathTokens.includes(token));

    if (pathSlug.includes(titleSlug)) {
      score += 45;
    }

    score += Math.min(matchedTokens.length, 12) * 8;

    const numericTitleTokens = significantTitleTokens.filter((token) => /\d/.test(token));
    const matchedNumericTokens = numericTitleTokens.filter((token) => pathTokens.includes(token));
    score += matchedNumericTokens.length * 24;

    if (numericTitleTokens.length && !matchedNumericTokens.length) {
      score -= 70;
    }
  }

  if (parsed.pathname.includes('/social/')) score -= 1000;

  return score;
}

async function resolveMercadoLivreProductPage({ html, sourceUrl, requestHeaders }) {
  let sourceParsed;
  try {
    sourceParsed = new URL(sourceUrl);
  } catch {
    return null;
  }

  if (!isMercadoLivreHost(sourceParsed.hostname)) return null;

  const preferredItemId = extractMercadoLivreItemIdFromUrl(sourceParsed);
  const ogTitle = parseMetaTag(html, 'og:title') || parseMetaTag(html, 'title') || '';
  const titleSlug = normalizeSlug(ogTitle);

  const links = extractMercadoLivreProductLinks(html);
  if (!links.length) return null;

  let ranked = links
    .map((link, index) => ({
      link,
      index,
      score: scoreMercadoLivreProductLink(link, { preferredItemId, titleSlug })
    }))
    .sort((a, b) => (b.score - a.score) || (a.index - b.index));

  const sourceLooksLikeProduct = isLikelyProductPath(sourceParsed.pathname);
  if (sourceLooksLikeProduct && preferredItemId) {
    const sameItemCandidates = ranked.filter((item) => {
      return extractMercadoLivreItemIdFromUrl(item.link) === preferredItemId;
    });

    if (sameItemCandidates.length) {
      ranked = sameItemCandidates;
    }
  }

  const best = ranked[0];
  if (!best || best.score < 40) return null;

  if (best.link === sourceParsed.toString()) return null;

  const response = await fetch(best.link, {
    headers: requestHeaders,
    redirect: 'follow'
  });

  if (!response.ok) return null;

  const resolvedUrl = response.url || best.link;
  const resolvedHtml = await response.text();
  const blockedByVerification = isMercadoLivreVerificationUrl(resolvedUrl);
  const intendedUrl = blockedByVerification
    ? extractMercadoLivreVerificationTargetUrl(resolvedUrl) || best.link
    : null;

  return {
    html: resolvedHtml,
    url: resolvedUrl,
    link: best.link,
    score: best.score,
    blocked_by_verification: blockedByVerification,
    intended_url: intendedUrl
  };
}

function pushPriceCandidate(list, rawValue, source, baseScore, context = '') {
  const value = parseMoneyValue(rawValue);
  if (value === null) return;

  let score = baseScore;
  const text = String(context).toLowerCase();

  // Penalizações fortes para valores que normalmente não são o preço principal do produto.
  if (/frete|shipping|entrega/.test(text)) score -= 120;
  if (/cupom|cashback|coins|pontos/.test(text)) score -= 30;
  if (/de\s+r\$\s*[\d.,]+/.test(text)) score -= 20;

  // Bonificações para sinais de preço principal.
  if (/itemprop=["']price["']|product:price:amount|offers|price|pre[cç]o|amount/.test(text)) score += 12;
  if (/\bpor\s+r\$\s*[\d.,]+|à vista|a vista|pre[cç]o final/.test(text)) score += 10;

  if (score <= 0) return;

  list.push({ value, source, score });
}

function parsePriceFromTitle(html) {
  const found = [];
  const titleCandidates = [
    { source: 'meta:og:title', text: parseMetaTag(html, 'og:title') },
    { source: 'meta:twitter:title', text: parseMetaTag(html, 'twitter:title') },
    { source: 'tag:title', text: html.match(/<title[^>]*>([^<]+)<\/title>/i)?.[1] || null }
  ];

  for (const item of titleCandidates) {
    if (!item.text) continue;

    const match = String(item.text).match(/R\$\s*([\d.]+(?:,\d{1,2})?)/i);
    if (!match?.[1]) continue;

    pushPriceCandidate(found, match[1], `title:${item.source}`, 90, item.text);
  }

  return found;
}

function parsePriceFromText(html) {
  const found = [];
  const regex = /R\$\s*([\d.]+(?:,\d{1,2})?)/gi;
  let match;
  let processed = 0;

  while ((match = regex.exec(html)) !== null && processed < 600) {
    processed += 1;
    const index = match.index || 0;
    const before = html.slice(Math.max(0, index - 18), index).toLowerCase();
    const after = html.slice(index, Math.min(html.length, index + 72)).toLowerCase();
    const context = `${before} ${after}`;

    let baseScore = 35;
    if (/\bpor\s*$|à vista\s*$|a vista\s*$/.test(before)) baseScore += 20;
    if (/\bde\s*$|antes\s*$|pre[cç]o antigo\s*$/.test(before)) baseScore -= 25;
    if (/\b\d{1,2}\s*x(?:\s*de)?\s*$/.test(before)) baseScore -= 90;

    pushPriceCandidate(found, match[1], 'text:fallback', baseScore, context);
  }

  return found;
}

function selectBestPriceCandidate(candidates) {
  if (!candidates.length) return null;

  const grouped = new Map();
  for (const candidate of candidates) {
    const cents = Math.round(candidate.value * 100);
    const current = grouped.get(cents) || {
      value: candidate.value,
      totalScore: 0,
      count: 0,
      sources: new Set(),
      bestSource: candidate.source,
      bestScore: candidate.score
    };

    current.totalScore += candidate.score;
    current.count += 1;
    current.sources.add(candidate.source);
    if (candidate.score > current.bestScore) {
      current.bestScore = candidate.score;
      current.bestSource = candidate.source;
    }

    grouped.set(cents, current);
  }

  const ranked = [...grouped.values()].map((item) => ({
    ...item,
    sourceCount: item.sources.size,
    finalScore: item.totalScore + (item.sources.size * 12) + (item.count * 2)
  }));

  ranked.sort((a, b) =>
    (b.finalScore - a.finalScore) ||
    (b.sourceCount - a.sourceCount) ||
    (b.bestScore - a.bestScore) ||
    (b.value - a.value)
  );

  return {
    value: ranked[0].value,
    source: ranked[0].bestSource,
    confidence: ranked[0].finalScore,
    ranked: ranked.slice(0, 5).map((item) => ({
      value: item.value,
      source: item.bestSource,
      finalScore: item.finalScore,
      sourceCount: item.sourceCount
    }))
  };
}

function parsePrice(html) {
  const candidates = [];

  const socialFeatured = parseMercadoLivreSocialFeaturedData(html);
  if (socialFeatured?.price !== null && socialFeatured?.price !== undefined) {
    pushPriceCandidate(
      candidates,
      socialFeatured.price,
      'html:social.featured.price',
      165,
      'social featured current price'
    );
  }

  const metaTags = html.match(/<meta\s+[^>]*>/gi) || [];
  for (const tag of metaTags) {
    const content = tag.match(/\bcontent=["']([^"']+)["']/i)?.[1]?.trim();
    if (!content) continue;

    const property = tag.match(/\bproperty=["']([^"']+)["']/i)?.[1]?.toLowerCase() || '';
    const name = tag.match(/\bname=["']([^"']+)["']/i)?.[1]?.toLowerCase() || '';
    const itemprop = tag.match(/\bitemprop=["']([^"']+)["']/i)?.[1]?.toLowerCase() || '';

    if (property === 'product:price:amount') {
      pushPriceCandidate(candidates, content, 'meta:product:price:amount', 140, tag);
      continue;
    }

    if (property === 'og:price:amount' || name === 'price:amount') {
      pushPriceCandidate(candidates, content, 'meta:price:amount', 130, tag);
      continue;
    }

    if (itemprop === 'price') {
      pushPriceCandidate(candidates, content, 'meta:itemprop:price', 125, tag);
      continue;
    }

    if (property === 'price' || name === 'price') {
      pushPriceCandidate(candidates, content, 'meta:price', 95, tag);
      continue;
    }

    if (name === 'twitter:data1') {
      pushPriceCandidate(candidates, content, 'meta:twitter:data1', 45, tag);
    }
  }

  for (const candidate of parsePriceFromTitle(html)) {
    candidates.push(candidate);
  }

  // JSON-LD com ofertas normalmente contém o preço correto do produto.
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
          pushPriceCandidate(candidates, offer?.price, 'jsonld:offers.price', 135, 'jsonld offer price');
          pushPriceCandidate(candidates, offer?.lowPrice, 'jsonld:offers.lowPrice', 120, 'jsonld offer low price');
          pushPriceCandidate(candidates, offer?.highPrice, 'jsonld:offers.highPrice', 112, 'jsonld offer high price');
          pushPriceCandidate(candidates, offer?.priceSpecification?.price, 'jsonld:offers.priceSpecification.price', 118, 'jsonld offer price specification');
        }

        pushPriceCandidate(candidates, item?.price, 'jsonld:item.price', 110, 'jsonld item price');
      }
    } catch {
      // JSON-LD inválido é ignorado.
    }
  }

  for (const candidate of parsePriceFromText(html)) {
    candidates.push(candidate);
  }

  return selectBestPriceCandidate(candidates);
}

module.exports = async (req, res) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Cache-Control', 'no-store, max-age=0');
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

  if (!isMercadoLivreHost(parsed.hostname)) {
    return res.status(400).json({
      ok: false,
      error: 'A captura automatica aceita somente URLs do Mercado Livre.'
    });
  }

  try {
    console.info('[preview] request started', {
      url: parsed.toString()
    });

    const openClawResult = await getOpenClawProduct(parsed.toString());
    const openClawProduct = openClawResult?.product || null;
    const openClawDiagnostics = openClawResult?.diagnostics || null;
    const openClawData = buildOpenClawPreviewData(openClawProduct, parsed.toString());

    if (isCompletePreviewData(openClawData)) {
      console.info('[preview] extraction result', {
        source: 'openclaw',
        source_url: openClawData.source_url,
        resolved_product_url: openClawData.resolved_product_url,
        title_found: Boolean(openClawData.title),
        image_found: Boolean(openClawData.image),
        price: openClawData.price,
        price_source: openClawData.price_source,
        description_found: Boolean(openClawData.description),
        description_source: openClawData.description_source,
        ml_item_id: openClawData.ml_item_id
      });

      return res.status(200).json({
        ok: true,
        data: withCaptureDiagnostics(withCaptureSource(openClawData, 'openclaw'), openClawDiagnostics),
        limitations: [
          'A extração principal foi feita via Open.Claw.',
          'Se a Open.Claw falhar ou retornar dados parciais, o sistema usa fallback local de extração.'
        ]
      });
    }

    const requestHeaders = {
      'user-agent': 'Mozilla/5.0 (compatible; AffiliateCatalogBot/1.0; +https://vercel.com)',
      'accept-language': 'pt-BR,pt;q=0.9,en;q=0.8'
    };

    const apiProduct = await getMercadoLivreProduct(parsed.toString(), requestHeaders);
    if (apiProduct?.title) {
      const apiData = {
        title: apiProduct.title,
        image: apiProduct.thumbnail || (apiProduct.pictures?.[0] || null),
        price: apiProduct.price ?? null,
        price_source: apiProduct.price !== null ? 'api:items.price' : null,
        price_confidence: apiProduct.price !== null ? 220 : null,
        description: apiProduct.description || null,
        description_source: apiProduct.description_source || null,
        source_url: apiProduct.source_url || parsed.toString(),
        resolved_product_url: apiProduct.permalink || null,
        ml_item_id: apiProduct.id || null,
        ml_currency: apiProduct.currency || null,
        ml_permalink: apiProduct.permalink || null,
        ml_thumbnail: apiProduct.thumbnail || null,
        ml_pictures: Array.isArray(apiProduct.pictures) ? apiProduct.pictures : []
      };
      const data = mergePreviewData(openClawData, apiData);

      console.info('[preview] extraction result', {
        source: hasPreviewSignal(openClawData) ? 'openclaw+mercadolivre_api' : 'mercadolivre_api',
        source_url: data.source_url,
        resolved_product_url: data.resolved_product_url,
        title_found: Boolean(data.title),
        image_found: Boolean(data.image),
        price: data.price,
        price_source: data.price_source,
        description_found: Boolean(data.description),
        description_source: data.description_source,
        ml_item_id: data.ml_item_id,
        item_source: apiProduct.item_source || null
      });

      const captureSource = hasPreviewSignal(openClawData) ? 'openclaw+mercadolivre_api' : 'mercadolivre_api';
      return res.status(200).json({
        ok: true,
        data: withCaptureDiagnostics(withCaptureSource(data, captureSource), openClawDiagnostics),
        limitations: [
          hasPreviewSignal(openClawData)
            ? 'A extração combinou Open.Claw com a API pública do Mercado Livre.'
            : 'A extração principal foi feita pela API pública do Mercado Livre.',
          'Se a Open.Claw, a API ou o item estiverem indisponíveis, o sistema usa fallback por metadados HTML.'
        ]
      });
    }

    const response = await fetch(parsed.toString(), {
      headers: requestHeaders,
      redirect: 'follow'
    });

    if (!response.ok) {
      console.warn('[preview] upstream request failed', {
        url: parsed.toString(),
        status: response.status
      });

      if (hasPreviewSignal(openClawData)) {
        return res.status(200).json({
          ok: true,
          data: withCaptureDiagnostics(withCaptureSource(openClawData, 'openclaw'), openClawDiagnostics),
          limitations: [
            'A Open.Claw retornou dados utilizáveis, mas o acesso direto à URL externa falhou.',
            `Falha ao acessar URL externa. Status: ${response.status}`
          ]
        });
      }

      return res.status(502).json({
        ok: false,
        error: `Falha ao acessar URL externa. Status: ${response.status}`
      });
    }

    const html = await response.text();
    const baseUrl = response.url || parsed.toString();
    const baseParsed = new URL(baseUrl);

    let finalHtml = html;
    let finalSourceUrl = baseUrl;
    let productResolution = null;

    const initialDescription = parseDescription(html);
    const shouldResolveProductPage =
      isMercadoLivreHost(baseParsed.hostname) &&
      (!isLikelyProductPath(baseParsed.pathname) || isGenericAffiliateDescription(initialDescription?.value));

    if (shouldResolveProductPage) {
      try {
        productResolution = await resolveMercadoLivreProductPage({
          html,
          sourceUrl: baseUrl,
          requestHeaders
        });
      } catch (resolutionError) {
        console.warn('[preview] product page resolution failed', {
          source_url: baseUrl,
          message: resolutionError.message
        });
      }

      const hasUsableProductResolution = Boolean(productResolution?.html && !productResolution?.blocked_by_verification);
      if (hasUsableProductResolution) {
        finalHtml = productResolution.html;
        finalSourceUrl = productResolution.url || finalSourceUrl;
      }
    }

    const title = parseTitle(finalHtml) || parseTitle(html);
    const image = parseImage(finalHtml, finalSourceUrl) || parseImage(html, baseUrl);
    const priceResult = parsePrice(finalHtml) || parsePrice(html);

    const primaryDescription = parseDescription(html);
    const resolvedDescription = finalHtml !== html ? parseDescription(finalHtml) : null;
    const shouldPreferResolvedDescription =
      Boolean(resolvedDescription?.value) &&
      (
        !primaryDescription?.value ||
        isGenericAffiliateDescription(primaryDescription.value) ||
        resolvedDescription.value.length > (primaryDescription.value?.length || 0) + 40
      );

    const descriptionResult = shouldPreferResolvedDescription ? resolvedDescription : primaryDescription;
    const socialFeaturedData = parseMercadoLivreSocialFeaturedData(html);

    const hasUsableProductResolution = Boolean(productResolution && !productResolution.blocked_by_verification);
    let finalTitle = title;
    let finalPrice = priceResult?.value ?? null;
    let finalPriceSource = priceResult?.source || null;
    let finalPriceConfidence = priceResult?.confidence ?? null;
    let finalDescription = descriptionResult?.value ?? null;
    let finalDescriptionSource = descriptionResult?.source || null;

    let finalSourceParsed = null;
    try {
      finalSourceParsed = new URL(finalSourceUrl);
    } catch {
      // Sem URL válida: segue com os dados atuais.
    }

    const isSocialSource = Boolean(
      finalSourceParsed &&
      isMercadoLivreHost(finalSourceParsed.hostname) &&
      finalSourceParsed.pathname.includes('/social/')
    );

    if (isSocialSource && !hasUsableProductResolution) {
      if (isGenericMarketplaceTitle(finalTitle)) {
        finalTitle = null;
      }

      if (isGenericAffiliateDescription(finalDescription)) {
        finalDescription = null;
        finalDescriptionSource = null;
      }

      const weakPriceSource =
        !finalPriceSource ||
        finalPriceSource.startsWith('text:') ||
        finalPriceSource.startsWith('title:');

      if (weakPriceSource || (typeof finalPriceConfidence === 'number' && finalPriceConfidence < 120)) {
        finalPrice = null;
        finalPriceSource = null;
        finalPriceConfidence = null;
      }

      if ((finalPrice === null || finalPrice === undefined) && socialFeaturedData?.price !== null && socialFeaturedData?.price !== undefined) {
        finalPrice = socialFeaturedData.price;
        finalPriceSource = 'html:social.featured.price';
        finalPriceConfidence = 160;
      }

      if (!finalDescription && socialFeaturedData?.description) {
        finalDescription = socialFeaturedData.description;
        finalDescriptionSource = 'html:social.featured.summary';
      }

      if (!finalDescription && finalTitle) {
        finalDescription = `Produto identificado via perfil social: ${finalTitle}.`;
        finalDescriptionSource = 'fallback:social.title';
      }
    }

    const resolvedProductUrl = productResolution?.blocked_by_verification
      ? (productResolution?.intended_url || null)
      : (productResolution?.url || null);
    const mlItemId = extractMercadoLivreItemIdFromUrl(resolvedProductUrl || finalSourceUrl || baseUrl);

    const htmlData = {
      title: finalTitle,
      image,
      price: finalPrice,
      price_source: finalPriceSource,
      price_confidence: finalPriceConfidence,
      description: finalDescription,
      description_source: finalDescriptionSource,
      source_url: finalSourceUrl,
      resolved_product_url: resolvedProductUrl,
      ml_item_id: mlItemId,
      ml_currency: null,
      ml_permalink: resolvedProductUrl || null,
      ml_thumbnail: image || null,
      ml_pictures: image ? [image] : []
    };
    const data = mergePreviewData(openClawData, htmlData);

    console.info('[preview] extraction result', {
      source: hasPreviewSignal(openClawData) ? 'openclaw+html' : 'html',
      source_url: finalSourceUrl,
      original_url: baseUrl,
      resolved_product_url: data.resolved_product_url,
      blocked_by_verification: Boolean(productResolution?.blocked_by_verification),
      title_found: Boolean(data.title),
      image_found: Boolean(data.image),
      price: data.price,
      price_source: data.price_source,
      price_confidence: data.price_confidence,
      price_top_candidates: priceResult?.ranked || [],
      description_found: Boolean(data.description),
      description_source: data.description_source
    });

    const captureSource = hasPreviewSignal(openClawData) ? 'openclaw+html' : 'html';
    return res.status(200).json({
      ok: true,
      data: withCaptureDiagnostics(withCaptureSource(data, captureSource), openClawDiagnostics),
      limitations: [
        hasPreviewSignal(openClawData)
          ? 'A extração combinou Open.Claw com metadados públicos da página.'
          : 'A extração depende de metadados públicos da página.',
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
