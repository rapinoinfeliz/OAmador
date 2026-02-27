import { load } from 'cheerio';

const BASE_URL = 'https://www.corridasbr.com.br';
const DEFAULT_TIMEOUT_MS = 20000;
const cache = new Map();

function cleanText(value) {
  return String(value || '').replace(/\s+/g, ' ').replace(/\u00a0/g, ' ').trim();
}

function normalizeState(state) {
  const normalized = cleanText(state).toUpperCase();
  if (!/^[A-Z]{2}$/.test(normalized)) {
    throw new Error('Parâmetro "state" inválido. Use UF com 2 letras, ex: SC.');
  }
  return normalized;
}

function toAbsoluteUrl(state, href) {
  if (!href) {
    return '';
  }
  if (/^https?:\/\//i.test(href)) {
    return encodeURI(href);
  }
  const normalizedState = normalizeState(state);
  if (href.startsWith('/')) {
    return encodeURI(`${BASE_URL}${href}`);
  }
  return encodeURI(`${BASE_URL}/${normalizedState}/${href}`);
}

async function fetchHtml(url, timeoutMs = DEFAULT_TIMEOUT_MS) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'OAmadorBot/1.0 (+https://github.com/rapinoinfeliz/OAmador)'
      }
    });

    if (!response.ok) {
      throw new Error(`Falha ao buscar ${url}: HTTP ${response.status}`);
    }

    const buffer = Buffer.from(await response.arrayBuffer());
    return new TextDecoder('iso-8859-1').decode(buffer);
  } finally {
    clearTimeout(timeout);
  }
}

function parseFunctionLinks(html) {
  const links = {};
  const regex = /function\s+([a-zA-Z0-9_]+)\s*\(\)\s*\{\s*(?:window\.open|window\.location\.replace)\('([^']+)'\)/g;
  let match = regex.exec(html);

  while (match) {
    const fnName = cleanText(match[1]);
    const url = cleanText(match[2]);
    if (fnName && url) {
      links[fnName] = url;
    }
    match = regex.exec(html);
  }

  return links;
}

function getCache(key) {
  const hit = cache.get(key);
  if (!hit) {
    return null;
  }

  if (Date.now() > hit.expiresAt) {
    cache.delete(key);
    return null;
  }

  return hit.value;
}

function setCache(key, value, ttlMs) {
  cache.set(key, {
    value,
    expiresAt: Date.now() + ttlMs
  });
}

function extractRaceId(href) {
  if (!href) {
    return '';
  }
  const match = href.match(/escolha=(\d+)/i);
  return match ? match[1] : '';
}

function parseMonthHeader(rowText) {
  const text = cleanText(rowText).toLowerCase();
  const months = [
    'janeiro',
    'fevereiro',
    'março',
    'marco',
    'abril',
    'maio',
    'junho',
    'julho',
    'agosto',
    'setembro',
    'outubro',
    'novembro',
    'dezembro'
  ];

  for (const month of months) {
    if (text.includes(month)) {
      return month === 'marco' ? 'março' : month;
    }
  }
  return '';
}

function normalizeDateRaw(raw) {
  const text = cleanText(raw).replace(/,/g, '.');
  const match = text.match(/(\d{1,2})[.\/-](\d{1,2})(?:[.\/-](\d{2,4}))?/);
  if (!match) {
    return null;
  }

  const day = Number(match[1]);
  const month = Number(match[2]);
  let year = match[3] ? Number(match[3]) : null;

  if (year && year < 100) {
    year += 2000;
  }

  return {
    raw: match[0],
    day,
    month,
    year
  };
}

export async function getAvailableStates({ forceRefresh = false } = {}) {
  const cacheKey = 'states';
  if (!forceRefresh) {
    const cached = getCache(cacheKey);
    if (cached) {
      return cached;
    }
  }

  const html = await fetchHtml(`${BASE_URL}/SC/Calendario.asp`);
  const $ = load(html);
  const states = [];
  const seen = new Set();

  $('a.menutop[href*="/Calendario.asp"], a.menutop[href*="/calendario.asp"]').each((_, element) => {
    const href = cleanText($(element).attr('href'));
    const uf = cleanText($(element).text()).toUpperCase();

    if (!/^[A-Z]{2}$/.test(uf)) {
      return;
    }

    if (seen.has(uf)) {
      return;
    }

    seen.add(uf);
    states.push({
      state: uf,
      calendar_url: href.startsWith('http') ? href : `${BASE_URL}${href}`
    });
  });

  const payload = {
    source_url: `${BASE_URL}/SC/Calendario.asp`,
    count: states.length,
    states,
    fetched_at: new Date().toISOString()
  };

  setCache(cacheKey, payload, 12 * 60 * 60 * 1000);
  return payload;
}

export async function getCalendarByState(state, { forceRefresh = false } = {}) {
  const normalizedState = normalizeState(state);
  const cacheKey = `calendar:${normalizedState}`;

  if (!forceRefresh) {
    const cached = getCache(cacheKey);
    if (cached) {
      return cached;
    }
  }

  const url = `${BASE_URL}/${normalizedState}/Calendario.asp`;
  const html = await fetchHtml(url);
  const $ = load(html);

  let currentMonth = '';
  const races = [];
  const dedupe = new Set();

  $('tr').each((_, tr) => {
    const row = $(tr);
    const directTds = row.children('td');
    const monthHeader = parseMonthHeader(directTds.first().text() || row.text());
    if (monthHeader) {
      currentMonth = monthHeader;
    }

    const raceAnchor = row.find("a[href*='mostracorrida.asp?escolha=']").first();
    if (!raceAnchor.length) {
      return;
    }

    if (directTds.length < 4) {
      return;
    }

    const dateText = cleanText($(directTds[0]).text());
    const date = normalizeDateRaw(dateText);
    if (!date) {
      return;
    }

    const cityAnchor = $(directTds[1]).find("a[href*='por_cidade.asp']").first();
    const raceHref = cleanText(raceAnchor.attr('href'));
    const raceId = extractRaceId(raceHref);
    if (!raceId || !cityAnchor.length) {
      return;
    }

    const cityText = cleanText(cityAnchor.text()) || cleanText($(directTds[1]).text());
    const distanceText = cleanText($(directTds[3]).text());
    const suspiciousCity = /próximas corridas|nome da corrida|cidade|data|janeiro|fevereiro|março|marco|abril|maio|junho|julho|agosto|setembro|outubro|novembro|dezembro/i.test(
      cityText
    );
    const suspiciousDistance =
      !distanceText ||
      /janeiro|fevereiro|março|marco|abril|maio|junho|julho|agosto|setembro|outubro|novembro|dezembro/i.test(
        distanceText
      );

    if (suspiciousCity || suspiciousDistance) {
      return;
    }

    const dedupeKey = `${raceId}:${date.raw}:${cityText}`.toLowerCase();
    if (dedupe.has(dedupeKey)) {
      return;
    }
    dedupe.add(dedupeKey);

    races.push({
      id: raceId,
      state: normalizedState,
      month_label: currentMonth,
      date_display: date.raw,
      date_day: date.day,
      date_month: date.month,
      date_year: date.year,
      city: cityText,
      city_url: toAbsoluteUrl(normalizedState, cleanText(cityAnchor.attr('href'))),
      race_name: cleanText(raceAnchor.text()),
      distance: distanceText,
      details_url: toAbsoluteUrl(normalizedState, raceHref)
    });
  });

  const payload = {
    state: normalizedState,
    source_url: url,
    count: races.length,
    races,
    fetched_at: new Date().toISOString()
  };

  setCache(cacheKey, payload, 15 * 60 * 1000);
  return payload;
}

export async function getRaceDetails(state, raceId, { forceRefresh = false } = {}) {
  const normalizedState = normalizeState(state);
  const normalizedRaceId = cleanText(raceId);
  if (!/^\d+$/.test(normalizedRaceId)) {
    throw new Error('Parâmetro "raceId" inválido. Use um número, ex: 53035.');
  }

  const cacheKey = `race:${normalizedState}:${normalizedRaceId}`;
  if (!forceRefresh) {
    const cached = getCache(cacheKey);
    if (cached) {
      return cached;
    }
  }

  const url = `${BASE_URL}/${normalizedState}/mostracorrida.asp?escolha=${normalizedRaceId}`;
  const html = await fetchHtml(url);
  const $ = load(html);
  const functionLinks = parseFunctionLinks(html);

  const infoTable = $('table[width="600"]').filter((_, table) => {
    const text = cleanText($(table).text());
    return text.includes('Data:') && text.includes('Cidade:') && text.includes('Dist');
  }).first();

  if (!infoTable.length) {
    throw new Error('Não consegui extrair os dados da corrida. O HTML de origem pode ter mudado.');
  }

  const title = cleanText(infoTable.find('tr').first().text());

  let date = '';
  let city = '';
  let distance = '';
  let cityCalendarUrl = '';
  let regionCalendarUrl = '';
  let infoLink = '';

  infoTable.find('tr').each((_, tr) => {
    const row = $(tr);
    const tds = row.find('td');
    if (tds.length < 2) {
      return;
    }

    const label = cleanText($(tds[0]).text()).toLowerCase();
    const valueCell = $(tds[1]);
    const valueText = cleanText(valueCell.text());

    if (label.startsWith('data')) {
      date = valueText;
      return;
    }

    if (label.startsWith('cidade')) {
      city = cleanText(valueCell.find('td').first().text()) || valueText;
      const cityHref = cleanText(valueCell.find("a[href*='por_cidade.asp']").attr('href'));
      const regionHref = cleanText(valueCell.find("a[href*='por_regiao.asp']").attr('href'));
      cityCalendarUrl = toAbsoluteUrl(normalizedState, cityHref);
      regionCalendarUrl = toAbsoluteUrl(normalizedState, regionHref);
      return;
    }

    if (label.startsWith('dist')) {
      distance = valueText;
      return;
    }

    if (label.includes('mais informações')) {
      const onclickRaw = cleanText(valueCell.find('[onclick]').attr('onclick'));
      const fnMatch = onclickRaw.match(/^([a-zA-Z0-9_]+)\(/);
      if (fnMatch) {
        infoLink = functionLinks[fnMatch[1]] || '';
      }
    }
  });

  const payload = {
    id: normalizedRaceId,
    state: normalizedState,
    source_url: url,
    title,
    date,
    city,
    distance,
    city_calendar_url: cityCalendarUrl,
    region_calendar_url: regionCalendarUrl,
    info_url: infoLink,
    registration_url: functionLinks.parainsc || infoLink,
    regulation_url: functionLinks.parareg || '',
    fetched_at: new Date().toISOString()
  };

  setCache(cacheKey, payload, 6 * 60 * 60 * 1000);
  return payload;
}
