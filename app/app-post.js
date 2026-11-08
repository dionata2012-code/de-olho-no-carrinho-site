/* De Olho no Carrinho — app Android: roda depois do código do site.
   Liga os botões que só existem no app (QR code pela câmera, portal da Fazenda dentro do app, planilha, sair)
   e recebe as respostas da parte Android (window.appQR, window.appPortal, window.appVoltar). */
(function () {
  /* No celular Android o leitor de PDF vem junto no app; na versão para iPhone (site instalável) vem da internet. */
  if (window.Android) { LIB.pdf = "lib/pdf.min.js"; LIB.pdfw = "lib/pdf.worker.min.js"; }
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
    appNoticias(isoDias(35)).then(function (r) {
      NTLOAD = false; NTERR = 0; NT = { t: Date.now(), rows: Array.isArray(r) ? r : [] }; lsS(K_NT, JSON.stringify(NT));
      if (V === "nt" || V === "m" || V === "pd" || V === "p") render();
    }, function () { NTLOAD = false; NTERR = Date.now(); if (V === "nt") render(); });
  }
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
        x.ps.slice(0, 3).forEach(function (g) { h += '<button type="button" class="row" data-act="prod" data-k="' + esc(g.k) + '"><span class="txt"><span class="t">' + esc(g.nm) + '</span><span class="soft small">Você pagou R$ ' + R2(g.last.pu) + ' em ' + dl(g.last.n.data) + ' · ' + esc(sn(g.last.s)) + '</span></span></button>'; });
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
  /* Aviso na tela inicial quando chegam notícias novas dos seus produtos. */
  var vm0 = vm;
  vm = function () {
    var h = vm0(), s = semanaAtual(); if (!s || !N.length) return h;
    var meus = linhas().filter(function (r) { return r.tipo === "produto" && seusProdutos(r).length; });
    if (!meus.length) return h;
    var novo = lsG(K_NTV) !== s, desce = meus.filter(function (r) { return r.tendencia === "desce"; }), sobe = meus.filter(function (r) { return r.tendencia === "sobe"; });
    var txt = (desce.length ? 'Tende a baixar: ' + desce.map(function (r) { return esc(r.produto); }).join(", ") + '. ' : '') + (sobe.length ? 'Tende a subir: ' + sobe.map(function (r) { return esc(r.produto); }).join(", ") + '. ' : '') + (!desce.length && !sobe.length ? 'Veja por que mudaram: ' + meus.slice(0, 4).map(function (r) { return esc(r.produto); }).join(", ") + '.' : '');
    var card = '<button type="button" class="row" data-act="tab" data-v="nt"' + (novo ? ' style="border-color:var(--acc)"' : '') + '><span class="txt"><span class="t">Notícias dos seus produtos' + (novo ? ' <span class="pill ok">novo</span>' : '') + '</span><span class="soft small">' + txt + '</span></span><span class="r" aria-hidden="true" style="font-size:22px">›</span></button>';
    var i = h.indexOf("</div>", h.indexOf('class="hero"'));
    if (h.indexOf('class="hero"') >= 0 && i >= 0) return h.slice(0, i + 6) + card + h.slice(i + 6);
    return card + h;
  };
  /* A aba Notícias não existe no site: desenha aqui e marca o botão da barra. */
  var render0 = render;
  render = function () {
    if (V === "nt") {
      comp();
      ["m", "n", "p", "l", "new"].forEach(function (x) { var e = document.getElementById("n_" + x); if (e) e.setAttribute("aria-pressed", "false"); });
      var a = document.getElementById("app"); if (a) a.innerHTML = vnt();
    } else render0();
    carregarNoticias(V === "nt" ? 30 * 60e3 : 3 * 3600e3);
    var b = document.getElementById("n_nt"); if (b) b.setAttribute("aria-pressed", String(V === "nt"));
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
    var h = vm1();
    if (NOVA && lsG(K_VF) !== String(NOVA.codigo)) {
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

