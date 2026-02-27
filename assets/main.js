const SITE_CONFIG = {
  youtubeChannelId: '',
  youtubeHandle: '@oamador',
  whatsappNumber: '55119999999',
  fallbackVideos: [
    {
      id: '',
      title: 'Resenha do Amador: treino forte sem papo furado',
      publishedAt: '2026-02-20T12:00:00Z',
      link: 'https://www.youtube.com/@oamador/videos',
      thumbnail: 'https://images.pexels.com/photos/6550877/pexels-photo-6550877.jpeg?auto=compress&cs=tinysrgb&w=900'
    },
    {
      id: '',
      title: 'Jornal Foco no Tri: resultado, treta e análise na lata',
      publishedAt: '2026-02-17T12:00:00Z',
      link: 'https://www.youtube.com/@oamador/videos',
      thumbnail: 'https://images.pexels.com/photos/163444/sport-swim-bike-bicycle-163444.jpeg?auto=compress&cs=tinysrgb&w=900'
    },
    {
      id: '',
      title: 'Projetando pace para 70.3 sem ilusão',
      publishedAt: '2026-02-14T12:00:00Z',
      link: 'https://www.youtube.com/@oamador/videos',
      thumbnail: 'https://images.pexels.com/photos/1173656/pexels-photo-1173656.jpeg?auto=compress&cs=tinysrgb&w=900'
    }
  ]
};

const RACE_DISTANCES = {
  super_sprint: { label: 'Super Sprint', swim: 400, bike: 10, run: 2.5 },
  sprint: { label: 'Sprint', swim: 750, bike: 20, run: 5 },
  olimpico: { label: 'Olímpico', swim: 1500, bike: 40, run: 10 },
  half: { label: '70.3', swim: 1900, bike: 90, run: 21.1 },
  full: { label: 'Full Ironman', swim: 3800, bike: 180, run: 42.195 }
};

const CHECKLIST_GROUPS = {
  natacao: ['Macaquinho', 'Touca extra', 'Óculos principal', 'Óculos reserva', 'Squeeze pré-largada'],
  ciclismo: ['Capacete', 'Óculos bike', 'Sapatilha', 'Número na bike', 'Géis para bike', 'Mini bomba/CO2'],
  corrida: ['Tênis corrida', 'Viseira/boné', 'Número de peito', 'Meia seca', 'Géis para corrida'],
  pos_prova: ['Roupa seca', 'Chinelo', 'Recuperador', 'Documento/Cartão', 'Cara de sapo em paz']
};

const MONTH_ORDER = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];

document.addEventListener('DOMContentLoaded', () => {
  setupCommonUI();
  setupHomePage();
  setupToolsPage();
  setupCalendarPage();
});

function setupCommonUI() {
  const yearNode = document.querySelector('[data-year]');
  if (yearNode) {
    yearNode.textContent = String(new Date().getFullYear());
  }

  const menuBtn = document.querySelector('[data-menu-toggle]');
  const nav = document.querySelector('[data-main-nav]');
  if (menuBtn && nav) {
    menuBtn.addEventListener('click', () => {
      nav.classList.toggle('open');
      menuBtn.setAttribute('aria-expanded', nav.classList.contains('open') ? 'true' : 'false');
    });
  }

  document.querySelectorAll('[data-whatsapp-link]').forEach((node) => {
    node.href = `https://wa.me/${SITE_CONFIG.whatsappNumber}`;
    node.target = '_blank';
    node.rel = 'noopener noreferrer';
  });

  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add('visible');
          observer.unobserve(entry.target);
        }
      });
    },
    { threshold: 0.15 }
  );

  document.querySelectorAll('.reveal').forEach((node) => observer.observe(node));
}

function setupHomePage() {
  const feedEl = document.getElementById('youtube-feed');
  if (feedEl) {
    loadYoutubeVideos(feedEl);
  }

  const newsletterForm = document.getElementById('newsletter-form');
  if (newsletterForm) {
    newsletterForm.addEventListener('submit', (event) => {
      event.preventDefault();
      const emailInput = newsletterForm.querySelector('input[type="email"]');
      const feedback = document.getElementById('newsletter-feedback');

      if (!emailInput || !feedback) {
        return;
      }

      const email = emailInput.value.trim();
      if (!isValidEmail(email)) {
        feedback.innerHTML = renderAlert('Manda um e-mail válido para receber os babados sem erro.', 'error');
        return;
      }

      const leads = JSON.parse(localStorage.getItem('oamador_leads') || '[]');
      if (!leads.includes(email)) {
        leads.push(email);
      }
      localStorage.setItem('oamador_leads', JSON.stringify(leads));
      emailInput.value = '';
      feedback.innerHTML = renderAlert('Boa. Você entrou na lista VIP. Agora é só esperar o caos organizado do triathlon.', 'success');
    });
  }
}

async function loadYoutubeVideos(feedEl) {
  const videos = await getLatestVideos();
  feedEl.innerHTML = videos
    .map((video) => {
      const thumb = video.thumbnail || (video.id ? `https://i.ytimg.com/vi/${video.id}/hqdefault.jpg` : 'https://images.pexels.com/photos/3764011/pexels-photo-3764011.jpeg?auto=compress&cs=tinysrgb&w=900');
      const date = formatDate(video.publishedAt);
      const videoLink = video.link || (video.id ? `https://www.youtube.com/watch?v=${video.id}` : `https://www.youtube.com/${SITE_CONFIG.youtubeHandle}`);
      return `
        <article class="card reveal">
          <img class="video-thumb" src="${thumb}" alt="Miniatura do vídeo ${escapeHtml(video.title)}" loading="lazy" />
          <div class="card-body">
            <div class="video-meta">${date}</div>
            <h3 class="video-title">${escapeHtml(video.title)}</h3>
            <a class="link-row" href="${videoLink}" target="_blank" rel="noopener noreferrer">Ver agora</a>
          </div>
        </article>
      `;
    })
    .join('');

  document.querySelectorAll('#youtube-feed .reveal').forEach((node) => {
    node.classList.add('visible');
  });

  const note = document.getElementById('youtube-note');
  if (note && !SITE_CONFIG.youtubeChannelId) {
    note.textContent = 'Dica rápida: preencha youtubeChannelId em assets/main.js para puxar os últimos uploads automáticos.';
  }
}

async function getLatestVideos() {
  if (!SITE_CONFIG.youtubeChannelId) {
    return SITE_CONFIG.fallbackVideos;
  }

  try {
    const feedUrl = `https://www.youtube.com/feeds/videos.xml?channel_id=${SITE_CONFIG.youtubeChannelId}`;
    const proxyUrl = `https://api.allorigins.win/get?url=${encodeURIComponent(feedUrl)}`;
    const response = await fetch(proxyUrl);
    if (!response.ok) {
      throw new Error('Falha ao buscar feed do YouTube.');
    }

    const payload = await response.json();
    const xmlDoc = new DOMParser().parseFromString(payload.contents, 'application/xml');
    const entries = Array.from(xmlDoc.querySelectorAll('entry')).slice(0, 3);

    const parsed = entries
      .map((entry) => {
        const id = getTagValue(entry, ['yt:videoId', 'videoId']);
        const title = getTagValue(entry, ['title']);
        const publishedAt = getTagValue(entry, ['published']);
        const thumbNode = entry.querySelector('media\\:thumbnail') || entry.getElementsByTagNameNS('*', 'thumbnail')[0];
        const thumbnail = thumbNode ? thumbNode.getAttribute('url') : '';

        if (!id || !title) {
          return null;
        }

        return { id, title, publishedAt, thumbnail };
      })
      .filter(Boolean);

    return parsed.length ? parsed : SITE_CONFIG.fallbackVideos;
  } catch (error) {
    return SITE_CONFIG.fallbackVideos;
  }
}

function setupToolsPage() {
  setupPaceCalculator();
  setupRaceProjector();
  setupPowerZones();
  setupChecklist();
}

function setupCalendarPage() {
  const page = document.getElementById('calendar-page');
  if (!page) {
    return;
  }

  const stateSelect = document.getElementById('calendar-state');
  const monthSelect = document.getElementById('calendar-month');
  const searchInput = document.getElementById('calendar-search');
  const refreshBtn = document.getElementById('calendar-refresh');
  const listNode = document.getElementById('calendar-list');
  const metaNode = document.getElementById('calendar-meta');
  const countNode = document.getElementById('calendar-count');
  const modal = document.getElementById('race-modal');
  const modalTitle = document.getElementById('race-modal-title');
  const modalBody = document.getElementById('race-modal-body');

  if (!stateSelect || !monthSelect || !searchInput || !refreshBtn || !listNode || !metaNode || !countNode || !modal || !modalTitle || !modalBody) {
    return;
  }

  const state = {
    selectedUf: 'SC',
    selectedMonth: 'all',
    searchTerm: '',
    races: [],
    isLoading: false
  };

  const queryUf = new URLSearchParams(window.location.search).get('state');
  if (queryUf && /^[A-Za-z]{2}$/.test(queryUf)) {
    state.selectedUf = queryUf.toUpperCase();
  }

  const closeModal = () => {
    modal.hidden = true;
    document.body.style.overflow = '';
  };

  const openModal = (title, bodyHtml) => {
    modalTitle.textContent = title;
    modalBody.innerHTML = bodyHtml;
    modal.hidden = false;
    document.body.style.overflow = 'hidden';
  };

  modal.addEventListener('click', (event) => {
    if (event.target instanceof HTMLElement && (event.target.dataset.modalClose !== undefined || event.target === modal)) {
      closeModal();
    }
  });

  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && !modal.hidden) {
      closeModal();
    }
  });

  stateSelect.addEventListener('change', () => {
    state.selectedUf = stateSelect.value;
    loadCalendar();
  });

  monthSelect.addEventListener('change', () => {
    state.selectedMonth = monthSelect.value;
    renderCalendar();
  });

  searchInput.addEventListener('input', () => {
    state.searchTerm = searchInput.value.trim().toLowerCase();
    renderCalendar();
  });

  refreshBtn.addEventListener('click', () => {
    loadCalendar(true);
  });

  listNode.addEventListener('click', async (event) => {
    const target = event.target;
    if (!(target instanceof HTMLElement)) {
      return;
    }

    const button = target.closest('[data-race-details]');
    if (!button) {
      return;
    }

    const raceId = button.getAttribute('data-race-details');
    if (!raceId) {
      return;
    }

    openModal('Carregando detalhes...', '<p class="small">Puxando os dados oficiais da prova...</p>');

    try {
      const response = await fetch(`/api/race/${encodeURIComponent(state.selectedUf)}/${encodeURIComponent(raceId)}`);
      if (!response.ok) {
        throw new Error(`Falha ao carregar detalhes (HTTP ${response.status})`);
      }
      const race = await response.json();

      openModal(
        race.title || 'Detalhes da prova',
        `
          <div class="race-modal-grid">
            <div><strong>Data</strong><span>${escapeHtml(race.date || 'Não informado')}</span></div>
            <div><strong>Cidade</strong><span>${escapeHtml(race.city || 'Não informado')}</span></div>
            <div><strong>Distância</strong><span>${escapeHtml(race.distance || 'Não informado')}</span></div>
            <div><strong>UF</strong><span>${escapeHtml(race.state || state.selectedUf)}</span></div>
          </div>
          <div class="race-modal-actions">
            ${race.info_url ? `<a class="btn btn-primary" target="_blank" rel="noopener noreferrer" href="${escapeHtml(race.info_url)}">Mais informações</a>` : ''}
            ${race.registration_url ? `<a class="btn btn-secondary" target="_blank" rel="noopener noreferrer" href="${escapeHtml(race.registration_url)}">Inscrição</a>` : ''}
            ${race.regulation_url ? `<a class="btn btn-secondary" target="_blank" rel="noopener noreferrer" href="${escapeHtml(race.regulation_url)}">Regulamento</a>` : ''}
          </div>
          <p class="small">Sempre confirme os dados direto com a organização.</p>
        `
      );
    } catch (error) {
      openModal('Deu ruim no detalhe', `<p>${escapeHtml(error.message)}</p>`);
    }
  });

  async function loadStates() {
    try {
      const response = await fetch('/api/states');
      if (!response.ok) {
        throw new Error('Não consegui carregar as UFs.');
      }
      const payload = await response.json();
      const states = Array.isArray(payload.states) ? payload.states : [];
      stateSelect.innerHTML = states
        .map((entry) => {
          const uf = escapeHtml(entry.state || '');
          const selected = uf === state.selectedUf ? 'selected' : '';
          return `<option value="${uf}" ${selected}>${uf}</option>`;
        })
        .join('');
    } catch (error) {
      stateSelect.innerHTML = '<option value="SC">SC</option>';
      state.selectedUf = 'SC';
      metaNode.innerHTML = renderAlert('Falha ao buscar lista de estados. Usei SC como padrão.', 'error');
    }
  }

  async function loadCalendar(forceRefresh = false) {
    if (state.isLoading) {
      return;
    }
    state.isLoading = true;
    listNode.innerHTML = buildCalendarSkeleton(8);
    countNode.textContent = 'Carregando...';
    metaNode.textContent = 'Buscando calendário na CorridasBR.';

    try {
      const params = new URLSearchParams({ state: state.selectedUf });
      if (forceRefresh) {
        params.set('refresh', '1');
      }
      const response = await fetch(`/api/calendar?${params.toString()}`);
      if (!response.ok) {
        throw new Error(`Não consegui carregar o calendário (HTTP ${response.status}).`);
      }

      const payload = await response.json();
      state.races = Array.isArray(payload.races) ? payload.races : [];
      refreshMonthOptions(state.races);
      renderCalendar(payload.fetched_at);
    } catch (error) {
      listNode.innerHTML = `<div class="calendar-empty">${escapeHtml(error.message)}</div>`;
      countNode.textContent = '0 provas';
      metaNode.textContent = 'Tenta novamente em alguns segundos.';
    } finally {
      state.isLoading = false;
    }
  }

  function refreshMonthOptions(races) {
    const available = new Set(races.map((race) => normalizeMonthLabel(race.month_label)).filter(Boolean));
    const previous = state.selectedMonth;
    const options = ['<option value="all">Todos os meses</option>'];

    MONTH_ORDER.forEach((month) => {
      if (available.has(month)) {
        options.push(`<option value="${month}">${capitalize(month)}</option>`);
      }
    });

    monthSelect.innerHTML = options.join('');
    if (previous && (previous === 'all' || available.has(previous))) {
      monthSelect.value = previous;
      state.selectedMonth = previous;
      return;
    }
    monthSelect.value = 'all';
    state.selectedMonth = 'all';
  }

  function renderCalendar(fetchedAt) {
    const filtered = state.races.filter((race) => {
      const month = normalizeMonthLabel(race.month_label);
      const byMonth = state.selectedMonth === 'all' || state.selectedMonth === month;
      if (!byMonth) {
        return false;
      }

      if (!state.searchTerm) {
        return true;
      }

      const searchBlob = `${race.race_name} ${race.city} ${race.distance}`.toLowerCase();
      return searchBlob.includes(state.searchTerm);
    });

    countNode.textContent = `${filtered.length} prova${filtered.length === 1 ? '' : 's'}`;
    metaNode.textContent = fetchedAt ? `Fonte: CorridasBR | atualizado em ${formatDate(fetchedAt)}` : 'Fonte: CorridasBR';

    if (!filtered.length) {
      listNode.innerHTML = '<div class="calendar-empty">Nenhuma prova com esse filtro. Ajusta e tenta de novo.</div>';
      return;
    }

    const grouped = MONTH_ORDER.map((month) => ({
      month,
      races: filtered.filter((race) => normalizeMonthLabel(race.month_label) === month)
    })).filter((entry) => entry.races.length);

    listNode.innerHTML = grouped
      .map((group) => {
        const cards = group.races
          .map(
            (race) => `
              <article class="race-card">
                <div class="race-card-top">
                  <div class="race-date-pill">${escapeHtml(race.date_display || '--.--')}</div>
                  <span class="race-distance-pill">${escapeHtml(race.distance || 'Distância não informada')}</span>
                </div>
                <h3>${escapeHtml(race.race_name || 'Corrida sem nome')}</h3>
                <p class="race-city">${escapeHtml(race.city || 'Cidade não informada')}</p>
                <div class="race-actions">
                  <button type="button" class="btn btn-secondary" data-race-details="${escapeHtml(race.id)}">Ver detalhes</button>
                  ${race.details_url ? `<a class="btn btn-primary" target="_blank" rel="noopener noreferrer" href="${escapeHtml(race.details_url)}">Abrir CorridasBR</a>` : ''}
                </div>
              </article>
            `
          )
          .join('');

        return `
          <section class="race-month-block">
            <div class="race-month-title">${capitalize(group.month)}</div>
            <div class="race-grid">${cards}</div>
          </section>
        `;
      })
      .join('');
  }

  loadStates().then(() => loadCalendar());
}

function setupPaceCalculator() {
  const form = document.getElementById('pace-form');
  if (!form) {
    return;
  }

  const modeButtons = Array.from(document.querySelectorAll('[data-pace-mode]'));
  const modeInput = document.getElementById('pace-mode');
  const byTimeFields = document.getElementById('pace-mode-time');
  const byPaceFields = document.getElementById('pace-mode-pace');
  const result = document.getElementById('pace-result');

  const setMode = (mode) => {
    modeInput.value = mode;
    modeButtons.forEach((btn) => btn.classList.toggle('active', btn.dataset.paceMode === mode));
    byTimeFields.hidden = mode !== 'discover';
    byPaceFields.hidden = mode === 'discover';
    result.innerHTML = '';
  };

  modeButtons.forEach((btn) => {
    btn.addEventListener('click', () => setMode(btn.dataset.paceMode));
  });

  setMode('discover');

  form.addEventListener('submit', (event) => {
    event.preventDefault();
    const mode = modeInput.value;

    if (mode === 'discover') {
      const rawTime = document.getElementById('pace-total-time').value;
      const distance = Number(document.getElementById('pace-distance').value);
      const totalSeconds = parseTimeToSeconds(rawTime);

      if (!totalSeconds || !distance) {
        result.innerHTML = renderAlert('Preencha tempo e distância corretamente para sair do achismo.', 'error');
        return;
      }

      const paceSeconds = totalSeconds / distance;
      result.innerHTML = `
        <h4>Resultado</h4>
        <p>Seu pace médio foi <strong>${formatPace(paceSeconds)} min/km</strong>. Sem negociação com o relógio.</p>
      `;
    } else {
      const rawPace = document.getElementById('target-pace').value;
      const distance = Number(document.getElementById('target-distance').value);
      const paceSeconds = parseTimeToSeconds(rawPace);

      if (!paceSeconds || !distance) {
        result.innerHTML = renderAlert('Coloca um pace válido (mm:ss) e distância. O resto eu faço.', 'error');
        return;
      }

      const totalTime = paceSeconds * distance;
      result.innerHTML = `
        <h4>Projeção</h4>
        <p>Com pace <strong>${rawPace} min/km</strong>, seu tempo estimado é <strong>${formatDuration(totalTime)}</strong>.</p>
      `;
    }
  });

  document.getElementById('pace-clear').addEventListener('click', () => {
    form.reset();
    setMode('discover');
  });
}

function setupRaceProjector() {
  const form = document.getElementById('race-form');
  if (!form) {
    return;
  }

  const distanceSelect = document.getElementById('race-distance');
  const note = document.getElementById('race-distance-note');
  const resultsNode = document.getElementById('race-results');
  const summaryNode = document.getElementById('race-summary');

  const updateDistanceNote = () => {
    const race = RACE_DISTANCES[distanceSelect.value];
    note.textContent = `${race.label}: ${race.swim}m natação | ${race.bike}km bike | ${race.run}km corrida.`;
  };

  distanceSelect.addEventListener('change', updateDistanceNote);
  updateDistanceNote();

  form.addEventListener('submit', (event) => {
    event.preventDefault();

    const race = RACE_DISTANCES[distanceSelect.value];
    const swimPace = parseTimeToSeconds(document.getElementById('swim-pace').value);
    const bikeSpeed = Number(document.getElementById('bike-speed').value);
    const runPace = parseTimeToSeconds(document.getElementById('run-pace').value);
    const t1 = Number(document.getElementById('t1-time').value) * 60;
    const t2 = Number(document.getElementById('t2-time').value) * 60;

    if (!swimPace || !bikeSpeed || !runPace || Number.isNaN(t1) || Number.isNaN(t2) || bikeSpeed <= 0) {
      summaryNode.innerHTML = renderAlert('Preencha todos os ritmos parciais para projetar sem ilusão.', 'error');
      return;
    }

    const swim = (race.swim / 100) * swimPace;
    const bike = (race.bike / bikeSpeed) * 3600;
    const run = race.run * runPace;
    const total = swim + t1 + bike + t2 + run;

    const segments = [
      ['Natação', swim],
      ['T1', t1],
      ['Ciclismo', bike],
      ['T2', t2],
      ['Corrida', run],
      ['Total', total]
    ];

    resultsNode.innerHTML = segments
      .map(
        ([label, seconds]) => `
          <div class="race-result">
            <strong>${label}</strong>
            <span>${formatDuration(seconds)}</span>
          </div>
        `
      )
      .join('');

    summaryNode.innerHTML = `
      <p><strong>Tempo final estimado:</strong> ${formatDuration(total)}.</p>
      <p class="small">Deu ruim? Ajusta as metas e volta pro treino. Deu bom? Executa o plano.</p>
    `;
  });
}

function setupPowerZones() {
  const form = document.getElementById('power-form');
  if (!form) {
    return;
  }

  const tbody = document.getElementById('zones-body');
  const feedback = document.getElementById('power-feedback');
  const copyButton = document.getElementById('copy-zones');
  const pdfButton = document.getElementById('pdf-zones');

  let lastZones = [];

  form.addEventListener('submit', (event) => {
    event.preventDefault();
    const ftp = Number(document.getElementById('ftp-value').value);

    if (!ftp || ftp < 50) {
      feedback.innerHTML = renderAlert('FTP inválido. Coloca um valor realista para gerar zonas úteis.', 'error');
      return;
    }

    lastZones = calculatePowerZones(ftp);

    tbody.innerHTML = lastZones
      .map((zone) => `<tr><td>${zone.name}</td><td>${zone.range}</td><td>${zone.focus}</td></tr>`)
      .join('');

    feedback.innerHTML = renderAlert('Zonas prontas. Agora é treinar na zona certa, não no ego.', 'success');
  });

  copyButton.addEventListener('click', async () => {
    if (!lastZones.length) {
      feedback.innerHTML = renderAlert('Gere as zonas antes de copiar.', 'error');
      return;
    }

    const text = lastZones.map((zone) => `${zone.name}: ${zone.range} (${zone.focus})`).join('\n');

    try {
      await navigator.clipboard.writeText(text);
      feedback.innerHTML = renderAlert('Tabela copiada para a área de transferência.', 'success');
    } catch (error) {
      feedback.innerHTML = renderAlert('Não consegui copiar automaticamente. Tenta novamente.', 'error');
    }
  });

  pdfButton.addEventListener('click', () => {
    if (!lastZones.length) {
      feedback.innerHTML = renderAlert('Gere as zonas antes de baixar o PDF.', 'error');
      return;
    }

    const lines = [
      'Zonas de Potência - O AMADOR',
      '--------------------------------',
      ...lastZones.map((zone) => `${zone.name}: ${zone.range} | ${zone.focus}`)
    ];

    if (createSimplePdf('zonas-potencia-o-amador.pdf', lines)) {
      feedback.innerHTML = renderAlert('PDF de zonas gerado com sucesso.', 'success');
    } else {
      feedback.innerHTML = renderAlert('Não foi possível gerar PDF neste navegador.', 'error');
    }
  });
}

function setupChecklist() {
  const container = document.getElementById('checklist-container');
  if (!container) {
    return;
  }

  const progress = document.getElementById('checklist-progress');
  const feedback = document.getElementById('checklist-feedback');
  const emailInput = document.getElementById('checklist-email');
  const state = JSON.parse(localStorage.getItem('oamador_checklist') || '{}');

  const render = () => {
    container.innerHTML = Object.entries(CHECKLIST_GROUPS)
      .map(([groupId, items]) => {
        const title = groupId.replace('_', ' ');
        const pretty = title.charAt(0).toUpperCase() + title.slice(1);
        const options = items
          .map((item, index) => {
            const key = `${groupId}_${index}`;
            const checked = Boolean(state[key]);
            return `
              <label class="checklist-item">
                <input type="checkbox" data-check-item="${key}" ${checked ? 'checked' : ''} />
                <span>${escapeHtml(item)}</span>
              </label>
            `;
          })
          .join('');

        return `
          <section class="checklist-col">
            <h4>${pretty}</h4>
            ${options}
          </section>
        `;
      })
      .join('');

    updateProgress();
  };

  const updateProgress = () => {
    const total = Object.values(CHECKLIST_GROUPS).reduce((sum, list) => sum + list.length, 0);
    const done = Object.keys(state).filter((key) => state[key]).length;
    progress.textContent = `${done}/${total} itens marcados.`;

    if (done === total && total > 0) {
      feedback.innerHTML = renderAlert('Checklist 100%: gordinho gostoso mode ON.', 'success');
    }
  };

  container.addEventListener('change', (event) => {
    const target = event.target;
    if (!(target instanceof HTMLInputElement) || !target.dataset.checkItem) {
      return;
    }

    state[target.dataset.checkItem] = target.checked;
    localStorage.setItem('oamador_checklist', JSON.stringify(state));
    updateProgress();
  });

  document.getElementById('check-all').addEventListener('click', () => {
    Object.entries(CHECKLIST_GROUPS).forEach(([groupId, items]) => {
      items.forEach((_, index) => {
        state[`${groupId}_${index}`] = true;
      });
    });
    localStorage.setItem('oamador_checklist', JSON.stringify(state));
    render();
  });

  document.getElementById('uncheck-all').addEventListener('click', () => {
    Object.keys(state).forEach((key) => {
      state[key] = false;
    });
    localStorage.setItem('oamador_checklist', JSON.stringify(state));
    render();
  });

  document.getElementById('send-checklist').addEventListener('click', () => {
    const email = emailInput.value.trim();
    if (!isValidEmail(email)) {
      feedback.innerHTML = renderAlert('Coloca um e-mail válido para enviar o checklist.', 'error');
      return;
    }

    const body = buildChecklistText(state);
    const subject = encodeURIComponent('Checklist de Prova - O AMADOR');
    const encodedBody = encodeURIComponent(body);
    window.location.href = `mailto:${encodeURIComponent(email)}?subject=${subject}&body=${encodedBody}`;
    feedback.innerHTML = renderAlert('Checklist aberto no seu cliente de e-mail.', 'success');
  });

  document.getElementById('pdf-checklist').addEventListener('click', () => {
    const lines = buildChecklistText(state).split('\n');
    if (createSimplePdf('checklist-prova-o-amador.pdf', lines)) {
      feedback.innerHTML = renderAlert('Checklist em PDF gerado.', 'success');
    } else {
      feedback.innerHTML = renderAlert('Não foi possível gerar PDF neste navegador.', 'error');
    }
  });

  render();
}

function calculatePowerZones(ftp) {
  const round = (value) => Math.round(value);
  return [
    { name: 'Z1 Recuperação', range: `0 - ${round(ftp * 0.55)} W`, focus: 'Recuperação ativa' },
    { name: 'Z2 Endurance', range: `${round(ftp * 0.56)} - ${round(ftp * 0.75)} W`, focus: 'Base aeróbia' },
    { name: 'Z3 Tempo', range: `${round(ftp * 0.76)} - ${round(ftp * 0.9)} W`, focus: 'Ritmo sustentado' },
    { name: 'Z4 Limiar', range: `${round(ftp * 0.91)} - ${round(ftp * 1.05)} W`, focus: 'Limiar funcional' },
    { name: 'Z5 VO2', range: `${round(ftp * 1.06)} - ${round(ftp * 1.2)} W`, focus: 'Capacidade aeróbia alta' },
    { name: 'Z6 Anaeróbio', range: `${round(ftp * 1.21)} - ${round(ftp * 1.5)} W`, focus: 'Potência de curta duração' },
    { name: 'Z7 Neuromuscular', range: `> ${round(ftp * 1.5)} W`, focus: 'Sprint explosivo' }
  ];
}

function createSimplePdf(fileName, lines) {
  if (!window.jspdf || !window.jspdf.jsPDF) {
    return false;
  }

  const doc = new window.jspdf.jsPDF({ unit: 'pt', format: 'a4' });
  let y = 52;

  lines.forEach((line) => {
    if (y > 780) {
      doc.addPage();
      y = 52;
    }
    doc.text(String(line), 40, y);
    y += 18;
  });

  doc.save(fileName);
  return true;
}

function buildChecklistText(state) {
  const lines = ['Checklist de prova - O AMADOR', ''];

  Object.entries(CHECKLIST_GROUPS).forEach(([groupId, items]) => {
    const title = groupId.replace('_', ' ').toUpperCase();
    lines.push(title);
    items.forEach((item, index) => {
      const key = `${groupId}_${index}`;
      const mark = state[key] ? '[x]' : '[ ]';
      lines.push(`${mark} ${item}`);
    });
    lines.push('');
  });

  lines.push('#pasteldeflango');
  return lines.join('\n');
}

function getTagValue(element, tags) {
  for (const tag of tags) {
    const localName = tag.includes(':') ? tag.split(':')[1] : tag;
    const found = element.getElementsByTagName(tag)[0] || element.getElementsByTagNameNS('*', localName)[0];
    if (found && found.textContent) {
      return found.textContent;
    }
  }
  return '';
}

function normalizeMonthLabel(value) {
  const text = String(value || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();
  if (text === 'marco') {
    return 'março';
  }
  return MONTH_ORDER.find((month) => month.normalize('NFD').replace(/[\u0300-\u036f]/g, '') === text) || '';
}

function capitalize(value) {
  const text = String(value || '');
  if (!text) {
    return '';
  }
  return text.charAt(0).toUpperCase() + text.slice(1);
}

function buildCalendarSkeleton(count = 6) {
  return Array.from({ length: count })
    .map(
      () => `
        <article class="race-card is-loading">
          <div class="race-card-top">
            <div class="race-date-pill">--.--</div>
            <span class="race-distance-pill">...</span>
          </div>
          <h3>Carregando prova</h3>
          <p class="race-city">Aguenta que já vem.</p>
          <div class="race-actions">
            <span class="btn btn-secondary">...</span>
          </div>
        </article>
      `
    )
    .join('');
}

function parseTimeToSeconds(value) {
  if (!value) {
    return null;
  }

  const parts = String(value)
    .trim()
    .split(':')
    .map((part) => Number(part));

  if (!parts.length || parts.some((part) => Number.isNaN(part) || part < 0)) {
    return null;
  }

  if (parts.length === 3) {
    return parts[0] * 3600 + parts[1] * 60 + parts[2];
  }

  if (parts.length === 2) {
    return parts[0] * 60 + parts[1];
  }

  return Number.isFinite(parts[0]) ? parts[0] : null;
}

function formatDuration(totalSeconds) {
  const seconds = Math.round(totalSeconds);
  const hh = Math.floor(seconds / 3600);
  const mm = Math.floor((seconds % 3600) / 60);
  const ss = seconds % 60;
  return `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}:${String(ss).padStart(2, '0')}`;
}

function formatPace(secondsPerKm) {
  const total = Math.round(secondsPerKm);
  const mm = Math.floor(total / 60);
  const ss = total % 60;
  return `${String(mm).padStart(2, '0')}:${String(ss).padStart(2, '0')}`;
}

function formatDate(dateString) {
  const date = new Date(dateString);
  if (Number.isNaN(date.getTime())) {
    return 'Atualizado agora';
  }
  return date.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' });
}

function isValidEmail(email) {
  return /^\S+@\S+\.\S+$/.test(email);
}

function renderAlert(message, type) {
  return `<div class="alert ${type}">${message}</div>`;
}

function escapeHtml(input) {
  return String(input)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
