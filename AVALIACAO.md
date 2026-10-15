# Avaliação: GitHub Actions com IA

Aluno: Roger Costa Moreira · RA 2026109535 · Turma 2ESCN
Repositório: https://github.com/RogerMoreira-Dev/2bim-Avalia1
Site: https://2bim-avalia1-2q8.pages.dev

Workflows: `.github/workflows/ci.yml`, `.github/workflows/revisao-ia.yml` e `.github/workflows/migrar.yml`.

## Tarefa 1: CI a cada commit

- Execução verde: https://github.com/RogerMoreira-Dev/2bim-Avalia1/actions/runs/38733592095
- Execução vermelha (migração `0002` com erro de sintaxe proposital): https://github.com/RogerMoreira-Dev/2bim-Avalia1/actions/runs/38735596153
- Linha do log que mostra o erro, no passo "Aplica as migrações D1 em um SQLite local":

```
Parse error near line 1: near ";": syntax error
  ALTER TABLE notas ADD COLUMN turma TEXT DEFAULT;
                                    error here ---^
```

- A migração é testada em SQLite antes de chegar ao D1 porque o D1 usa o mesmo motor SQLite. Assim um erro de sintaxe aparece no PR, sem custo e sem risco, antes de ser aplicado no banco remoto, onde uma migração quebrada pode deixar o banco pela metade.
- Ajustes no esqueleto: a busca de segredos exclui o próprio `ci.yml`, porque ele contém o padrão `GOCSPX-` e acusava a si mesmo. O passo do SQLite instala o `sqlite3` se ele não estiver no runner.

## Tarefa 2: proteger a main com o CI

O ruleset `protege-main` exige pull request e o status check `verificar` aprovado.

- PR bloqueado e depois liberado: https://github.com/RogerMoreira-Dev/2bim-Avalia1/pull/10. O commit `7b0378c`, com erro, deixou o PR em `blocked`. O commit `a5a76c4` corrigiu e o PR ficou `clean`.
- Push direto na `main` recusado:

```
remote: - Changes must be made through a pull request.
remote: - Required status check "verificar" is expected.
To https://github.com/RogerMoreira-Dev/2bim-Avalia1
 ! [remote rejected] HEAD -> main (push declined due to repository rule violations)
error: failed to push some refs to 'https://github.com/RogerMoreira-Dev/2bim-Avalia1'
```

## Tarefa 3: revisão de PR por IA

- PR com o SQL vulnerável (`WHERE aluno = '${nome}'`): https://github.com/RogerMoreira-Dev/2bim-Avalia1/pull/11
  - 1º comentário da IA, que aponta a injeção de SQL e sugere `prepare(...).bind(nome)`: https://github.com/RogerMoreira-Dev/2bim-Avalia1/pull/11#issuecomment-6192193267
  - 2º comentário, depois da correção com `prepare("... WHERE aluno = ?").bind(nome)`, no evento `synchronize`: https://github.com/RogerMoreira-Dev/2bim-Avalia1/pull/11#issuecomment-6192208296
- Erro sem `pull-requests: write`: https://github.com/RogerMoreira-Dev/2bim-Avalia1/actions/runs/38736083117

```
Run gh pr comment 11 --body-file "/tmp/modelResponse--2131-Ty0jrDYetRoI-.txt"
GraphQL: Resource not accessible by integration (addComment)
Error: Process completed with exit code 1.
```

  Sem essa permissão, o `GITHUB_TOKEN` só consegue ler, e o `gh pr comment` é recusado. A permissão foi restaurada no commit seguinte.
- Ajuste no esqueleto: a `actions/ai-inference@v1` chama a API do GitHub Models e ignora o `COPILOT_GITHUB_TOKEN`, por isso falhava. A versão que usa o Copilot CLI, como o enunciado descreve, é a `@v3`. Também deixei o `model` vazio para o CLI escolher o modelo disponível no plano Copilot Free.

**Item 4: afirmações da IA erradas ou irrelevantes.** Na revisão do PR #9 (https://github.com/RogerMoreira-Dev/2bim-Avalia1/pull/9), a IA terminou a resposta com um menu "1. Corrigir os problemas de maior severidade / 2. Corrigir todos os problemas / 3. Registrar os achados em `SECURITY-REVIEW.md`". Isso não faz sentido num comentário automático, porque ninguém pode escolher uma opção ali. É um resto do formato de chat do Copilot CLI. No mesmo PR, ela classificou como "Alta" a interpolação de `github.base_ref` no script. O risco real é baixo: o branch de destino precisa existir no próprio repositório, e só quem tem permissão de escrita cria branches. No PR #11, ela tratou como problema "Alto" a falta de autenticação na rota de exemplo e, na última rodada, a resposta `200 []` quando falta o parâmetro `aluno`. São observações de projeto, fora do pedido (segredos, concatenação de SQL e erros de lógica do diff). Por isso a revisão da IA serve de apoio, mas cada item precisa ser conferido por uma pessoa.

## Tarefa 4: migrações D1 depois do merge

- Execução do `migrar` no merge do PR #10 (migração `0002_adiciona_coluna.sql`): https://github.com/RogerMoreira-Dev/2bim-Avalia1/actions/runs/38735758926
- Saída do `PRAGMA table_info(notas)` no D1 remoto (passo "Confere a tabela notas"), com a coluna nova:

```
Executing on remote database desenho-assinado-db (06dfb48a-5441-4a9d-ad6b-f3e79ed05c0b):
{ "cid": 0, "name": "id",    "type": "INTEGER", "notnull": 0, "dflt_value": null,      "pk": 1 }
{ "cid": 1, "name": "aluno", "type": "TEXT",    "notnull": 1, "dflt_value": null,      "pk": 0 }
{ "cid": 2, "name": "nota",  "type": "REAL",    "notnull": 1, "dflt_value": null,      "pk": 0 }
{ "cid": 3, "name": "turma", "type": "TEXT",    "notnull": 0, "dflt_value": "'2ESCN'", "pk": 0 }
```

- Merge que não toca `migrations/` (PR #11, commit `c332271`): disparou só o `ci` (https://github.com/RogerMoreira-Dev/2bim-Avalia1/actions/runs/38737156925). A lista do workflow `migrar` mostra apenas as duas execuções dos merges que alteraram `migrations/`: https://github.com/RogerMoreira-Dev/2bim-Avalia1/actions/workflows/migrar.yml

**Bônus:** o `migrar.yml` tem um passo com `actions/ai-inference` que resume as migrações e escreve o resumo em `$GITHUB_STEP_SUMMARY`. Ele aparece na página da execução acima, em "Resumo das migrações (IA)".

## Perguntas

1. **Por que o `ci.yml` roda duas vezes?** Ele tem dois gatilhos, `push` e `pull_request`. Um push numa ramificação com PR aberto dispara o evento `push` da ramificação e o evento `pull_request` (synchronize) do PR. O status check exigido pela `main` é o da execução `pull_request`, que roda sobre o merge da ramificação com a `main` e fica associada ao PR.
2. **Por que um PR de fork não usa `secrets.COPILOT_PAT`?** Num PR vindo de fork, o código do workflow e o diff são controlados por alguém de fora. Se o GitHub entregasse os segredos, bastaria abrir um PR que alterasse o workflow para imprimir ou enviar o token para fora. A regra impede o roubo de segredos (exfiltração de credenciais) por PRs de terceiros.
3. **Por que declarar `permissions`?** O `GITHUB_TOKEN` padrão pode ter permissões amplas, como escrita em conteúdo. Declarar só `contents: read` e `pull-requests: write` segue o princípio do menor privilégio: se o workflow for abusado, por exemplo por injeção no prompt, o token só consegue ler o código e comentar no PR. O teste do item 3 mostrou que, sem `pull-requests: write`, nem o comentário é permitido.
4. **A revisão da IA pode substituir o status check?** Não. O status check é determinístico: a migração aplica ou não aplica, o HTML valida ou não valida, e o resultado bloqueia o merge. A IA é probabilística, pode errar e pode ser manipulada pelo próprio diff. No item 4 da Tarefa 3, ela exagerou severidades, comentou coisas fora do pedido e deixou um menu de chat sem sentido. A resposta dela é só um comentário e serve de apoio à revisão humana, não de barreira.
