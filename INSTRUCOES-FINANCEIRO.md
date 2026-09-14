# Faturamento bruto confiável

O arquivo `finance-module.js` cria um relatório por mês com o valor bruto **recebido** por cada barbeiro. Ele não usa horário passado como prova de atendimento: só inclui itens que alguém confirmou como concluídos e pagos.

## 1. Adicione o módulo ao painel admin

Salve `finance-module.js` na mesma pasta do arquivo do painel administrativo. Antes de `</body>`, no painel admin, adicione:

```html
<script src="finance-module.js"></script>
```

Após abrir o painel haverá o botão **Financeiro confiável**. Selecione o mês, e ao final de cada corte clique em **Confirmar pagamento** e informe o valor efetivamente recebido. O relatório passa a somar esse valor por barbeiro.

## 2. Altere o salvamento de novos agendamentos

No arquivo de agendamento, localize o objeto que começa com `dados[profissional].push({` dentro da função `confirmarAgendamento`. Logo depois de `valorTotal: valorTotalServicos,`, adicione:

```js
valorAgendadoCentavos: Math.round(valorTotalServicos * 100),
statusAtendimento: "agendado",
statusPagamento: "pendente",
```

Novos agendamentos só aparecerão no faturamento depois da confirmação manual de pagamento.

## Regra de operação

- Cliente cancelou: o barbeiro remove o agendamento, como já faz hoje. Ele não entra no relatório.
- Corte concluído e recebido: registrar o valor real no botão **Confirmar pagamento**.
- Corte feito, mas ainda não pago: não confirmar; ele não entra no faturamento bruto pago.
- Não confirme automaticamente registros antigos. Para que o histórico seja confiável, confirme apenas os que puder validar.

O número para usar no repasse é **Total bruto pago**. Ele já vem agrupado por barbeiro e não mistura outros meses.
