# Caderneta

O histórico de manutenção do carro, feito para o celular. Cada pessoa tem a própria conta e os próprios veículos — ninguém vê os dados de ninguém.

Roda na Vercel, com **Turso** (SQLite na nuvem) para os dados e **Vercel Blob** para as fotos dos comprovantes.

---

## 1. Criar o banco no Turso

Instale a CLI e crie o banco:

```bash
curl -sSfL https://tur.so/install.sh | bash
turso auth signup          # ou: turso auth login
turso db create caderneta
turso db show caderneta --url          # anote: libsql://caderneta-....turso.io
turso db tokens create caderneta       # anote o token
```

As tabelas são criadas sozinhas na primeira vez que a API é chamada — não precisa rodar migração.

## 2. Subir na Vercel

```bash
npm i -g vercel
vercel                 # a partir desta pasta; aceite os padrões
```

Na primeira pergunta sobre configuração, responda que **não** quer sobrescrever nada: o projeto já vem com `vercel.json`.

## 3. Criar a store de fotos

No painel da Vercel: **Storage → Create → Blob**, dê o nome `caderneta` e conecte ao projeto. A Vercel injeta a variável `BLOB_READ_WRITE_TOKEN` sozinha — você não precisa copiar nada.

## 4. Variáveis de ambiente

No painel: **Settings → Environment Variables** (marque Production, Preview e Development):

| Nome | Valor |
|---|---|
| `TURSO_DATABASE_URL` | a URL do passo 1 |
| `TURSO_AUTH_TOKEN` | o token do passo 1 |

Depois:

```bash
vercel --prod
```

## 5. Domínio

Em **Settings → Domains**, adicione o seu domínio ou subdomínio (ex.: `caderneta.seudominio.com.br`) e siga as instruções de DNS. O HTTPS a Vercel emite sozinha.

## 6. Primeiro acesso

Abra o site e crie a sua conta. **A primeira conta criada dispensa convite** — daí em diante, ninguém entra sem um código.

Para convidar alguém: **Ajustes → Convites → Gerar convite**. Cada código serve para uma pessoa só e vale 30 dias.

## 7. Trazer o seu histórico

No app antigo, em Ajustes, use *Exportar backup (JSON)*. Aqui, em **Ajustes → Importar backup**, cole o conteúdo. Veículos e lançamentos entram na sua conta com ids novos.

---

## Rodar na sua máquina

```bash
npm install
TURSO_DATABASE_URL="file:./caderneta-local.db" node dev.mjs
# abre em http://localhost:3000
```

Com um banco em arquivo, as fotos não funcionam localmente (o Blob precisa do token da Vercel); o resto funciona igual.

## Estrutura

```
public/index.html        o app inteiro (HTML, CSS e JS num arquivo só)
public/manifest.json     dados para instalar como app no celular
api/auth/*               criar conta, entrar, sair, sessão atual
api/invites.js           gerar e listar convites
api/vehicles/*           veículos
api/maintenances/*       lançamentos de manutenção
api/photos/[id].js       upload, leitura e remoção do comprovante
lib/db.js                conexão com o Turso e criação das tabelas
lib/auth.js              senha (scrypt), sessão em cookie e exigirUsuario()
lib/fotos.js             compressão aceita e armazenamento no Blob
dev.mjs                  servidor local que imita o roteamento da Vercel
```

## Como os dados ficam separados

Toda rota protegida começa por `exigirUsuario(req, res)` e **toda consulta filtra por `user_id`**, inclusive as de alterar e apagar. O id do usuário vem sempre da sessão, nunca de algo enviado pelo navegador. É esse filtro em toda consulta — nunca a confiança no que o navegador envia — que impede uma conta de enxergar, editar ou apagar algo de outra.

As fotos ficam no Blob com nome aleatório e **a URL nunca chega ao navegador**: o app pede `/api/photos/<id>`, a função confere a sessão e só então devolve a imagem.

## Responsabilidades

Guardando dados de outras pessoas, vale ter em mãos:

- **Senhas** são guardadas com scrypt e sal aleatório — nunca em texto puro.
- **Backup**: `turso db shell caderneta ".dump" > backup.sql` de tempos em tempos.
- **Apagar uma conta** a pedido: apague o usuário e as linhas dele.
  ```sql
  DELETE FROM maintenances WHERE user_id = '<id>';
  DELETE FROM vehicles     WHERE user_id = '<id>';
  DELETE FROM sessions     WHERE user_id = '<id>';
  DELETE FROM users        WHERE id = '<id>';
  ```
  As fotos dessa pessoa ficam no Blob; remova a pasta `comprovantes/<id>/` pelo painel.

## Custo

Turso e Vercel Blob têm faixa gratuita folgada para um grupo de amigos. O que cresce mais rápido é o Blob, por causa das fotos — cada comprovante ocupa poucas centenas de KB.
