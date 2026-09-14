/*
 * Módulo financeiro — Barbearia Cosmo
 * Inclua este arquivo APENAS na página do painel administrativo:
 * <script src="finance-module.js"></script>
 *
 * O valor oficial do relatório é exclusivamente o atendimento que foi
 * confirmado como concluído e pago. Agendamentos não entram no total.
 */
(function () {
  "use strict";

  const PRECO_LEGADO = {
    "Corte": 25, "Corte Simples": 25, "Corte Disfarçado": 35,
    "Corte Máq E Tes": 35, "Pigmentação": 20, "Reflexo": 55,
    "Descoloração": 70, "Camuflagem cabelo": 30, "Cavanhaque (a partir)": 10,
    "Barba Simples": 15, "Barba Modelada": 25, "Camuflagem barba": 20,
    "Barboterapia": 30, "Sobrancelha": 10, "Depilação nariz/orelha": 15,
    "Limpeza de pele": 30, "Corte + Sobrancelha": 40,
    "Corte Disfarçado + Barba": 50, "Corte + Pigmentação": 55,
    "Reflexo + Corte": 90, "Descoloração + Corte": 100,
    "Depilação nariz e orelha": 25, "Limpeza de pele + Depilação": 50,
    "Corte + barba + barboterapia": 75
  };

  const brl = cents => new Intl.NumberFormat("pt-BR", {
    style: "currency", currency: "BRL"
  }).format((Number(cents) || 0) / 100);

  function valorSugeridoCentavos(item) {
    if (Number.isInteger(item.valorCobradoCentavos)) return item.valorCobradoCentavos;
    if (Number(item.valorTotal) > 0) return Math.round(Number(item.valorTotal) * 100);
    if (Array.isArray(item.servicosLista)) {
      return Math.round(item.servicosLista.reduce((s, x) => s + (Number(x.preco) || 0), 0) * 100);
    }
    return Math.round((PRECO_LEGADO[item.servicos || item.servico] || 0) * 100);
  }

  function mesAtual() { return new Date().toISOString().slice(0, 7); }
  function esc(s) { const e = document.createElement("span"); e.textContent = s || ""; return e.innerHTML; }

  function instalar() {
    // No painel original, `db` foi declarado com `const`, portanto ele existe
    // para scripts seguintes, mas não como window.db.
    if (typeof db === "undefined" || document.getElementById("financeiroConfiavel")) return;
    const style = document.createElement("style");
    style.textContent = `#financeiroConfiavel{position:fixed;right:16px;bottom:16px;z-index:9999;background:#25D366;color:#071b0d;border:0;border-radius:12px;padding:13px 16px;font-weight:bold;cursor:pointer}#financeiroModal{display:none;position:fixed;inset:0;z-index:10000;background:#000b;overflow:auto;padding:22px}.fin-box{max-width:950px;margin:auto;background:#171717;color:#fff;border:1px solid #A67360;border-radius:15px;padding:20px}.fin-table{width:100%;border-collapse:collapse;margin-top:14px;font-size:13px}.fin-table th,.fin-table td{padding:8px;border-bottom:1px solid #444;text-align:left}.fin-table button{width:auto;margin:0;padding:7px 9px}.fin-total{padding:13px;background:#10291a;border-radius:10px;margin:12px 0;font-size:17px}`;
    document.head.appendChild(style);
    document.body.insertAdjacentHTML("beforeend", `
      <button id="financeiroConfiavel" style="display:none">💰 Financeiro confiável</button>
      <div id="financeiroModal"><div class="fin-box">
        <button id="finFechar" style="float:right;width:auto">Fechar</button>
        <h2>Faturamento bruto confirmado</h2>
        <p>Somente atendimentos concluídos e pagos entram no total.</p>
        <label>Mês: <input id="finMes" type="month"></label>
        <label style="margin-left:10px">Barbeiro: <select id="finBarbeiro"><option value="">Todos os barbeiros</option></select></label>
        <button id="finAtualizar" style="width:auto">Atualizar relatório</button>
        <div id="finConteudo"></div>
      </div></div>`);
    document.getElementById("finMes").value = mesAtual();
    document.getElementById("financeiroConfiavel").onclick = () => {
      document.getElementById("financeiroModal").style.display = "block";
      carregar();
    };
    document.getElementById("finFechar").onclick = () => document.getElementById("financeiroModal").style.display = "none";
    document.getElementById("finAtualizar").onclick = carregar;
    document.getElementById("finBarbeiro").onchange = carregar;
    document.getElementById("finConteudo").addEventListener("click", tratarAcao);
    document.addEventListener("financeiro:autorizar", () => {
      document.getElementById("financeiroConfiavel").style.display = "block";
    });
  }

  async function carregar() {
    const periodo = document.getElementById("finMes").value;
    if (!/^\d{4}-\d{2}$/.test(periodo)) return;
    const destino = document.getElementById("finConteudo");
    destino.innerHTML = "Carregando…";
    const snap = await db.collection("agenda").get();
    const atendimentos = [];
    snap.forEach(doc => {
      if (!doc.id.startsWith(periodo + "-")) return;
      Object.entries(doc.data()).forEach(([barbeiro, lista]) => {
        (Array.isArray(lista) ? lista : Object.values(lista || {})).forEach((item, indice) => {
          if (!item || typeof item === "string" || item.extra || item.nome === "Disponível") return;
          atendimentos.push({ data: doc.id, barbeiro, item, indice });
        });
      });
    });
    // Mantém a escolha ao atualizar e lista apenas o profissional selecionado.
    const seletor = document.getElementById("finBarbeiro");
    const escolhidoAntes = seletor.value;
    const barbeiros = [...new Set(atendimentos.map(a => a.barbeiro))].sort((a, b) => a.localeCompare(b));
    seletor.innerHTML = `<option value="">Todos os barbeiros</option>${barbeiros.map(nome => `<option value="${esc(nome)}">${esc(nome)}</option>`).join("")}`;
    seletor.value = barbeiros.includes(escolhidoAntes) ? escolhidoAntes : "";
    const atendimentosFiltrados = seletor.value
      ? atendimentos.filter(a => a.barbeiro === seletor.value)
      : atendimentos;
    const pagos = atendimentosFiltrados.filter(a => a.item.statusAtendimento === "concluido" && a.item.statusPagamento === "pago");
    const porBarbeiro = {};
    pagos.forEach(a => porBarbeiro[a.barbeiro] = (porBarbeiro[a.barbeiro] || 0) + a.item.valorCobradoCentavos);
    const total = Object.values(porBarbeiro).reduce((a, b) => a + b, 0);
    const linhasResumo = Object.keys(porBarbeiro).length
      ? Object.entries(porBarbeiro).map(([nome, valor]) => `<li>${esc(nome)}: <strong>${brl(valor)}</strong></li>`).join("")
      : "<li>Nenhum pagamento confirmado neste mês.</li>";
    const tituloFiltro = seletor.value ? ` — ${esc(seletor.value)}` : " — todos os barbeiros";
    const exibidos = [...atendimentosFiltrados].sort((a, b) => {
      const porData = b.data.localeCompare(a.data);
      if (porData) return porData;
      return String(b.item.horario || "").localeCompare(String(a.item.horario || ""));
    });
    destino.innerHTML = `<div class="fin-total"><strong>Total bruto pago${tituloFiltro}: ${brl(total)}</strong><ul>${linhasResumo}</ul></div>
      <p>“Agendado” e “pendente” não entram no resultado. Para registrar um corte, informe o valor efetivamente recebido.</p>
      <table class="fin-table"><thead><tr><th>Data</th><th>Barbeiro</th><th>Cliente</th><th>Valor</th><th>Situação</th><th></th></tr></thead><tbody>
      ${exibidos.map((a, i) => {
        const pago = a.item.statusAtendimento === "concluido" && a.item.statusPagamento === "pago";
        const situacao = pago ? "✅ Pago" : `${a.item.statusAtendimento || "agendado"} / ${a.item.statusPagamento || "sem confirmação"}`;
        return `<tr><td>${a.data}</td><td>${esc(a.barbeiro)}</td><td>${esc(a.item.nome)}</td><td>${pago ? brl(a.item.valorCobradoCentavos) : "—"}</td><td>${situacao}</td><td>${pago ? "" : `<button data-fin='${i}'>Confirmar pagamento</button>`}</td></tr>`;
      }).join("")}</tbody></table>`;
    window.__financeiroAtendimentos = exibidos;
  }

  async function tratarAcao(event) {
    const botao = event.target.closest("button[data-fin]");
    if (!botao) return;
    const a = window.__financeiroAtendimentos[Number(botao.dataset.fin)];
    const sugestao = (valorSugeridoCentavos(a.item) / 100).toFixed(2).replace(".", ",");
    const texto = prompt("Valor BRUTO realmente recebido (R$):", sugestao);
    if (texto === null) return;
    const normalizado = texto.trim().replace(/\./g, "").replace(",", ".");
    const cents = Math.round(Number(normalizado) * 100);
    if (!Number.isInteger(cents) || cents < 0) return alert("Informe um valor válido.");
    botao.disabled = true;
    await db.runTransaction(async tx => {
      const ref = db.collection("agenda").doc(a.data);
      const doc = await tx.get(ref);
      if (!doc.exists) throw new Error("Agendamento não encontrado.");
      const dados = doc.data();
      const lista = dados[a.barbeiro];
      const atual = lista[a.indice];
      if (!atual || atual.horario !== a.item.horario || atual.nome !== a.item.nome) throw new Error("A agenda mudou. Atualize o relatório.");
      lista[a.indice] = { ...atual, valorCobradoCentavos: cents, statusAtendimento: "concluido", statusPagamento: "pago", pagoEm: firebase.firestore.FieldValue.serverTimestamp() };
      tx.update(ref, { [a.barbeiro]: lista });
    });
    await carregar();
  }

  document.readyState === "loading" ? document.addEventListener("DOMContentLoaded", instalar) : instalar();
})();
