# Diretório externo de clientes

O Coevo Meet pode alimentar o campo **Cliente** do lobby a partir de uma API
externa. A sincronização roda no backend e salva uma cópia local dos clientes no
PostgreSQL.

## Variáveis no Railway

Configure estas variáveis no serviço da API:

```env
CLIENT_DIRECTORY_ENABLED=true
CLIENT_DIRECTORY_API_URL=https://seu-sistema.example.com/api/clientes
CLIENT_DIRECTORY_API_KEY=token-do-sistema-externo
CLIENT_DIRECTORY_AUTH_HEADER=Authorization
CLIENT_DIRECTORY_AUTH_SCHEME=Bearer
CLIENT_DIRECTORY_EXTERNAL_ID_FIELD=id
CLIENT_DIRECTORY_NAME_FIELD=name
CLIENT_DIRECTORY_ITEMS_PATH=
CLIENT_DIRECTORY_SYNC_ENABLED=true
CLIENT_DIRECTORY_SYNC_HOURS=6,14
CLIENT_DIRECTORY_SYNC_INTERVAL_SECONDS=300
```

Se a API externa retornar uma lista dentro de um objeto, use
`CLIENT_DIRECTORY_ITEMS_PATH`. Exemplos:

- resposta `{ "data": [{ "id": "1", "name": "ACME" }] }`:
  `CLIENT_DIRECTORY_ITEMS_PATH=data`
- resposta `{ "data": { "clients": [...] } }`:
  `CLIENT_DIRECTORY_ITEMS_PATH=data.clients`

## Segurança

- O token externo fica apenas no Railway, no serviço da API.
- O frontend nunca recebe `CLIENT_DIRECTORY_API_KEY`.
- O endpoint público `/clients` retorna somente `external_id` e `name`.
- O endpoint `/clients/sync` é protegido por `X-Agent-Api-Key`.

## Sincronização

A API roda uma sincronização automática nos horários definidos em
`CLIENT_DIRECTORY_SYNC_HOURS`, usando o fuso `America/Sao_Paulo`.

Também é possível forçar a sincronização manual:

```bash
curl -X POST "https://sua-api.railway.app/clients/sync" \
  -H "X-Agent-Api-Key: $AGENT_API_KEY"
```

Para uma garantia extra, é possível criar um Cron no Railway chamando esse mesmo
endpoint às 6h e 14h.
