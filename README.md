# Sanelis Medical EcoSystem

Sistema web para controle de estoque de clínica médica — controle para sua clínica, segurança para o paciente. Front-end Angular, API FastAPI e banco relacional.

## Funcionalidades incluídas

- Login com sessão segura (cookies HttpOnly + refresh rotacionado)
- Usuário administrador inicial (senha gerada no primeiro boot em dev)
- Cadastro de usuários e perfis
- Cadastro de fornecedores
- Cadastro de clientes com tipo: paciente, médico, setor interno, funcionário ou outro
- Cadastro de produtos com fornecedor e código de barras, tipo, estoque mínimo e alerta de vencimento
- Entrada de estoque informando lote (texto) e validade no momento da entrada, com código único por entrada (`ENT` + clínica + id, ex.: `ENT0100000042`)
- Etiqueta PDF com código de barras para impressão (`GET /entries/{id}/label.pdf` ou botão **Etiqueta** na tela Entradas)
- Mesmo produto, lote e validade somam estoque no mesmo registro de lote
- Saída por código de entrada ou seleção manual de produto/lote
- Baixa de produto vencido para reduzir estoque de lotes expirados
- Saída de estoque por lote e cliente
- Bloqueio de saída para lote vencido ou bloqueado
- Validação de estoque insuficiente
- Cancelamento de saída com devolução de estoque
- Log de auditoria com antes/depois
- Dashboard com alertas
- Relatórios em tela (HTML/tabela): produtos, estoque atual, vencimentos, saídas, fornecedores e clientes — com filtros e exportação PDF
- Estrutura com clinic_id preparada para múltiplas unidades no futuro
- Controle de perfis no front-end alinhado à API (menu, rotas e botões por papel)

## Perfis de acesso

O back-end valida cada operação; o front-end espelha as mesmas regras em [`frontend/src/app/core/role-permissions.ts`](frontend/src/app/core/role-permissions.ts).

| Perfil | Menu | Gravação / ações |
|--------|------|------------------|
| **Administrador** | Tudo | Tudo (inclui usuários, auditoria e cancelar qualquer saída) |
| **Estoque** | Tudo exceto Usuários e Auditoria | Cadastros, entradas, saídas, baixa de vencido, editar clientes |
| **Operacional** | Dashboard, Clientes, Saídas, Relatórios | Criar cliente; saída de consumo; cancelar **próprias** saídas |
| **Consulta** | Dashboard, Fornecedores, Clientes, Produtos, Relatórios | Somente leitura nos cadastros; sem Entradas/Saídas |

Rotas bloqueadas por perfil redirecionam para o Dashboard. Telas de cadastro para **Consulta** exibem apenas a tabela (sem formulário Salvar/Editar).

## Estrutura

```text
backend/   API em Python/FastAPI
frontend/  Aplicação Angular responsiva
```

## Como rodar o back-end

Entre na pasta do back-end:

```bash
cd backend
```

Crie o ambiente virtual:

```bash
python -m venv .venv
```

Ative o ambiente virtual no Windows:

```bash
.venv\Scripts\activate
```

Ou no Linux/Mac:

```bash
source .venv/bin/activate
```

Instale as dependências:

```bash
pip install -r requirements.txt
```

Copie o arquivo de ambiente:

```bash
copy .env.example .env
```

No Linux/Mac:

```bash
cp .env.example .env
```

Rode a API:

```bash
uvicorn app.main:app --reload
```

A API ficará em:

```text
http://localhost:8000
```

Documentação automática:

```text
http://localhost:8000/docs
```

## Usuário inicial

Em desenvolvimento, se `ADMIN_EMAIL` e `ADMIN_PASSWORD` estiverem vazios no `.env`, o backend cria `admin@localhost` com senha aleatória exibida **uma vez** no console ao iniciar.

Em produção, defina `ADMIN_EMAIL` e `ADMIN_PASSWORD` (mín. 8 caracteres, letras e números) nas variáveis de ambiente.

## Segurança

O sistema implementa proteções OWASP: autenticação cookie-only, CSRF, rate limiting, headers de segurança (CSP, HSTS), mascaramento de dados sensíveis em auditoria e fluxo de assinatura remota em duas etapas.

Auditoria de dependências:

```bash
scripts\security-audit.bat
```

## Como rodar o front-end

Entre na pasta do front-end:

```bash
cd frontend
```

Instale as dependências:

```bash
npm install
```

Rode o Angular:

```bash
npm start
```

Acesse:

```text
http://localhost:4200
```

## Banco de dados

Por padrão, o projeto usa SQLite local para facilitar teste:

```text
DATABASE_URL=sqlite:///./clinica_estoque.db
```

Para produção, use PostgreSQL:

```text
DATABASE_URL=postgresql://usuario:senha@host:5432/banco
```

## Observações importantes

Este pacote é uma versão inicial funcional/MVP. Para produção real, recomendo adicionar:

- Migrations com Alembic
- Testes automatizados
- Recuperação de senha
- Paginação e filtros avançados
- Backup automático
- Deploy com HTTPS
- Permissões granulares adicionais (ex.: desativar usuário pela API)
- Layout final homologado com a clínica
- Importação de planilha
