/* De Olho no Carrinho — app Android: roda depois do código do site.
   Liga os botões que só existem no app (QR code pela câmera, portal da Fazenda dentro do app, planilha, sair)
   e recebe as respostas da parte Android (window.appQR, window.appPortal, window.appVoltar). */
(function () {
  /* No celular Android o leitor de PDF vem junto no app; na versão para iPhone (site instalável) vem da internet. */
  /* No Android e no iPhone, as peças de fora vêm junto com o app (pasta lib), conferidas pela impressão digital (LIBH). */
  if (window.Android || window.LIBS_LOCAIS) { LIB.pdf = "lib/pdf.min.js"; LIB.pdfw = "lib/pdf.worker.min.js"; LIB.qr = "lib/jsQR.js"; LIB.zx = "lib/zxing.min.js"; }
  var QRU = null; // {ck, url}: endereço lido do QR code, usado na consulta se for da Fazenda de MG
  function temPonte(f) { return !!(window.Android && typeof Android[f] === "function"); }

  window.appQR = function (t) {
    if (V !== "new" || !DR) return;
    if (!t) { msg("Leitura do QR code cancelada.", "warn"); return; }
    t = String(t).trim();
    var m = dig((t.match(/p=([\d|]+)/) || [])[1] || t), ch = "";
    for (var i = 0; i + 44 <= m.length; i++) { if (chaveOk(m.slice(i, i + 44))) { ch = m.slice(i, i + 44); break; } }
    if (!ch) { msg("Li o QR code, mas não encontrei uma chave de acesso válida nele. Digite a chave impressa na nota.", "warn"); return; }
    readForm(); DR.ck = ch; if (!DR.chave) DR.chave = ch;
    /* O QR code aponta para nfce.fazenda.mg.gov.br, que em https é o canal das empresas (pede certificado digital).
       A consulta de quem compra é a mesma página no portalsped, então troca o endereço e mantém os parâmetros do QR. */
    var mq = t.match(/^https?:\/\/(?:[a-z0-9-]+\.)*fazenda\.mg\.gov\.br(\/portalnfce\/sistema\/qrcode\.xhtml\?.+)$/i);
    QRU = mq ? { ck: ch, url: "https://portalsped.fazenda.mg.gov.br" + mq[1] } : null;
    render(); msg("QR code lido. Agora toque em Consultar no portal.", "ok");
  };
  /* Código de barras lido pelo leitor do Google (Android). */
  window.appCodigo = function (t) { if (t) bcAbrir(t); };
  window.appCodigoErro = function () { BC = { ean: "", cands: [], busy: false }; V = "bc"; render(); toast("Não consegui abrir o leitor. Digite os números do código."); };
  window.appQRerro = function () { if (V === "new") msg("Não consegui abrir o leitor de QR code neste celular. Digite a chave impressa na nota.", "warn"); };
  /* A tela do portal manda {a: texto como aparece na tela, b: texto de cada pedaço da página, u: endereço}.
     Tenta ler os produtos de cada um; se nenhum servir, guarda o texto na conta (CFG.diag) para análise. */
  window.appPortal = function (t) {
    if (V !== "new" || !DR) return;
    if (!t) { msg("Consulta no portal cancelada.", "warn"); return; }
    t = String(t);
    var o = null; try { o = JSON.parse(t); } catch (e) { o = null; }
    var cands = o && typeof o === "object" ? [o.b, o.a].filter(function (x) { return x && String(x).trim(); }) : [t];
    for (var i = 0; i < cands.length; i++) {
      var j = parsePortal(cands[i]);
      if (j && j.itens.length) { fromText(cands[i], "portal"); return; }
    }
    CFG.diag = { quando: new Date().toISOString(), url: o && o.u || "", a: String(o ? o.a || "" : t).slice(0, 20000), b: String(o ? o.b || "" : "").slice(0, 20000) };
    saveCfg();
    msg("Não consegui ler os produtos dessa página. Guardei o texto lido na sua conta para o Claude analisar. Enquanto isso, use o PDF da consulta ou digite os itens.", "warn");
  };
  window.appArquivo = function (r) { var e = document.getElementById("cm"); if (e) e.textContent = r === "ok" ? "Escolha onde salvar a planilha ou com quem compartilhar." : "Não consegui gerar a planilha."; };
  window.appVoltar = function () {
    if (document.getElementById("login")) return false;
    /* janela aberta por cima (orçamento, selo novo): o Voltar fecha a janela, sem trocar de tela */
    var jan = document.querySelector("#orcsh, #celeb, .sheet-bg");
    if (jan) { if (jan.id === "orcsh" && window.orcFecha) orcFecha(); else jan.remove(); return true; }
    if (window.navVoltar && navVoltar()) return true; // volta pelo caminho que a pessoa fez
    if (V === "pd" && PDRET === "ct") { go("ct"); window.scrollTo(0, CTY); return true; }
    if (V === "ct") { go("p"); return true; }
    if (V === "pd" || V === "cm" || V === "bc") { go("p"); return true; }
    if (V === "cmd") { go("cm"); return true; }
    if (V === "nd") { go("n"); return true; }
    if (V !== "m") { go("m"); return true; }
    return false;
  };

  document.addEventListener("click", function (ev) {
    var b = ev.target.closest("[data-act]"); if (!b) return;
    var a = b.getAttribute("data-act");
    if (a === "qrapp") {
      if (!temPonte("lerQR")) { msg("Leitor de QR code indisponível. Digite a chave impressa na nota.", "warn"); return; }
      readForm(); Android.lerQR();
    } else if (a === "portalapp") {
      var ck = DR && DR.ck || "";
      if (!chaveOk(ck)) { msg("Digite a chave de acesso ou leia o QR code primeiro.", "warn"); return; }
      if (!temPonte("abrirPortal")) { msg("O portal não abre aqui. Use o PDF da consulta ou cole o texto.", "warn"); return; }
      readForm();
      Android.abrirPortal(QRU && QRU.ck === ck ? QRU.url : PORTAL, ck);
      msg("Abrindo o portal da Fazenda…", "busy");
    } else if (a === "excluirconta") {
      if (document.getElementById("exc")) return;
      var box = document.createElement("div");
      box.className = "ed"; box.id = "exc";
      box.innerHTML = '<p><b>Excluir sua conta e todas as suas notas?</b> Tudo é apagado do servidor e não dá para desfazer. Se quiser guardar uma cópia, baixe a planilha antes.</p>' +
        '<label class="f">Digite EXCLUIR para confirmar<input type="text" id="exc_t" autocomplete="off" autocapitalize="characters" spellcheck="false"></label>' +
        '<div class="btns"><button type="button" class="btn danger solid" data-act="excluirok">Excluir para sempre</button><button type="button" class="btn line" data-act="excluircancel">Cancelar</button></div><div id="exc_m" role="status"></div>';
      b.insertAdjacentElement("afterend", box);
      document.getElementById("exc_t").focus();
    } else if (a === "excluircancel") {
      var bx = document.getElementById("exc"); if (bx) bx.remove();
    } else if (a === "excluirok") {
      var em = document.getElementById("exc_m"), tx = (document.getElementById("exc_t").value || "").trim().toUpperCase();
      if (tx !== "EXCLUIR") { em.innerHTML = '<div class="status warn">Digite a palavra EXCLUIR para confirmar.</div>'; return; }
      if (b.getAttribute("aria-disabled") === "true") return;
      b.setAttribute("aria-disabled", "true");
      em.innerHTML = '<div class="status"><span class="spin" aria-hidden="true"></span>Excluindo sua conta…</div>';
      window.appExcluirConta().catch(function (e) {
        b.removeAttribute("aria-disabled");
        em.innerHTML = '<div class="status warn">' + (e && e.code === "unavailable" ? "Sem conexão com o servidor. Confira a internet e tente de novo." : "Não deu para excluir agora. Tente de novo; se continuar, escreva para dionata2012@gmail.com.") + '</div>';
      });
    } else if (a === "sair") {
      if (b.getAttribute("data-ok") !== "1") { b.setAttribute("data-ok", "1"); b.textContent = "Toque de novo para sair"; return; }
      window.appSair();
    }
  });

  /* ---------- Notícias de preços ----------
     Toda segunda-feira a tarefa agendada do Claude lê boletins da Conab, da CeasaMinas e pesquisas de preço de BH
     e grava um resumo na tabela "noticias". Aqui o app mostra a aba Notícias, o quadro "Por que mudou" no produto
     e o selo "tende a baixar" na lista de produtos. Tudo que vem do banco é tratado como texto (escapado). */
  var NT = { t: 0, rows: [] }, NTLOAD = false, NTERR = 0, K_NT = "mn_not", K_NTV = "mn_not_visto";
  try { var c0 = JSON.parse(localStorage.getItem(K_NT) || "null"); if (c0 && Array.isArray(c0.rows)) NT = c0; } catch (e) {}
  function lsS(k, v) { try { localStorage.setItem(k, v); } catch (e) {} }
  function lsG(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }
  function isoDias(d) { var x = new Date(Date.now() - d * 864e5); return x.getFullYear() + "-" + ("0" + (x.getMonth() + 1)).slice(-2) + "-" + ("0" + x.getDate()).slice(-2); }
  /* Busca as notícias se as guardadas tiverem mais de "idade" ms. Depois de uma falha, espera 1 minuto (ou o botão Tentar de novo). */
  function carregarNoticias(idade, forcar) {
    if (NTLOAD || typeof window.appNoticias !== "function" || !(window.appLogado && appLogado())) return;
    if (!forcar && (Date.now() - (NT.t || 0) < idade || Date.now() - NTERR < 60e3)) return;
    NTLOAD = true;
    return appNoticias(isoDias(35)).then(function (r) {
      NTLOAD = false; NTERR = 0; NT = { t: Date.now(), rows: Array.isArray(r) ? r : [] }; lsS(K_NT, JSON.stringify(NT));
      if (V === "nt" || V === "m" || V === "pd" || V === "p") render();
    }, function () { NTLOAD = false; NTERR = Date.now(); if (V === "nt") render(); });
  }
  /* Para os avisos no celular: busca as notícias e diz quais são de produtos que a pessoa compra. */
  window.appNtCarregar = function () { return Promise.resolve(carregarNoticias(0, true)); };
  window.appNtMeus = function () {
    comp();
    return { semana: semanaAtual(), itens: linhas().filter(function (r) { return r.tipo === "produto"; }).map(function (r) { return { r: r, ps: seusProdutos(r) }; }).filter(function (x) { return x.ps.length; }) };
  };
  /* Só a semana mais recente vale. */
  function semanaAtual() { var s = ""; NT.rows.forEach(function (r) { if (r && r.semana > s) s = r.semana; }); return s; }
  function linhas() { var s = semanaAtual(); return NT.rows.filter(function (r) { return r && r.semana === s; }); }
  /* Palavras do nome, do mesmo jeito da comparação de marcas ("LTE L V" = "leite lv"). */
  function ntok(s) {
    var w = String(s || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").split(/[^a-z0-9]+/).filter(Boolean), o = [];
    for (var i = 0; i < w.length; i++) { var t = TN[w[i]] || w[i]; if (t === "l" && w[i + 1] === "v") { t = "lv"; i++; } o.push(t); }
    return o;
  }
  /* A notícia vale para o produto se o nome começa com uma das palavras e não tem nenhuma das palavras de exclusão. */
  function casaNome(r, nome) {
    var t = " " + ntok(nome).join(" ") + " ";
    var ok = (r.palavras || []).some(function (p) { var q = ntok(p).join(" "); return q && t.indexOf(" " + q + " ") === 0; });
    return ok && !(r.excluir || []).some(function (x) { var q = ntok(x).join(" "); return q && t.indexOf(" " + q + " ") >= 0; });
  }
  function casaGrupo(r, g) { if (!g || r.tipo !== "produto") return false; var ns = uniq([g.nm].concat(g.occ.map(function (o) { return o.it.n; }))); return ns.some(function (n) { return casaNome(r, n); }); }
  function noticiaDe(g) { return linhas().filter(function (r) { return casaGrupo(r, g); })[0] || null; }
  function selo(t) {
    return t === "desce" ? '<span class="pill ok">tende a baixar</span>' : t === "sobe" ? '<span class="pill warn">tende a subir</span>' : t === "estavel" ? '<span class="pill gray">estável</span>' : '<span class="pill gray">sem tendência clara</span>';
  }
  function pctTxt(v) { v = Number(v); if (!isFinite(v)) return ""; return (v > 0 ? "+" : v < 0 ? "−" : "") + Math.abs(v).toFixed(1).replace(".", ",") + "%"; }
  function urlOk(u) { return /^https:\/\/[^\s"'<>]+$/.test(String(u || "")) ? String(u) : ""; }
  function fonteHtml(r) {
    var u = urlOk(r.url), f = esc(r.fonte || "");
    return '<p class="soft small">Fonte: ' + (u ? '<a href="' + esc(u) + '" target="_blank" rel="noopener">' + f + '</a>' : f) + (r.data_fonte ? ' · ' + dl(String(r.data_fonte)) : '') + '</p>';
  }
  function corpo(r) {
    var h = '';
    if (r.variacao != null && r.variacao !== "") h += '<p class="small"><span class="vr ' + (Number(r.variacao) > 0 ? 'up' : 'down') + '">' + pctTxt(r.variacao) + '</span>' + (r.periodo ? ' · ' + esc(r.periodo) : '') + '</p>';
    h += '<p>' + esc(r.motivo || "") + '</p>';
    if (Number(r.preco_atacado) > 0) h += '<p class="soft small">Preço médio no atacado: R$ ' + R2(Number(r.preco_atacado)) + (r.unidade ? '/' + esc(r.unidade) : '') + (r.periodo ? ' (' + esc(r.periodo) + ')' : '') + '. No supermercado o preço é maior.</p>';
    return h + fonteHtml(r);
  }
  function seusProdutos(r) {
    return Object.keys(G).map(function (k) { return G[k]; }).filter(function (g) { return casaGrupo(r, g); })
      .sort(function (a, b) { return a.last.n.data < b.last.n.data ? 1 : -1; });
  }
  function vnt() {
    var L = linhas(), s = semanaAtual(), res = L.filter(function (r) { return r.tipo === "resumo"; })[0];
    var h = '<div class="card"><h2 style="margin:0">Por que os preços mudam</h2><p class="soft small">Resumo semanal feito pelo Claude com boletins da Conab, da CeasaMinas e pesquisas de preço de BH. ' + (s ? 'Semana de ' + dl(s) + '. ' : '') + 'A tendência é a dos boletins e não garante o preço no seu mercado.</p></div>';
    if (window.descLista) h = descLista() + h; /* Suas descobertas (uma por semana, das notas da pessoa) */
    if (!L.length) {
      if (NTLOAD) return h + '<div class="status"><span class="spin" aria-hidden="true"></span>Carregando notícias…</div>';
      return h + '<div class="card"><p class="soft">Ainda não há notícias aqui. Elas chegam toda segunda-feira de manhã. Confira se o celular está com internet.</p><button type="button" class="btn sm line" data-act="ntrec">Tentar de novo</button></div>';
    }
    lsS(K_NTV, s);
    if (res) h += '<div class="card nt"><h3 style="margin:0">Resumo da semana</h3>' + corpo(res) + '</div>';
    var P = L.filter(function (r) { return r.tipo === "produto"; }), meus = [], outros = [];
    P.forEach(function (r) { var ps = seusProdutos(r); if (ps.length) meus.push({ r: r, ps: ps }); else outros.push(r); });
    var ordem = { desce: 0, sobe: 1, estavel: 2, incerta: 3 };
    /* Primeiro as notícias dos produtos que mais pesam no seu bolso (gasto dos últimos 12 meses), calculado aqui no celular. */
    var cut12 = mesesAtras(12), gasto = function (x) { return x.ps.reduce(function (t, g) { return t + g.occ.reduce(function (u, o) { return u + (o.n.data >= cut12 ? num(o.it.t) : 0); }, 0); }, 0); };
    meus.forEach(function (x) { x.v = gasto(x); });
    meus.sort(function (a, b) { return b.v - a.v || (ordem[a.r.tendencia] || 3) - (ordem[b.r.tendencia] || 3); });
    if (meus.length) {
      h += '<h3>Nos produtos que você compra</h3><p class="soft small">Primeiro os que mais pesam no seu bolso.</p>';
      meus.forEach(function (x) {
        h += '<div class="card nt"><div class="row flat"><span class="t">' + esc(x.r.produto) + '</span>' + selo(x.r.tendencia) + '</div>' + corpo(x.r) + '<div class="list">';
        x.ps.slice(0, 3).forEach(function (g) { h += '<button type="button" class="row" data-act="prod" data-k="' + esc(g.k) + '"><span class="txt"><span class="t">' + esc(g.nv || g.nm) + '</span><span class="soft small">Você pagou R$ ' + R2(g.last.pu) + ' em ' + dl(g.last.n.data) + ' · ' + esc(sn(g.last.s)) + '</span></span></button>'; });
        h += '</div></div>';
      });
    }
    if (outros.length) {
      h += '<h3>Outros alimentos</h3>';
      outros.forEach(function (r) { h += '<div class="card nt"><div class="row flat"><span class="t">' + esc(r.produto) + '</span>' + selo(r.tendencia) + '</div>' + corpo(r) + '</div>'; });
    }
    return h;
  }
  /* Quadro "Por que mudou" na página do produto. */
  var vpd0 = vpd;
  vpd = function () {
    var h = vpd0(), g = G[PK], r = g ? noticiaDe(g) : null;
    if (!r) return h;
    var card = '<div class="card nt"><div class="row flat"><h3 style="margin:0">Por que mudou</h3>' + selo(r.tendencia) + '</div><p class="soft small">' + esc(r.produto) + ' · notícias da semana de ' + dl(r.semana) + '</p>' + corpo(r) + '<button type="button" class="link" data-act="tab" data-v="nt">Ver todas as notícias</button></div>';
    var i = h.indexOf('<div class="card"><h3 style="margin:0">Outras marcas</h3>');
    if (i < 0) i = h.indexOf('<h3>Histórico de compras</h3>');
    return i >= 0 ? h.slice(0, i) + card + h.slice(i) : h + card;
  };
  /* Selo "tende a baixar" na lista de produtos. */
  var pl0 = pl;
  pl = function () {
    var h = pl0(), L = linhas().filter(function (r) { return r.tipo === "produto" && r.tendencia === "desce"; });
    if (!L.length || h.indexOf('data-k="') < 0) return h;
    var d = document.createElement("div"); d.innerHTML = h;
    d.querySelectorAll('.row[data-k]').forEach(function (b) {
      var g = G[b.getAttribute("data-k")], t = b.querySelector(".txt");
      if (g && t && L.some(function (r) { return casaGrupo(r, g); })) t.insertAdjacentHTML("beforeend", '<span class="pill ok">tende a baixar</span>');
    });
    return d.innerHTML;
  };
  /* Novidade nas notícias: só o ponto laranja no ícone de jornal do topo (o quadro na aba Gastos saiu). */
  /* A aba Notícias não existe no site: desenha aqui e marca o botão da barra. */
  var render0 = render;
  render = function () {
    if (V === "nt") {
      comp();
      if (window.descNova && descNova()) { CFG.desc.nt = CFG.desc.h[0].id; saveCfg(); }
      ["m", "n", "p", "l", "new"].forEach(function (x) { var e = document.getElementById("n_" + x); if (e) e.setAttribute("aria-pressed", "false"); });
      var a = document.getElementById("app"); if (a) a.innerHTML = vnt();
    } else render0();
    carregarNoticias(V === "nt" ? 30 * 60e3 : 3 * 3600e3);
    var b = document.getElementById("n_nt");
    if (b) { b.setAttribute("aria-pressed", String(V === "nt")); var sw = semanaAtual(); b.classList.toggle("novo", V !== "nt" && ((!!sw && lsG(K_NTV) !== sw) || !!(window.descNova && descNova()))); }
    if (V === "nt" && window.cabecalho) cabecalho();
  };
  document.addEventListener("click", function (ev) { var b = ev.target.closest('[data-act="ntrec"]'); if (b) { carregarNoticias(0, true); render(); } });
  setTimeout(function () { carregarNoticias(3 * 3600e3); }, 1500);
  document.addEventListener("visibilitychange", function () { if (!document.hidden) carregarNoticias(3 * 3600e3); });
})();

/* ---------- Versão do app, sugestões e modo demonstração ---------- */
(function () {
  var VER = "", COD = 0, NOVA = null, K_VF = "mn_ver_fechado", DEMO = false;
  try { VER = window.Android && Android.versao ? String(Android.versao()) : ""; } catch (e) { VER = ""; }
  COD = parseInt(VER.split(".").pop(), 10) || 0;
  function lsG(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }
  function lsS(k, v) { try { localStorage.setItem(k, v); } catch (e) {} }

  /* Rodapé de "Seus dados": versão instalada e botão para mandar sugestão por e-mail. */
  window.appRodape = function () {
    var corpo = "Minha sugestão para o De Olho no Carrinho:\n\n\n\n(Versão do app: " + (VER || "?") + ")";
    var href = "mailto:dionata2012@gmail.com?subject=" + encodeURIComponent("Sugestão para o De Olho no Carrinho") + "&body=" + encodeURIComponent(corpo);
    return '<a class="btn line" href="' + esc(href) + '">Enviar sugestão ou problema</a>' + (VER ? '<p class="soft small" style="text-align:center">Versão do app: ' + esc(VER) + '</p>' : '');
  };

  /* Aviso de versão nova: compara a versão instalada com a da tabela app_versao. */
  function checarVersao() {
    if (!COD || !window.appUltimaVersao) return;
    appUltimaVersao().then(function (r) {
      if (r && +r.codigo > COD) { NOVA = r; if (V === "m") render(); }
    }, function () {});
  }
  var vm1 = vm;
  vm = function () {
    var temNova = !!(NOVA && lsG(K_VF) !== String(NOVA.codigo));
    window.AVISO_OCUPADO = temNova; /* com o aviso de versão nova, os outros avisos do topo esperam */
    var h = vm1();
    window.AVISO_OCUPADO = false;
    if (temNova) {
      var u = /^https:\/\//.test(NOVA.url || "") ? NOVA.url : "";
      h = '<div class="card" style="border-color:var(--acc)"><p><b>Saiu a versão ' + esc(NOVA.versao) + ' do app.</b> ' + (NOVA.mensagem ? esc(NOVA.mensagem) + ' ' : '') + (u ? '' : 'Peça o arquivo novo a quem te enviou o app.') + '</p>' +
        '<div class="btns">' + (u ? '<a class="btn sm" href="' + esc(u) + '">Baixar a versão nova</a>' : '') + '<button type="button" class="btn sm line" data-act="verfecha">Agora não</button></div></div>' + h;
    }
    return h;
  };

  /* Modo demonstração: notas de exemplo, de mercados fictícios, só na memória deste celular. Nada vai para a conta. */
  function dataMenos(d) { var x = new Date(Date.now() - d * 864e5); return x.getFullYear() + "-" + ("0" + (x.getMonth() + 1)).slice(-2) + "-" + ("0" + x.getDate()).slice(-2); }
  function notasDemo() {
    var lojas = [["MERCADO EXEMPLO CENTRO", .95], ["SUPERMERCADO MODELO BAIRRO", 1], ["SACOLAO FICTICIO", 1.06]];
    var P = [["ARROZ BRANCO TIPO 1 EXEMPLO 5KG", "UN", 1, 24.9], ["FEIJAO CARIOCA EXEMPLO 1KG", "UN", 2, 7.49], ["OLEO DE SOJA EXEMPLO 900ML", "UN", 1, 6.99],
      ["ACUCAR CRISTAL EXEMPLO 5KG", "UN", 1, 19.9], ["CAFE EXEMPLO 500G TRADICIONAL", "UN", 1, 18.9], ["LEITE LV EXEMPLO 1L INT", "UN", 6, 4.99],
      ["LEITE LV MODELO 1L INT", "UN", 6, 5.39], ["MAC OVOS EXEMPLO 500G ESPAGUETE", "UN", 2, 3.99], ["BANANA PRATA kg", "KG", 1.2, 5.99],
      ["TOMATE kg", "KG", .9, 6.49], ["BATATA kg", "KG", 1.5, 4.99], ["OVO BRANCO C/30 EXEMPLO", "UN", 1, 17.9],
      ["DET LIQ EXEMPLO 500ML NEUTRO", "UN", 2, 2.49], ["PAO FORMA EXEMPLO 400G", "UN", 1, 7.49]];
    var out = [], dias = [80, 52, 24, 3], k = 0;
    dias.forEach(function (d, di) {
      lojas.forEach(function (l, li) {
        if ((di + li) % 2) return; /* nem todo mercado em toda semana */
        var it = [];
        P.forEach(function (p, pi) {
          if ((pi + di + li) % 3 === 0 && pi > 4) return;
          var sobe = p[0] === "CAFE EXEMPLO 500G TRADICIONAL" && di === 3 ? 1.18 : 1 + di * .01; /* o café sobe na última compra: mostra um alerta */
          var pr = Math.round(p[3] * l[1] * sobe * (1 + ((pi * 7 + li * 3) % 5 - 2) / 100) * 100) / 100;
          it.push({ c: "", n: p[0], q: p[2], u: p[1], p: pr, t: Math.round(pr * p[2] * 100) / 100 });
        });
        var tt = Math.round(it.reduce(function (a, x) { return a + x.t; }, 0) * 100) / 100;
        out.push({ id: "demo" + (k++), demo: true, loja: l[0], cnpj: "", data: dataMenos(d + li), hora: "10:" + ("0" + (10 + li * 7)).slice(-2), chave: "", total: tt, itens: it, upd: 1 });
      });
    });
    return out;
  }
  function sairDemo() { DEMO = false; N = N.filter(function (n) { return !n.demo; }); sv(); }
  var persist0 = persist; persist = function (n, keep) { if (n && n.demo) { sv(); return; } return persist0(n, keep); };
  var unpersist0 = unpersist; unpersist = function (id) { if (/^demo\d+$/.test(String(id))) { sv(); return; } return unpersist0(id); };
  var saveCfg0 = saveCfg; saveCfg = function () { if (DEMO) return; return saveCfg0(); };

  var render1 = render;
  render = function () {
    if (DEMO && !N.some(function (n) { return n.demo; })) DEMO = false;
    render1();
    var a = document.getElementById("app");
    if (DEMO && a) a.insertAdjacentHTML("afterbegin", '<div class="status warn">Modo demonstração: são notas de exemplo, de mercados fictícios. Nada é salvo na sua conta. <button type="button" class="link" data-act="demosair">Sair do modo demonstração</button></div>');
  };

  /* Em captura: roda antes do clique do site (para sair do modo demonstração antes de abrir Nova nota). */
  document.addEventListener("click", function (ev) {
    var b = ev.target.closest("[data-act]"); if (!b) return;
    var a = b.getAttribute("data-act");
    if (a === "demo") { ev.stopPropagation(); DEMO = true; N = N.filter(function (n) { return !n.demo; }).concat(notasDemo()); go("m"); toast("Notas de exemplo carregadas. Explore as abas à vontade."); }
    else if (a === "demosair") { ev.stopPropagation(); sairDemo(); go("m"); toast("Modo demonstração encerrado."); }
    else if (a === "verfecha") { ev.stopPropagation(); if (NOVA) lsS(K_VF, String(NOVA.codigo)); render(); }
    else if (DEMO && a === "tab" && b.getAttribute("data-v") === "new") { sairDemo(); toast("Modo demonstração encerrado. Agora é a sua nota de verdade."); }
  }, true);

  checarVersao();
  /* Indicadores públicos (ex.: inflação oficial de alimentos no domicílio), para o quadro "Sua inflação no mercado". */
  try { var ic = JSON.parse(localStorage.getItem("mn_ind") || "null"); if (ic && ic.ipca_alim) window.IND = ic; } catch (e) {}
  if (window.appIndicadores) appIndicadores().then(function (L) {
    var o = {}; (L || []).forEach(function (r) { o[r.nome] = { valor: +r.valor, periodo: r.periodo, fonte: r.fonte }; });
    if (o.ipca_alim) { window.IND = o; lsS("mn_ind", JSON.stringify(o)); if (V === "m") render(); }
  }, function () {});
  document.addEventListener("visibilitychange", function () { if (!document.hidden && !NOVA) checarVersao(); });
  render();
})();


/* ---------- Grupo da família ----------
   Cada pessoa continua com a própria conta. O grupo divide só preços e produtos dos últimos 3 meses, sem mostrar quem comprou:
   o banco (funções familia_*) entrega os itens dos outros sem nome, nota ou total, e o site os usa como "mais barato do grupo"
   (FAM, em famAttach). Notas, gastos, orçamento e o que cada um compra junto continuam só com cada um. */
(function () {
  if (!window.appFamilia) return;
  var FI, FM = "", CONV = null, FMSG = null, BUSY = false, K = "mn_fam", T = 0;
  function lsG(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }
  function lsS(k, v) { try { localStorage.setItem(k, v); } catch (e) {} }
  function guardar() { lsS(K, JSON.stringify({ uid: appUid(), info: FI || null, rows: FAM, t: T })); }
  try {
    var c0 = JSON.parse(lsG(K) || "null");
    if (c0 && c0.uid && c0.uid === appUid()) { FI = c0.info; FAM = Array.isArray(c0.rows) ? c0.rows : []; T = +c0.t || 0; }
  } catch (e) {}
  function demo() { return N.some(function (n) { return n.demo; }); }
  function erroTxt(e, r) {
    var c = r && r.erro;
    if (c === "invalido") return "Código não encontrado ou vencido. Confira as letras ou peça um código novo.";
    if (c === "muitas") return "Muitos códigos errados seguidos. Espere uma hora e tente de novo.";
    if (c === "grupo_cheio") return "Esse grupo já tem 6 pessoas, o máximo.";
    if (c === "ja_no_grupo") return "Você já está num grupo. Saia dele antes de entrar em outro.";
    if (c === "nome_invalido") return "Preencha os nomes (até 30 letras).";
    if (e && e.code === "unavailable") return "Sem conexão com o servidor. Confira a internet e tente de novo.";
    return "Não deu certo agora. Tente de novo.";
  }
  function atualizar(forcar) {
    if (!appUid() || BUSY) return Promise.resolve();
    if (!forcar && Date.now() - T < 30 * 60e3) return Promise.resolve();
    return appFamilia.info().then(function (i) {
      FI = i || null;
      return FI ? appFamilia.precos() : [];
    }).then(function (rows) {
      FAM = Array.isArray(rows) ? rows : []; T = Date.now(); guardar(); if (V === "m" || V === "pd" || V === "l" || V === "cmd" || V === "cfg") render();
    }, function () { if (FI === undefined) { FI = null; if (V === "m" || V === "cfg") render(); } });
  }
  window.appFamAtualizar = function () { return atualizar(true); };
  function quando(iso) { var d = new Date(iso); if (isNaN(d)) return ""; return ("0" + d.getDate()).slice(-2) + "/" + ("0" + (d.getMonth() + 1)).slice(-2) + " às " + ("0" + d.getHours()).slice(-2) + ":" + ("0" + d.getMinutes()).slice(-2); }
  var PRIV = 'O grupo vê só o preço de cada produto por mercado e por semana, dos últimos 3 meses, sem saber quem comprou nem a quantidade. Suas notas, seus gastos e o que você compra junto continuam só com você.';
  function aviso2(n) { return n <= 2 ? '<p class="soft small">Num grupo de 2 pessoas, a outra pode deduzir que o preço é seu.</p>' : ''; }
  function msgHtml() { return FMSG ? '<div class="status' + (FMSG.k ? " " + FMSG.k : "") + '" role="status">' + esc(FMSG.t) + '</div>' : ''; }
  function card() {
    var h = '<div class="card" id="fam"><h3 style="margin:0">Família</h3>';
    if (demo()) return h + '<p class="soft">Saia do modo demonstração para usar o grupo da família.</p></div>';
    if (FI === undefined) return h + '<p class="soft">Carregando…</p></div>';
    if (!FI) {
      if (FM === "criar") {
        h += '<label class="f">Nome do grupo<input type="text" id="fm_g" maxlength="40" placeholder="Ex.: Família Silva" autocomplete="off"></label>' +
          '<label class="f">Seu nome no grupo<input type="text" id="fm_a" maxlength="30" placeholder="Como a família te conhece" autocomplete="off"></label>' +
          '<p class="soft small">' + PRIV + '</p><div class="btns"><button type="button" class="btn" data-act="famcriarok">Criar grupo</button><button type="button" class="btn line" data-act="famcancel">Cancelar</button></div>';
      } else if (FM === "entrar") {
        h += '<label class="f">Código de convite<input type="text" id="fm_c" maxlength="6" placeholder="6 letras e números" autocomplete="off" autocapitalize="characters" spellcheck="false" style="text-transform:uppercase;letter-spacing:2px"></label>' +
          '<label class="f">Seu nome no grupo<input type="text" id="fm_a" maxlength="30" placeholder="Como a família te conhece" autocomplete="off"></label>' +
          '<div class="btns"><button type="button" class="btn" data-act="famver">Continuar</button><button type="button" class="btn line" data-act="famcancel">Cancelar</button></div>';
      } else if (FM === "conv" && CONV) {
        var ms = CONV.membros || [];
        h += '<p>Grupo <b>' + esc(CONV.nome) + '</b>' + (ms.length ? ', com ' + esc(ms.join(", ")) : '') + '.</p><p class="soft small">' + PRIV + ' Você também passa a ver os preços do grupo.</p>' + aviso2(ms.length + 1) +
          (CONV.cheio ? '<div class="status warn">Esse grupo já tem 6 pessoas, o máximo.</div><div class="btns"><button type="button" class="btn line" data-act="famcancel">Voltar</button></div>'
            : '<div class="btns"><button type="button" class="btn" data-act="famentrarok">Entrar no grupo</button><button type="button" class="btn line" data-act="famcancel">Cancelar</button></div>');
      } else {
        h += '<p class="soft">Compare preços com a família: cada um continua com a própria conta, e o app mostra o que alguém do grupo pagou no mesmo produto, ou em produtos do mesmo tipo, e em qual mercado. ' + PRIV + '</p>' +
          '<div class="btns"><button type="button" class="btn line" data-act="famcriar">Criar grupo</button><button type="button" class="btn line" data-act="famentrar">Entrar com código</button></div>';
      }
      return h + msgHtml() + '</div>';
    }
    var M = FI.membros || [], adm = M.filter(function (m) { return m.admin; })[0], r = famResumo();
    h += '<p>Grupo <b>' + esc(FI.nome) + '</b></p><div class="list">';
    M.forEach(function (m) {
      h += '<div class="row flat"><span class="txt"><span class="t">' + esc(m.apelido) + (m.eu ? ' (você)' : '') + '</span>' + (m.admin ? '<span class="soft small">cuida do grupo</span>' : '') + '</span>' +
        (FI.admin && m.id ? '<button type="button" class="cbtn" data-act="famtira" data-id="' + esc(m.id) + '">Tirar</button>' : '') + '</div>';
    });
    h += '</div><p class="small">' + (r.precos ? 'A família trouxe <b>' + r.precos + ' preço' + (r.precos == 1 ? '' : 's') + '</b> em ' + r.produtos + ' produto' + (r.produtos == 1 ? '' : 's') + ' que você também compra. Eles aparecem como “mais barato do grupo”.' :
      M.length < 2 ? 'Convide alguém para começar a comparar.' : 'Ainda não há preços da família nos produtos que você compra. Eles aparecem quando alguém do grupo cadastra notas.') + '</p>';
    if (FI.codigo) {
      var txt = "Entre no meu grupo da família no De Olho no Carrinho: no app, toque no carrinho do topo, vá em Família, toque em Entrar com código e digite " + FI.codigo + " (vale até " + quando(FI.codigo_ate) + "). O grupo vê só os preços dos últimos 3 meses, sem saber quem comprou. Ainda não tem o app? " + "https://dionata2012-code.github.io/de-olho-no-carrinho-site/";
      h += '<p>Código de convite: <b style="font-size:20px;letter-spacing:3px">' + esc(FI.codigo) + '</b><br><span class="soft small">vale até ' + esc(quando(FI.codigo_ate)) + '</span></p>' +
        '<a class="btn line" href="https://wa.me/?text=' + encodeURIComponent(txt) + '">Mandar convite pelo WhatsApp</a>';
    }
    if (FI.admin) h += '<button type="button" class="btn line" data-act="famnovo">' + (FI.codigo ? 'Gerar código novo' : 'Gerar código de convite') + '</button>';
    else if (!FI.codigo) h += '<p class="soft small">Para convidar alguém, peça um código a ' + esc(adm ? adm.apelido : "quem cuida do grupo") + '.</p>';
    h += '<p class="soft small">' + PRIV + '</p>' + aviso2(M.length) + '<button type="button" class="btn line" data-act="famsair">Sair do grupo</button>';
    return h + msgHtml() + '</div>';
  }
  /* O quadro Família fica nas Configurações (toque no carrinho do topo). */
  window.appFamCard = function () { return card(); };
  window.appNoGrupo = function () { return !!FI; };
  function val(id) { var e = document.getElementById(id); return e ? e.value.replace(/\s+/g, " ").trim() : ""; }
  function rolar() { var c = document.getElementById("fam"); if (c && c.scrollIntoView) c.scrollIntoView({ block: "start" }); }
  function feito(i, t) { FI = i || null; FM = ""; CONV = null; FMSG = t ? { t: t, k: "ok" } : null; BUSY = false; T = 0; render(); rolar(); atualizar(true); }
  function falhou(e, r) { BUSY = false; FMSG = { t: erroTxt(e, r), k: "warn" }; render(); rolar(); }
  var APEL = "";
  document.addEventListener("click", function (ev) {
    var b = ev.target.closest("[data-act]"); if (!b) return;
    var a = b.getAttribute("data-act"); if (a.indexOf("fam") !== 0) return;
    if (BUSY) return;
    if (a === "famcriar" || a === "famentrar") { FM = a === "famcriar" ? "criar" : "entrar"; FMSG = null; render(); var f = document.getElementById(FM === "criar" ? "fm_g" : "fm_c"); if (f) f.focus(); }
    else if (a === "famcancel") { FM = ""; CONV = null; FMSG = null; render(); }
    else if (a === "famcriarok") {
      var g = val("fm_g"), ap = val("fm_a");
      if (!g || !ap) { FMSG = { t: "Preencha o nome do grupo e o seu nome.", k: "warn" }; render(); document.getElementById("fm_g").value = g; document.getElementById("fm_a").value = ap; return; }
      BUSY = true; appFamilia.criar(g, ap).then(function (i) { feito(i, "Grupo criado. Mande o código para a família."); }, function (e) { falhou(e); });
    } else if (a === "famver") {
      var c = val("fm_c").toUpperCase().replace(/[^A-Z0-9]/g, ""), ap2 = val("fm_a");
      if (c.length !== 6 || !ap2) { FMSG = { t: "Digite o código de 6 letras e números e o seu nome.", k: "warn" }; render(); document.getElementById("fm_c").value = c; document.getElementById("fm_a").value = ap2; return; }
      BUSY = true; APEL = ap2;
      appFamilia.convite(c).then(function (r) {
        BUSY = false; if (!r || r.erro) { falhou(null, r || { erro: "invalido" }); document.getElementById("fm_c").value = c; document.getElementById("fm_a").value = ap2; return; }
        CONV = r; CONV.codigo = c; FM = "conv"; FMSG = null; render(); rolar();
      }, function (e) { falhou(e); });
    } else if (a === "famentrarok" && CONV) {
      BUSY = true;
      appFamilia.entrar(CONV.codigo, APEL).then(function (r) { if (!r || r.erro) { FM = "entrar"; falhou(null, r || {}); return; } feito(r, "Você entrou no grupo " + r.nome + "."); }, function (e) { falhou(e); });
    } else if (a === "famnovo") {
      BUSY = true; appFamilia.novoConvite().then(function (i) { feito(i, "Código novo gerado. O anterior deixou de valer."); }, function (e) { falhou(e); });
    } else if (a === "famtira") {
      if (b.getAttribute("data-ok") !== "1") { b.setAttribute("data-ok", "1"); b.textContent = "Tirar mesmo?"; return; }
      BUSY = true; appFamilia.remover(b.getAttribute("data-id")).then(function (i) { feito(i, "Pessoa tirada do grupo. Os preços dela deixam de aparecer."); }, function (e) { falhou(e); });
    } else if (a === "famsair") {
      if (b.getAttribute("data-ok") !== "1") { b.setAttribute("data-ok", "1"); b.textContent = "Toque de novo para sair do grupo"; return; }
      BUSY = true; appFamilia.sair().then(function () { FAM = []; feito(null, "Você saiu do grupo. Seus preços deixaram de aparecer para a família."); }, function (e) { falhou(e); });
    }
  });
  (function primeiro() { if (!appUid()) { setTimeout(primeiro, 3000); return; } atualizar(FI === undefined || !T); })();
  document.addEventListener("visibilitychange", function () { if (!document.hidden) atualizar(false); });
})();


/* ---------- Avisos no celular (só no Android) ----------
   O próprio celular confere e avisa: uma vez na hora marcada, o Android abre o app escondido, o app olha as notas,
   as notícias e os preços do grupo e diz o que avisar. Nada sai do celular para isso, e não há serviço novo.
   Os avisos começam desligados; a pessoa liga cada um em Configurações. O que já foi avisado fica guardado
   neste celular (mn_av_env), para não repetir. */
(function () {
  if (!(window.Android && typeof Android.agendarAvisos === "function")) {
    /* iPhone: o app não manda avisos; um quadro curto explica, para ninguém ficar procurando. */
    var vc = vcfg;
    vcfg = function () {
      var h = vc(), i = h.indexOf('<div class="card"><h3 style="margin:0">Seus dados</h3>');
      var q = '<div class="card"><h3 style="margin:0">Avisos no celular</h3><p class="soft small">Por enquanto, os avisos (notícias da semana, o que pode estar acabando, preço mais barato no grupo e lembrete de nota) existem só no app Android. No iPhone o app não manda notificações.</p></div>';
      return i >= 0 ? h.slice(0, i) + q + h.slice(i) : h + q;
    };
    return;
  }
  var K_ENV = "mn_av_env", DIAS = ["domingo", "segunda", "terça", "quarta", "quinta", "sexta", "sábado"];
  var TIPOS = [
    { k: "nt", t: "Notícias da semana", d: "Na segunda de manhã, a tendência de preço dos produtos que você compra." },
    { k: "rp", t: "Pode estar acabando", d: "No dia e na hora que você escolher, o que pode estar acabando em casa." },
    { k: "fam", t: "Mais barato no grupo", d: "Quando alguém do grupo da família pagou menos num produto que você compra." },
    { k: "lb", t: "Lembrete de cadastrar nota", d: "Se passar 7 dias sem nota nova." }
  ];
  function lsG(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }
  function lsS(k, v) { try { localStorage.setItem(k, v); } catch (e) {} }
  function cfg() {
    var a = CFG.avisos && typeof CFG.avisos === "object" ? CFG.avisos : {};
    if (!(a.rpDia >= 0 && a.rpDia <= 6)) a.rpDia = 6;
    if (!/^\d{2}:\d{2}$/.test(a.rpHora || "")) a.rpHora = "09:00";
    return a;
  }
  function algum(a) { return TIPOS.some(function (x) { return a[x.k]; }); }
  function enviados() { try { return JSON.parse(lsG(K_ENV) || "{}") || {}; } catch (e) { return {}; } }
  function hm(t) { var p = String(t).split(":"); return [+p[0] || 0, +p[1] || 0]; }
  function hojeD() { var d = new Date(); return d.getFullYear() + "-" + ("0" + (d.getMonth() + 1)).slice(-2) + "-" + ("0" + d.getDate()).slice(-2); }
  /* Próxima vez (em milissegundos) em que o dia da semana "dia" (ou todo dia, se nulo) chega na hora "h:m". */
  function proxima(dia, h, m, agora) {
    var d = new Date(agora); d.setSeconds(0, 0); d.setHours(h, m);
    for (var i = 0; i < 8; i++) { if (d.getTime() > agora + 60e3 && (dia == null || d.getDay() === dia)) return d.getTime(); d.setDate(d.getDate() + 1); d.setHours(h, m); }
    return 0;
  }
  window.appAvisosProximo = function (agora) {
    agora = agora || Date.now();
    var a = cfg(), t = [];
    if (a.nt) t.push(proxima(1, 9, 0, agora));
    if (a.rp) { var r = hm(a.rpHora); t.push(proxima(a.rpDia, r[0], r[1], agora)); }
    if (a.fam || a.lb) t.push(proxima(null, 19, 0, agora));
    t = t.filter(function (x) { return x > 0; });
    return t.length ? Math.min.apply(null, t) : 0;
  };
  function agendar() { try { Android.agendarAvisos(JSON.stringify({ proximo: window.appAvisosProximo() })); } catch (e) {} }
  function lista(nomes) { var n = nomes.slice(0, 3).join(", "); return nomes.length > 3 ? n + " e mais " + (nomes.length - 3) : n; }
  function nomeG(g) { return g.nv || g.nm; }

  /* O que avisar agora. "agora" e "env" (o que já foi avisado) são parâmetros para os testes. */
  window.appAvisosCalc = function (agora, env) {
    agora = agora || Date.now(); env = env || enviados();
    var a = cfg(), out = [], d = new Date(agora), hoje = hojeD(), min = d.getHours() * 60 + d.getMinutes();
    comp();
    /* Notícias da semana: na segunda a partir das 9h (ou na primeira conferência depois), uma vez por semana. */
    if (a.nt && window.appNtMeus) {
      var nt = appNtMeus();
      if (nt.semana && env.nt !== nt.semana && nt.itens.length) {
        var t = { desce: "tende a baixar", sobe: "tende a subir", estavel: "estável" };
        var frases = nt.itens.map(function (x) { return x.r.produto + (t[x.r.tendencia] ? " " + t[x.r.tendencia] : ""); });
        out.push({ id: "nt", marca: nt.semana, titulo: "Notícias de preço da semana", texto: lista(frases) + ".", tela: "nt" });
      }
    }
    /* Pode estar acabando: no dia e hora escolhidos, uma vez por dia. */
    if (a.rp && d.getDay() === a.rpDia && min >= hm(a.rpHora)[0] * 60 + hm(a.rpHora)[1] && env.rp !== hoje && window.rpPend) {
      var P = rpPend();
      if (P.length) out.push({ id: "rp", marca: hoje, titulo: P.length == 1 ? "1 item pode estar acabando" : P.length + " itens podem estar acabando", texto: lista(P.map(function (e) { return nomeG(e.g); })) + ". Toque para revisar.", tela: "rp" });
    }
    /* Mais barato no grupo: preço do grupo das últimas 2 semanas pelo menos 3% abaixo do que você pagou da última vez. */
    if (a.fam) {
      var cut = new Date(agora - 14 * 864e5), cutS = cut.getFullYear() + "-" + ("0" + (cut.getMonth() + 1)).slice(-2) + "-" + ("0" + cut.getDate()).slice(-2), novos = [], marcas = {};
      Object.keys(G).forEach(function (k) {
        var g = G[k]; if (!g.fam || !g.last || !(g.last.pu > 0)) return;
        Object.keys(g.fam).forEach(function (st) {
          var f = g.fam[st]; if (!(f.p > 0) || f.d < cutS || f.p > g.last.pu * 0.97) return;
          var mk = k + "|" + st + "|" + f.p; marcas[mk] = 1;
          if (!(env.fam || {})[mk]) novos.push({ g: g, s: st, f: f });
        });
      });
      if (novos.length) {
        novos.sort(function (x, y) { return (x.f.p / x.g.last.pu) - (y.f.p / y.g.last.pu); });
        var b = novos[0];
        out.push({ id: "fam", marca: marcas, titulo: novos.length == 1 ? "Mais barato no grupo" : novos.length + " produtos mais baratos no grupo",
          texto: nomeG(b.g) + ": R$ " + R2(b.f.p) + " no " + sn(b.s) + " (você pagou R$ " + R2(b.g.last.pu) + ")" + (novos.length > 1 ? " e mais " + (novos.length - 1) : "") + ".", tela: "p" });
      }
    }
    /* Lembrete: 7 dias ou mais desde a última nota, uma vez para cada última nota. */
    if (a.lb && NM().length) {
      var ult = NM().reduce(function (x, n) { return n.data > x ? n.data : x; }, "");
      var dias = Math.floor((new Date(hoje + "T12:00").getTime() - new Date(ult + "T12:00").getTime()) / 864e5);
      if (dias >= 7 && env.lb !== ult) out.push({ id: "lb", marca: ult, titulo: "Fez compras esta semana?", texto: "Faz " + dias + " dias sem nota nova. Cadastre a nota para acompanhar seus preços.", tela: "new" });
    }
    return out;
  };
  /* Guarda o que foi avisado (o celular chama depois de mostrar). */
  function marcar(lista) {
    var env = enviados();
    lista.forEach(function (x) { env[x.id] = x.marca; });
    lsS(K_ENV, JSON.stringify(env));
  }

  /* Conferência escondida: o Android abre o app com ?avisos=1, espera os dados e recebe a lista. */
  if (/[?&]avisos=1/.test(location.search)) {
    var fim = false;
    var entregar = function () {
      if (fim) return; fim = true;
      var L = [];
      try { L = window.appAvisosCalc(); marcar(L); } catch (e) { L = []; }
      try { Android.avisosPronto(JSON.stringify({ lista: L.map(function (x) { return { id: x.id, titulo: x.titulo, texto: x.texto, tela: x.tela }; }), proximo: window.appAvisosProximo() })); } catch (e) {}
    };
    var a0 = cfg(), espera = [];
    var t0 = Date.now();
    var conta = new Promise(function (ok) { (function v() { if (window.DB || Date.now() - t0 > 20000) ok(); else setTimeout(v, 300); })(); });
    espera.push(conta);
    if (a0.nt && window.appNtCarregar) espera.push(conta.then(function () { return appNtCarregar(); }));
    if (a0.fam && window.appFamAtualizar) espera.push(conta.then(function () { return appFamAtualizar(); }));
    Promise.all(espera.map(function (p) { return p.catch(function () {}); })).then(entregar);
    setTimeout(entregar, 45000);
    return;
  }

  /* Abrir pela notificação: o Android chama com a tela do aviso. */
  window.appAbrirTela = function (t) {
    if (!t) return;
    if (t === "rp") { go("l"); var b = document.querySelector('[data-act="rpv"]'); if (b) b.click(); return; }
    go(t);
  };

  /* Configurações: um quadro com os quatro avisos. */
  var PERM = null;
  window.appAvisoPerm = function (ok) {
    PERM = !!ok;
    if (!ok && PERM_PEND) { var a = cfg(); a[PERM_PEND] = false; CFG.avisos = a; saveCfg(); toast("Sem permissão, o celular não mostra avisos. Dá para liberar nas configurações do Android."); }
    PERM_PEND = null; agendar(); if (V === "cfg") render();
  };
  var PERM_PEND = null;
  function quadro() {
    var a = cfg(), h = '<div class="card" id="avisos"><h3 style="margin:0">Avisos no celular</h3><p class="soft small">O próprio celular confere e avisa, sem serviço novo. Começam desligados: ligue só o que quiser.</p>';
    TIPOS.forEach(function (x) {
      h += '<button type="button" class="swl" role="switch" aria-checked="' + !!a[x.k] + '" data-act="avtg" data-k="' + x.k + '"><span><b>' + x.t + '</b><br><span class="soft small">' + x.d + '</span></span><span class="sw0" aria-hidden="true"><i></i></span></button>';
      if (x.k === "rp" && a.rp) {
        h += '<div class="row flat" style="gap:8px"><label class="f" style="flex:1">Dia<select id="av_dia" data-act="avdia">' + DIAS.map(function (n, i) { return '<option value="' + i + '"' + (i === a.rpDia ? ' selected' : '') + '>' + n + '</option>'; }).join("") + '</select></label>' +
          '<label class="f" style="flex:1">Hora<input type="time" id="av_hora" style="min-height:50px" value="' + esc(a.rpHora) + '"></label></div>';
      }
    });
    if (algum(a)) { var p = window.appAvisosProximo(); if (p) { var dd = new Date(p); h += '<p class="soft small">Próxima conferência: ' + DIAS[dd.getDay()] + ', ' + ("0" + dd.getHours()).slice(-2) + ':' + ("0" + dd.getMinutes()).slice(-2) + '. Notícias às 9h de segunda; grupo e lembrete às 19h.</p>'; } }
    return h + '</div>';
  }
  var vcfg0 = vcfg;
  vcfg = function () {
    var h = vcfg0(), i = h.indexOf('<div class="card"><h3 style="margin:0">Seus dados</h3>');
    return i >= 0 ? h.slice(0, i) + quadro() + h.slice(i) : h + quadro();
  };
  document.addEventListener("click", function (ev) {
    var b = ev.target.closest('[data-act="avtg"]'); if (!b) return;
    var k = b.getAttribute("data-k"), a = cfg(); a[k] = !a[k]; CFG.avisos = a; saveCfg();
    if (a[k]) { PERM_PEND = k; try { Android.pedirAvisos(); } catch (e) { PERM_PEND = null; } }
    agendar(); render();
  });
  document.addEventListener("change", function (ev) {
    var t = ev.target; if (!t || (t.id !== "av_dia" && t.id !== "av_hora")) return;
    var a = cfg();
    if (t.id === "av_dia") a.rpDia = +t.value;
    if (t.id === "av_hora" && /^\d{2}:\d{2}$/.test(t.value)) a.rpHora = t.value;
    CFG.avisos = a; saveCfg(); agendar(); render();
  });
  /* Toda vez que o app abre, reagenda (a configuração pode ter mudado em outro aparelho). */
  setTimeout(agendar, 3000);
})();


/* ---------- Registro de erros ----------
   Quando algo falha, o app manda para a conta do dono do app (Supabase) só: versão, Android ou iPhone, a tela, o tipo do erro
   e o lugar no código. Nunca nota, produto, CPF ou chave: qualquer sequência de 6 números ou mais vira #, e o texto é curto.
   Começa ligado; a pessoa desliga em Configurações (CFG.relatorio.off). No máximo 5 por vez que o app abre, sem repetir. */
(function () {
  var ENV = {}, N_ENV = 0, VER = "";
  try { VER = window.Android && Android.versao ? String(Android.versao()) : ""; } catch (e) { VER = ""; }
  if (!VER) { var sc = document.querySelector('script[src*="app-post.js?v="]'); VER = sc ? "web-" + sc.getAttribute("src").split("v=")[1] : "web"; }
  function ligado() { return !(CFG.relatorio && CFG.relatorio.off); }
  function limpa(t, n) { return String(t || "").replace(/\d{6,}/g, "#").replace(/\s+/g, " ").trim().slice(0, n); }
  function onde(arq, l, c) { var f = String(arq || "").split("?")[0].split("/").pop(); return limpa((f || "?") + ":" + (l || 0) + ":" + (c || 0), 80); }
  function enviar(tipo, lugar) {
    if (!ligado() || !window.appRegistrarErro || !(window.appLogado && appLogado()) || navigator.onLine === false) return;
    tipo = limpa(tipo, 200);
    if (!tipo || /^Script error\.?$|ResizeObserver loop/i.test(tipo)) return;
    var k = tipo + "|" + lugar; if (ENV[k] || N_ENV >= 5) return; ENV[k] = 1; N_ENV++;
    try { appRegistrarErro({ versao: VER, plataforma: window.Android ? "android" : "iphone", tela: String(window.V || ""), tipo: tipo, onde: lugar }).catch(function () {}); } catch (e) {}
  }
  window.appErroTeste = enviar; /* para os testes */
  window.addEventListener("error", function (ev) {
    if (!ev || ev.target !== window && ev.target && ev.target.tagName) return; /* falha de imagem ou script carregado: não é erro do app */
    enviar(String(ev.message || (ev.error && ev.error.name) || "").replace(/^Uncaught\s+/, ""), onde(ev.filename, ev.lineno, ev.colno));
  });
  window.addEventListener("unhandledrejection", function (ev) {
    var r = ev && ev.reason;
    if (r && (r.code === "unavailable" || r.code === "offline" || r.code === "timeout" || r.code === "sem_sessao" || r.name === "AbortError")) return; /* sem internet não é erro do app */
    var st = r && r.stack ? String(r.stack).split("\n")[1] || "" : "", m = st.match(/([^\/\s(]+\.(?:html|js))(?:\?[^:]*)?:(\d+):(\d+)/);
    enviar("Promessa: " + (r && (r.name ? r.name + ": " : "") + (r.message || r.code || "") || String(r)), m ? onde(m[1], m[2], m[3]) : "promessa");
  });
  /* Configurações: chave para desligar. */
  var vc = vcfg;
  vcfg = function () {
    var h = vc(), i = h.indexOf('<div class="card"><h3 style="margin:0">Seus dados</h3>');
    var q = '<div class="card"><h3 style="margin:0">Relatório de erros</h3><button type="button" class="swl" role="switch" aria-checked="' + ligado() + '" data-act="relatg"><span><b>Enviar relatório de erros</b><br><span class="soft small">Quando algo falha, o app manda só o tipo do erro, a tela e a versão, para ser corrigido. Nunca suas notas, produtos ou CPF.</span></span><span class="sw0" aria-hidden="true"><i></i></span></button></div>';
    return i >= 0 ? h.slice(0, i) + q + h.slice(i) : h + q;
  };
  document.addEventListener("click", function (ev) {
    if (!ev.target.closest('[data-act="relatg"]')) return;
    CFG.relatorio = CFG.relatorio || {}; if (ligado()) CFG.relatorio.off = 1; else delete CFG.relatorio.off;
    saveCfg(); render(); toast(ligado() ? "Relatório de erros ligado." : "Relatório de erros desligado.");
  });
})();


/* ---------- Códigos de barras compartilhados ----------
   Com a chave ligada (CFG.compart.on, começa desligada), o app manda para a base do app só os pares
   "código de barras -> nome do produto na nota": os códigos que vêm nas notas e os que a pessoa ligou à mão.
   Sem mercado, preço, data nem quem mandou. Quando alguém lê um código que não está nas notas dele, o app pergunta
   primeiro à base do app e depois às bases públicas (Open Food Facts...). Desligar apaga o que a pessoa mandou. */
(function () {
  if (!window.appCodigos) return;
  var K = "mn_cod_env", BUSY = false;
  function lsG(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }
  function lsS(k, v) { try { localStorage.setItem(k, v); } catch (e) {} }
  function ligado() { return !!(CFG.compart && CFG.compart.on); }
  function enviados() { try { var o = JSON.parse(lsG(K) || "null"); return o && o.uid === appUid() ? o : { uid: appUid(), k: {} }; } catch (e) { return { uid: appUid(), k: {} }; } }
  /* Pares código -> nome: das notas (bases "e:") e das ligações feitas à mão (CFG.cods). */
  window.appCodigosPares = function () {
    comp();
    var o = {};
    Object.keys(G).forEach(function (k) {
      var g = G[k]; if (g.v) return;
      Object.keys(g.bases).forEach(function (b) { if (b.indexOf("e:") === 0 && eanOk(b.slice(2))) o[b.slice(2)] = g.nm; });
    });
    Object.keys(CFG.cods || {}).forEach(function (e) {
      var b = CFG.cods[e], g = b && PAR[b] !== undefined ? G[fnd(b)] : null;
      if (g && eanOk(e) && !g.v) o[e] = g.nm;
    });
    return Object.keys(o).map(function (e) { return { e: e, n: String(o[e]).slice(0, 120) }; });
  };
  async function sincronizar() {
    if (BUSY || !ligado() || !(window.appLogado && appLogado()) || navigator.onLine === false) return 0;
    BUSY = true;
    var env = enviados(), novos = appCodigosPares().filter(function (x) { return env.k[x.e] !== x.n; }), total = 0;
    try {
      for (var i = 0; i < novos.length; i += 500) {
        var parte = novos.slice(i, i + 500);
        total += +(await appCodigos.enviar(parte)) || 0;
        parte.forEach(function (x) { env.k[x.e] = x.n; });
        lsS(K, JSON.stringify(env));
      }
    } catch (e) {}
    BUSY = false;
    return total;
  }
  window.appCodigosSincronizar = sincronizar;
  /* Leitura de código: primeiro a base do app, depois as bases públicas. */
  var bcNome0 = bcNome;
  bcNome = async function (e) {
    try {
      var r = await appCodigos.buscar(e);
      if (r && r.nome && BC && BC.ean === e) { BC.nome = String(r.nome); BC.cands = bcCands(BC.nome); BC.busy = false; if (V == "bc") render(); return; }
    } catch (x) {}
    if (BC && BC.ean === e) return bcNome0(e);
  };
  /* Configurações */
  var vc = vcfg;
  vcfg = function () {
    var h = vc(), i = h.indexOf('<div class="card"><h3 style="margin:0">Seus dados</h3>'), n = appCodigosPares().length;
    var q = '<div class="card"><h3 style="margin:0">Códigos de barras</h3><button type="button" class="swl" role="switch" aria-checked="' + ligado() + '" data-act="codtg"><span><b>Compartilhar meus códigos de barras</b><br><span class="soft small">Ajuda outras pessoas a achar o nome do produto pelo código. Vão só o código e o nome do produto na nota (' + n + ' agora), sem mercado, preço, data nem quem mandou. Desligar apaga o que você mandou.</span></span><span class="sw0" aria-hidden="true"><i></i></span></button></div>';
    return i >= 0 ? h.slice(0, i) + q + h.slice(i) : h + q;
  };
  document.addEventListener("click", function (ev) {
    if (!ev.target.closest('[data-act="codtg"]')) return;
    CFG.compart = CFG.compart || {};
    if (ligado()) {
      CFG.compart.on = 0; saveCfg(); render();
      appCodigos.apagar().then(function () { lsS(K, ""); toast("Desligado. O que você mandou foi apagado da base."); }, function () { toast("Sem conexão: tente desligar de novo com internet."); CFG.compart.on = 1; saveCfg(); render(); });
    } else {
      CFG.compart.on = 1; saveCfg(); render();
      sincronizar().then(function (t) { toast(t ? "Obrigado! " + t + " códigos compartilhados." : "Ligado. Os códigos vão assim que houver internet."); });
    }
  });
  setTimeout(sincronizar, 8000);
  document.addEventListener("visibilitychange", function () { if (!document.hidden) setTimeout(sincronizar, 3000); });
})();
