/* De Olho no Carrinho — app Android.
   Roda antes do código do site: liga o modo app e entrega ao site um "claude.use" que fala com o Supabase
   (login por e-mail e senha, notas e configuração de cada pessoa). O site continua o mesmo código. */
window.APP = true;
(function () {
  var SB_URL = "https://mcunapjixjgvwlsdpcjo.supabase.co";
  var SB_KEY = "sb_publishable_GjNz-3rFxHtOK4DnlZ4o_A_TK7fIQFQ"; // chave pública: a segurança está nas regras do banco
  var K_SES = "sb_ses", K_UID = "app_uid";
  /* Páginas públicas do app (GitHub Pages): confirmação de e-mail, nova senha, privacidade e exclusão de conta. */
  var PAGINAS = "https://dionata2012-code.github.io/de-olho-no-carrinho-site";
  var SES = null;

  function lsGet(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }
  function lsSet(k, v) { try { localStorage.setItem(k, v); } catch (e) {} }
  function lsDel(k) { try { localStorage.removeItem(k); } catch (e) {} }
  try { SES = JSON.parse(lsGet(K_SES) || "null"); } catch (e) { SES = null; }
  if (SES && !(SES.user && SES.user.id && SES.refresh_token)) SES = null;
  window.APP_EMAIL = SES && SES.user ? SES.user.email : "";

  function guardar(s) {
    SES = { access_token: s.access_token, refresh_token: s.refresh_token, expires_at: s.expires_at || (Math.floor(Date.now() / 1000) + (s.expires_in || 3600)), user: { id: s.user.id, email: s.user.email } };
    lsSet(K_SES, JSON.stringify(SES));
    window.APP_EMAIL = SES.user.email;
  }
  function limparLocal() { ["mn_v3", "mn_cfg", "mn_del"].forEach(lsDel); }

  async function auth(path, body) {
    var r;
    try {
      r = await fetch(SB_URL + "/auth/v1/" + path, { method: "POST", headers: { apikey: SB_KEY, "Content-Type": "application/json" }, body: JSON.stringify(body) });
    } catch (e) { throw { code: "offline" }; }
    var j = {}; try { j = await r.json(); } catch (e) {}
    if (!r.ok) throw { code: "auth", status: r.status, msg: String(j.msg || j.error_description || j.message || j.error || ""), err: String(j.error_code || j.code || "") };
    return j;
  }
  var REFRESHING = null;
  async function renovar() {
    if (!SES) throw { code: "sem_sessao" };
    if (!REFRESHING) REFRESHING = auth("token?grant_type=refresh_token", { refresh_token: SES.refresh_token })
      .then(function (j) { guardar(j); REFRESHING = null; }, function (e) { REFRESHING = null; if (e.code === "auth" && (e.status === 400 || e.status === 401)) sair(true); throw e; });
    return REFRESHING;
  }
  async function token() {
    if (!SES) throw { code: "sem_sessao" };
    if (SES.expires_at * 1000 - Date.now() < 60000) await renovar();
    return SES.access_token;
  }
  /* Chamada ao banco. Erros viram os códigos que o site já entende: unavailable (tentar de novo) e invalid_argument (recusado). */
  async function rest(method, path, body, prefer, tentativa) {
    var t = await token(), r;
    try {
      r = await fetch(SB_URL + "/rest/v1/" + path, { method: method, headers: { apikey: SB_KEY, Authorization: "Bearer " + t, "Content-Type": "application/json", Prefer: prefer || "" }, body: body === undefined ? undefined : JSON.stringify(body) });
    } catch (e) { throw { code: "unavailable" }; }
    if (r.status === 401 && !tentativa) { await renovar(); return rest(method, path, body, prefer, 1); }
    if (r.status >= 500 || r.status === 429) throw { code: "unavailable" };
    if (!r.ok) throw { code: "invalid_argument", status: r.status };
    if (r.status === 204) return null;
    var tx = await r.text();
    return tx ? JSON.parse(tx) : null;
  }
  function idDe(path) { var p = String(path).split("/"); return p[p.length - 1]; }
  function enc(s) { return encodeURIComponent(s); }

  var db = {
    collection: function () {
      return {
        get: async function () {
          var r = await Promise.all([rest("GET", "notas?select=id,dados,upd"), rest("GET", "config?select=dados,upd")]);
          var docs = (r[0] || []).map(function (x) { return { id: x.id, data: function () { var d = Object.assign({}, x.dados); d.upd = +x.upd || +d.upd || 0; return d; } }; });
          if (r[1] && r[1][0]) { var c = r[1][0]; docs.push({ id: "cfg", data: function () { var d = Object.assign({}, c.dados); d.upd = +c.upd || +d.upd || 0; return d; } }); }
          return { docs: docs };
        }
      };
    },
    doc: function (path) {
      var id = idDe(path);
      return {
        set: function (obj) {
          if (id === "cfg") return rest("POST", "config?on_conflict=user_id", { dados: obj, upd: +obj.upd || 0 }, "resolution=merge-duplicates,return=minimal");
          return rest("POST", "notas?on_conflict=user_id,id", { id: id, dados: obj, upd: +obj.upd || 0 }, "resolution=merge-duplicates,return=minimal");
        },
        delete: function () { return id === "cfg" ? Promise.resolve() : rest("DELETE", "notas?id=eq." + enc(id), undefined, "return=minimal"); }
      };
    }
  };
  var ESPERA = null;
  var user = {
    id: function () { if (SES) return Promise.resolve(SES.user.id); mostrarLogin(); if (!ESPERA) ESPERA = new Promise(function () {}); return ESPERA; },
    isOwner: function () { return Promise.resolve(true); },
    can: function () { return Promise.resolve(true); }
  };
  var downloads = {
    save: function (o) {
      if (window.Android && Android.salvarArquivo) { Android.salvarArquivo(o.filename, String(o.data)); return Promise.resolve(); }
      var a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([o.data], { type: "text/csv" })); a.download = o.filename; document.body.appendChild(a); a.click(); a.remove(); return Promise.resolve();
    }
  };
  /* Notícias de preços (tabela "noticias"): todos com conta leem; só a tarefa semanal do Claude escreve. */
  window.appNoticias = function (desde) {
    return rest("GET", "noticias?select=semana,tipo,produto,palavras,excluir,tendencia,variacao,periodo,preco_atacado,unidade,motivo,fonte,url,data_fonte&semana=gte." + enc(desde) + "&order=semana.desc,id.asc&limit=300");
  };
  /* Versão mais nova do app (tabela pública app_versao): não precisa de login. */
  window.appUltimaVersao = async function () {
    var r = await fetch(SB_URL + "/rest/v1/app_versao?select=versao,codigo,mensagem,url&id=eq.1", { headers: { apikey: SB_KEY } });
    if (!r.ok) throw { code: "unavailable" };
    var j = await r.json(); return j && j[0] || null;
  };
  window.claude = { use: function (n) { return Promise.resolve({ db: db, user: user, downloads: downloads }[n] || null); } };

  function sair(expirou) {
    SES = null; lsDel(K_SES); lsDel(K_UID); limparLocal();
    if (expirou) lsSet("app_aviso", "Sua sessão expirou. Entre de novo.");
    location.reload();
  }
  window.appSair = function () { sair(false); };
  /* Excluir a conta: o banco apaga a pessoa e, junto, todas as notas e a configuração dela. */
  window.appExcluirConta = async function () {
    await rest("POST", "rpc/excluir_minha_conta", {});
    SES = null; lsDel(K_SES); lsDel(K_UID); limparLocal();
    try { localStorage.removeItem("mn_not"); localStorage.removeItem("mn_not_visto"); } catch (e) {}
    lsSet("app_aviso", "Sua conta e suas notas foram excluídas.");
    location.reload();
  };

  /* Tela de entrada: e-mail e senha. Criar conta, entrar e recuperar a senha na mesma tela. */
  var MODO = "entrar";
  function el(id) { return document.getElementById(id); }
  function telaHtml() {
    var aviso = lsGet("app_aviso") || ""; lsDel("app_aviso");
    return '<div class="login-in"><div class="brand" style="justify-content:center"><span class="tile">' + (document.querySelector(".tile") ? document.querySelector(".tile").innerHTML : "") + '</span><p class="wm"><small>De Olho no</small><span>Carrinho</span></p></div>' +
      '<p class="soft" style="text-align:center">Guarde suas notas de supermercado e veja onde cada produto sai mais barato.</p>' +
      '<div class="card">' + (MODO == "senha"
        ? '<h2 style="margin:0">Criar uma senha nova</h2><p class="soft">Digite o e-mail da sua conta. Vamos enviar um link para você criar uma senha nova.</p>'
        : '<div class="seg" role="group" aria-label="Entrar ou criar conta" style="grid-template-columns:1fr 1fr"><button type="button" id="lg_e" aria-pressed="' + (MODO == "entrar") + '">Entrar</button><button type="button" id="lg_c" aria-pressed="' + (MODO == "criar") + '">Criar conta</button></div>') +
      '<label class="f">E-mail<input type="text" id="lg_m" inputmode="email" autocomplete="email" autocapitalize="off" spellcheck="false"></label>' +
      (MODO == "senha" ? '' : '<label class="f">Senha' + (MODO == "criar" ? ' (pelo menos 6 letras ou números)' : '') + '<input type="password" id="lg_s" autocomplete="' + (MODO == "criar" ? "new-password" : "current-password") + '"></label>') +
      (MODO == "criar" ? '<label class="f">Repita a senha<input type="password" id="lg_s2" autocomplete="new-password"></label>' : '') +
      '<button type="button" class="btn" id="lg_ok">' + (MODO == "criar" ? "Criar conta" : MODO == "senha" ? "Enviar link" : "Entrar") + '</button>' +
      (MODO == "entrar" ? '<button type="button" class="link" id="lg_esq" style="align-self:center">Esqueci a senha</button>' : '') +
      (MODO == "senha" ? '<button type="button" class="link" id="lg_volta" style="align-self:center">Voltar para Entrar</button>' : '') +
      '<div id="lg_msg" role="status">' + (aviso ? '<div class="status warn">' + aviso + '</div>' : '') + '</div></div>' +
      '<p class="soft small" style="text-align:center">Suas notas ficam na sua conta e só você vê. <a href="' + PAGINAS + '/privacidade.html" style="color:var(--acc);font-weight:700">Política de privacidade</a></p></div>';
  }
  function msgLogin(t, k) { var e = el("lg_msg"); if (e) e.innerHTML = t ? '<div class="status ' + (k || "") + '">' + (k == "busy" ? '<span class="spin" aria-hidden="true"></span>' : '') + t + '</div>' : ""; }
  function traduz(e) {
    if (!e) return "Não deu certo. Tente de novo.";
    if (e.code === "offline") return "Sem internet. Confira a conexão e tente de novo.";
    var m = (e.msg + " " + e.err).toLowerCase();
    if (/invalid login|invalid_credentials/.test(m)) return "E-mail ou senha incorretos.";
    if (/already registered|already exists|user_already_exists/.test(m)) return "Este e-mail já tem conta. Toque em Entrar.";
    if (/not confirmed|email_not_confirmed/.test(m)) return "Falta confirmar o e-mail: abra o e-mail que você recebeu e toque no link. Depois volte e toque em Entrar.";
    if (/password/.test(m) && /(6|short|weak)/.test(m)) return "A senha precisa ter pelo menos 6 letras ou números.";
    if (/valid email|invalid.*email|email_address_invalid/.test(m)) return "Confira o e-mail digitado.";
    if (/not authorized|email_address_not_authorized/.test(m)) return "O app ainda não consegue enviar e-mails para este endereço. Tente de novo mais tarde.";
    if (/rate limit|over_email_send_rate_limit|too many/.test(m)) return "Muitas tentativas. Espere alguns minutos e tente de novo.";
    return "Não deu certo (" + (e.msg || e.status || "erro") + "). Tente de novo.";
  }
  async function enviar() {
    var m = (el("lg_m").value || "").trim().toLowerCase(), s = el("lg_s") ? el("lg_s").value || "" : "";
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(m)) { msgLogin("Digite um e-mail válido.", "warn"); return; }
    if (MODO == "senha") {
      el("lg_ok").setAttribute("aria-disabled", "true");
      msgLogin("Enviando…", "busy");
      try {
        await auth("recover?redirect_to=" + enc(PAGINAS + "/nova-senha.html"), { email: m });
        msgLogin("Se existir uma conta com esse e-mail, enviamos um link. Abra o e-mail, crie a senha nova e depois volte aqui para entrar. Confira também a caixa de spam.", "ok");
      } catch (e) { msgLogin(traduz(e), "warn"); }
      el("lg_ok").removeAttribute("aria-disabled");
      return;
    }
    if (s.length < 6) { msgLogin("A senha precisa ter pelo menos 6 letras ou números.", "warn"); return; }
    if (MODO == "criar" && s !== (el("lg_s2").value || "")) { msgLogin("As duas senhas não são iguais.", "warn"); return; }
    el("lg_ok").setAttribute("aria-disabled", "true");
    msgLogin(MODO == "criar" ? "Criando sua conta…" : "Entrando…", "busy");
    try {
      var j = MODO == "criar" ? await auth("signup?redirect_to=" + enc(PAGINAS + "/conta-confirmada.html"), { email: m, password: s }) : await auth("token?grant_type=password", { email: m, password: s });
      if (!j.access_token) { el("lg_ok").removeAttribute("aria-disabled"); MODO = "entrar"; desenhar(); el("lg_m").value = m; msgLogin("Conta criada. Abra o e-mail que você recebeu e toque no link para confirmar. Depois volte aqui e toque em Entrar.", "ok"); return; }
      var antes = lsGet(K_UID);
      guardar(j);
      if (antes !== SES.user.id) limparLocal();
      lsSet(K_UID, SES.user.id);
      msgLogin("Pronto! Abrindo…", "ok");
      location.reload();
    } catch (e) { el("lg_ok").removeAttribute("aria-disabled"); msgLogin(traduz(e), "warn"); }
  }
  function desenhar() {
    var t = el("login"); if (!t) return; t.innerHTML = telaHtml();
    if (el("lg_e")) el("lg_e").onclick = function () { MODO = "entrar"; desenhar(); };
    if (el("lg_c")) el("lg_c").onclick = function () { MODO = "criar"; desenhar(); };
    if (el("lg_esq")) el("lg_esq").onclick = function () { var v = el("lg_m").value; MODO = "senha"; desenhar(); el("lg_m").value = v; el("lg_m").focus(); };
    if (el("lg_volta")) el("lg_volta").onclick = function () { var v = el("lg_m").value; MODO = "entrar"; desenhar(); el("lg_m").value = v; };
    el("lg_ok").onclick = enviar;
    ["lg_m", "lg_s", "lg_s2"].forEach(function (k) { var x = el(k); if (x) x.addEventListener("keydown", function (ev) { if (ev.key == "Enter") { ev.preventDefault(); enviar(); } }); });
  }
  function mostrarLogin() {
    if (el("login")) return;
    var d = document.createElement("div"); d.id = "login"; d.className = "login"; document.body.appendChild(d);
    document.documentElement.classList.add("sem-login");
    desenhar();
  }
  window.appLogado = function () { return !!SES; };
})();
