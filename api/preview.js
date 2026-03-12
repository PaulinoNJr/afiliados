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

  return extractMercadoLivreItemId(`${parsed.pathname}${parsed.search}`);
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

    const requestHeaders = {
      'user-agent': 'Mozilla/5.0 (compatible; AffiliateCatalogBot/1.0; +https://vercel.com)',
      'accept-language': 'pt-BR,pt;q=0.9,en;q=0.8'
    };

    const response = await fetch(parsed.toString(), {
      headers: requestHeaders,
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
    }

    const resolvedProductUrl = productResolution?.blocked_by_verification
      ? (productResolution?.intended_url || null)
      : (productResolution?.url || null);

    const data = {
      title: finalTitle,
      image,
      price: finalPrice,
      price_source: finalPriceSource,
      price_confidence: finalPriceConfidence,
      description: finalDescription,
      description_source: finalDescriptionSource,
      source_url: finalSourceUrl,
      resolved_product_url: resolvedProductUrl
    };

    console.info('[preview] extraction result', {
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
