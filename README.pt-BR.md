# Agentes de frete Fairhaul

*Traduzido pelo Claude; revisão por falante nativo pendente. O [README](README.md) em inglês é a referência.*

Trinta pequenos agentes MCP para custos de frete e envio. Cada um cuida de **uma única tarefa**, como auditar uma fatura de frete, montar a provisão de frete do fechamento do mês, liquidar pagamentos a transportadoras ou conferir uma declaração aduaneira, e não consegue agir fora dela. Eles leem os arquivos que você já exporta do TMS, ERP, WMS, portais de transportadoras e provedor de EDI, gravam relatórios no seu computador e esperam uma pessoa nomeada antes de qualquer coisa que movimente dinheiro, envie uma mensagem ou altere um sistema em produção.

Licença MIT · Node 20 ou mais recente · apenas arquivos locais · sem credenciais · sem dependências

## Experimente

```bash
npx -y fairhaul-freight-bill-audit demo        # auditoria de faturas de frete com dados fictícios
npx -y fairhaul-freight-accruals demo     # provisão de frete com dados fictícios
```

Cada agente tem uma `demo` com arquivos fictícios, um `eval` com seus próprios casos de teste e um servidor MCP (`npx -y <agent> mcp --root <pasta>`) para Claude Desktop, Claude Code, Cursor e outros hosts MCP. Por enquanto, nomes de colunas e relatórios estão em inglês.

## Os agentes

**O que as transportadoras cobram:** `fairhaul-freight-bill-audit` (lotação e fracionado contra contratos), `fairhaul-parcel-refunds` (encomendas), `fairhaul-detention-and-lumper` (estadias e espera), `fairhaul-fuel-surcharges` (sobretaxas de combustível), `fairhaul-accessorial-charges` (origem dos serviços adicionais), `fairhaul-ltl-reweighs` (repesagens e mudanças de classe), `fairhaul-duplicate-payments` (pagamentos em dobro), `fairhaul-ocean-freight-audit` (marítimo), `fairhaul-air-freight-audit` (aéreo), `fairhaul-proof-of-delivery` (comprovantes de entrega), `fairhaul-container-demurrage` (free time de contêineres e demurrage), `fairhaul-customs-entries` (declarações aduaneiras contra faturas comerciais, sem orientação de classificação).

**Planejar, comprar e operar o frete:** `fairhaul-rfp-bid-scoring` (concorrências), `fairhaul-contract-rerating` (histórico recalculado em cada contrato), `fairhaul-spot-quotes` (cotações spot), `fairhaul-lane-spend` (gasto por rota e consolidação), `fairhaul-carrier-scorecards` (scorecards de transportadoras), `fairhaul-carrier-vetting` (sinais de fraude), `fairhaul-load-tracking` (cargas atrasadas), `fairhaul-dock-scheduling` (agendamento de docas), `fairhaul-carton-sizing` (tamanhos de caixa), `fairhaul-edi-files` (leitura e conciliação de arquivos X12).

**Fechamento e custos:** `fairhaul-freight-accruals` (provisão de frete), `fairhaul-freight-allocation` (rateio do frete por pedido e centro de custo), `fairhaul-standard-freight-cost` (padrões de frete no custo dos itens), `fairhaul-freight-margins` (frete cobrado contra frete real por cliente), `fairhaul-broker-settlements` (pagamento a transportadoras para corretores), `fairhaul-freight-claims` (reclamações por avaria), `fairhaul-returns-tracking` (devoluções até o crédito), `fairhaul-freight-emissions` (estimativas de emissões com os fatores que você escolher).

## Como eles se mantêm seguros

- **Lista permitida por agente.** Cada agente só pode chamar suas próprias ferramentas.
- **Ferramentas recusadas.** Pagar, enviar e-mails, alterar o TMS, lançar no razão ou registrar na aduana são nomeadas e bloqueadas.
- **Um clique nomeado.** Pagamentos, envios, mudanças em produção e aprovações de lançamentos esperam uma pessoa nomeada, mesmo no modo Auto, vinculados ao sha256 do rascunho revisado.
- **Log de auditoria** em `.fairhaul/`, encadeado por hash, assinado se você configurar uma chave Ed25519.
- **Parada de emergência:** `<agent> kill` para todas as ferramentas até `<agent> unkill`.

## Como eles são testados

Cada agente tem testes próprios das suas regras, os mesmos testes de contrato de todos os outros (argumentos, arquivos fora de `--root`, modo Revisão, parada de emergência, aprovação de rascunhos, resultados repetíveis) e de 14 a 22 casos de avaliação em arquivos fictícios. Cada caso com planilhas roda de novo como exportação alemã, francesa, espanhola, brasileira, italiana, japonesa, chinesa e coreana, e dados hostis são inseridos nos arquivos de cada agente. No total: 915 testes e 520 casos de avaliação, aprovados no Node 20, 22 e 24. [REVIEW-ver3.md](REVIEW-ver3.md) (em inglês) lista as mudanças da versão 2 e os bugs encontrados.

## Limites

- Cada agente trabalha apenas com os arquivos que você fornece e não faz login em nenhum sistema de transportadora, TMS, ERP, banco ou órgão público.
- Não é assessoria jurídica, tributária, aduaneira ou contábil. Pessoas decidem e agem.
