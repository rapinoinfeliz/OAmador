# O AMADOR - Site + API de Calendário de Corridas

Este projeto agora tem:
- site estático do canal `O AMADOR`
- API para consultar o calendário da CorridasBR por estado

## Rodar local

```bash
npm install
npm run dev
```

O mesmo servidor entrega site + API na mesma porta.
- Porta padrão: `8787`
- Se estiver ocupada, ele tenta automaticamente `8788`, `8789`, etc.
- Lista visual das corridas: `http://localhost:8787/calendario.html`

## Endpoints

### `GET /api/health`
Status da API.

### `GET /api/states`
Lista os estados disponíveis no menu da CorridasBR.

Query params:
- `refresh=1` força atualização (ignora cache em memória)

### `GET /api/calendar?state=SC`
Retorna o calendário do estado.

Query params:
- `state=SC` UF (2 letras)
- `details=1` inclui scraping de detalhes de cada corrida
- `limit=20` limita quantidade de corridas
- `refresh=1` força atualização

### `GET /api/race/SC/53035`
Retorna detalhes de uma corrida por UF + `id (escolha)`.

Query params:
- `refresh=1` força atualização

## Exemplos

```bash
curl 'http://localhost:8787/api/states'
curl 'http://localhost:8787/api/calendar?state=SC&limit=5'
curl 'http://localhost:8787/api/calendar?state=SC&details=1&limit=3'
curl 'http://localhost:8787/api/race/SC/53035'
```

## Observações

- A CorridasBR usa HTML legado e encoding `ISO-8859-1`.
- O parser tenta ser resiliente, mas pode exigir ajustes se o HTML de origem mudar.
- Sempre valide os dados críticos diretamente com a organização do evento.
- GitHub Pages hospeda apenas o site estático. Para rodar a API Node, publique em um serviço backend (Render, Railway, Fly.io, VPS etc).
