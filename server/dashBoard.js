// server/dashBoard.js
console.log("🚀 [Sistema] Inicializando o arquivo dashBoard.js...");

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import {
  getAuth,
  onAuthStateChanged,
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import {
  getFirestore,
  collection,
  addDoc,
  getDocs,
  serverTimestamp,
  doc,
  updateDoc,
  increment,
  getDoc,
  query,
  where,
  orderBy,
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

console.log("✅ [Firebase] Módulos importados com sucesso.");

const firebaseConfig = {
  apiKey: "AIzaSyC3BV2K0x4n0OOUfiFLBR6-fX-7DwGVSGA",
  authDomain: "espetos.firebaseapp.com",
  projectId: "espetos",
  storageBucket: "espetos.firebasestorage.app",
  messagingSenderId: "112705479220",
  appId: "1:112705479220:web:81741585cb73f919ede061",
};

console.log("🔌 [Firebase] Conectando ao projeto 'espetos'...");
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
console.log("🎮 [Firebase] Conexão estabelecida e instâncias prontas.");

// ==========================================
// 1. GUARDA DE ROTA: Autenticação
// ==========================================
onAuthStateChanged(auth, (user) => {
  console.log("🔐 [Autenticação] Verificando estado do usuário...");
  if (!user) {
    console.warn(
      "❌ [Autenticação] Usuário não logado! Redirecionando para index.html",
    );
    window.location.href = "index.html";
  } else {
    console.log(
      `✅ [Autenticação] Usuário logado com sucesso! UID: ${user.uid}`,
    );
    console.log("📥 [Inicialização] Disparando cargas iniciais de dados...");
    carregarProdutosNosSelects();
    carregarResumosDoDia();
    verificarEstoqueCritico();
    carregarRelatorioConsumoFuncionarios();
  }
});

// ==========================================
// 2. CADASTRO DE PRODUTOS
// ==========================================
const inputProd = document.getElementById("prod");
const inputCat = document.getElementById("cat");
const inputPrecoCusto = document.getElementById("precoCusto");
const inputPrecoVenda = document.getElementById("precoProduto");
const inputEstoqueInicial = document.getElementById("estoqueInicial");
const btnCadastrar = document.getElementById("btnCadastrarProduto");
const qrCodeInput = document.getElementById("qrCode");

if (btnCadastrar) {
  btnCadastrar.addEventListener("click", async () => {
    console.log("🖱️ [Clique] Botão 'Cadastrar Produto' acionado.");
    const nome = inputProd.value;
    const categoria = inputCat.value;
    const precoCusto = parseFloat(inputPrecoCusto.value);
    const precoVenda = parseFloat(inputPrecoVenda.value);
    const estoque = parseInt(inputEstoqueInicial.value);
    const qrCode = qrCodeInput.value;
    console.log(
      `📝 [Dados Capturados] Nome: ${nome}, Categoria: ${categoria}, Custo: ${precoCusto}, Venda: ${precoVenda}, Estoque: ${estoque}, QR Code: ${qrCode}`,
    );

    if (
      !nome ||
      !categoria ||
      isNaN(precoCusto) ||
      isNaN(precoVenda) ||
      isNaN(estoque) ||
      !qrCode
    ) {
      console.warn(
        "⚠️ [Validação] Falha: Campos obrigatórios vazios ou inválidos no cadastro.",
      );
      alert("Por favor, preencha todos os campos do cadastro corretamente!");
      return;
    }

    try {
      console.log(
        "📤 [Firestore] Enviando novo produto para a coleção 'produtos'...",
      );
      await addDoc(collection(db, "produtos"), {
        nome: nome,
        categoria: categoria,
        preco_custo: precoCusto,
        preco_venda: precoVenda,
        estoque: estoque,
        criado_em: serverTimestamp(),
        qr_code: qrCode,
      });

      console.log(
        `✅ [Firestore] Produto "${nome}" gravado com sucesso no banco.`,
      );
      alert(`Produto "${nome}" cadastrado com sucesso!`);

      inputProd.value = "";
      inputCat.value = "";
      inputPrecoCusto.value = "";
      inputPrecoVenda.value = "";
      inputEstoqueInicial.value = "";
      console.log("🧹 [Interface] Campos do formulário de cadastro limpos.");

      carregarProdutosNosSelects();
    } catch (error) {
      console.error("❌ [Erro Firestore] Falha ao cadastrar produto:", error);
      alert("Erro ao salvar o produto. Tente novamente.");
    }
  });
}

// ==========================================
// 3. ATUALIZAÇÃO DOS SELECTS
// ==========================================
async function carregarProdutosNosSelects() {
  console.log(
    "📥 [Dados] Buscando lista de produtos ativos para atualizar os selects...",
  );
  
  // Captura os elementos (alguns serão null dependendo da tela aberta)
  const selectEstoque = document.getElementById("nomeProduto");
  const selectVendas = document.getElementById("produto");
  const selectFunc = document.getElementById("produtoFunc");

  try {
    const querySnapshot = await getDocs(collection(db, "produtos"));
    console.log(
      `📊 [Dados] Total de documentos de produtos recebidos: ${querySnapshot.size}`,
    );

    // Inicializa os selects resgatando o valor padrão apenas se o elemento existir na tela atual
    if (selectEstoque) selectEstoque.innerHTML = '<option value="">Selecione o produto</option>';
    if (selectVendas) selectVendas.innerHTML = '<option value="">Selecione o produto</option>';
    if (selectFunc) selectFunc.innerHTML = '<option value="">Selecione o produto</option>';

    querySnapshot.forEach((doc) => {
      const produto = doc.data();
      const idProduto = doc.id;
      const optionHTML = `<option value="${idProduto}">${produto.nome} (Qtd: ${produto.estoque})</option>`;

      // Injeta a linha apenas nos elementos presentes no DOM da página aberta
      if (selectEstoque) selectEstoque.innerHTML += optionHTML;
      if (selectVendas) selectVendas.innerHTML += optionHTML;
      if (selectFunc) selectFunc.innerHTML += optionHTML;
    });
    
    console.log("✅ [Interface] Selects presentes na tela atualizados com sucesso.");
  } catch (error) {
    console.error(
      "❌ [Erro Firestore] Erro ao buscar produtos para selects: ",
      error,
    );
  }
}

// ==========================================
// 4. ENTRADA DE ESTOQUE
// ==========================================
const selectEstoque = document.getElementById("nomeProduto");
const inputQtdEntrada = document.getElementById("qtdEntrada");
const btnConfirmarEntrada = document.getElementById("btnConfirmarEntrada");

if (btnConfirmarEntrada) {
  btnConfirmarEntrada.addEventListener("click", async () => {
    console.log("🖱️ [Clique] Botão 'Confirmar Entradas' acionado.");
    const idProduto = selectEstoque.value;
    const quantidadeEntrada = parseInt(inputQtdEntrada.value);

    console.log(
      `📝 [Dados Capturados] ID Produto: ${idProduto}, Quantidade de Entrada: ${quantidadeEntrada}`,
    );

    if (!idProduto) {
      console.warn(
        "⚠️ [Validação] Falha: Nenhum produto selecionado para entrada de estoque.",
      );
      alert("Por favor, selecione um produto da lista.");
      return;
    }
    if (isNaN(quantidadeEntrada) || quantidadeEntrada <= 0) {
      console.warn(
        "⚠️ [Validação] Falha: Quantidade de entrada zerada ou inválida.",
      );
      alert("Por favor, digite uma quantidade válida maior que zero.");
      return;
    }

    try {
      const produtoRef = doc(db, "produtos", idProduto);
      console.log(
        `📤 [Firestore] Incrementando (+${quantidadeEntrada}) no estoque do documento: ${idProduto}`,
      );

      await updateDoc(produtoRef, {
        estoque: increment(quantidadeEntrada),
      });

      console.log(
        "✅ [Firestore] Estoque incrementado com sucesso no servidor.",
      );
      alert("Estoque atualizado com sucesso!");

      inputQtdEntrada.value = "";
      carregarProdutosNosSelects();
      verificarEstoqueCritico();
    } catch (error) {
      console.error("❌ [Erro Firestore] Falha ao atualizar estoque:", error);
      alert("Erro ao atualizar o estoque. Tente novamente.");
    }
  });
}

// ==========================================
// 5. FLUXO DE CONFIRMAR VENDA
// ==========================================
const selectVendaProduto = document.getElementById("produto");
const inputQtdVenda = document.getElementById("quantidade");
const btnConfirmarVenda = document.getElementById("btnConfirmarVenda");

if (btnConfirmarVenda) {
  btnConfirmarVenda.addEventListener("click", async () => {
    console.log("🖱️ [Clique] Botão 'Confirmar Venda' acionado.");
    const idProduto = selectVendaProduto.value;
    const quantidadeVendida = parseInt(inputQtdVenda.value);

    console.log(
      `📝 [Dados Capturados] Venda -> ID Produto: ${idProduto}, Qtd Vendida: ${quantidadeVendida}`,
    );

    if (!idProduto) {
      console.warn(
        "⚠️ [Validação] Falha: Nenhum produto selecionado para realizar venda.",
      );
      alert("Por favor, selecione o produto vendido.");
      return;
    }
    if (isNaN(quantidadeVendida) || quantidadeVendida <= 0) {
      console.warn(
        "⚠️ [Validação] Falha: Quantidade vendida nula ou inválida.",
      );
      alert("Por favor, insira uma quantidade válida.");
      return;
    }

    try {
      console.log(
        `📥 [Firestore] Verificando consistência e estoque do produto ${idProduto}...`,
      );
      const produtoRef = doc(db, "produtos", idProduto);
      const produtoSnap = await getDoc(produtoRef);

      if (!produtoSnap.exists()) {
        console.error(
          "❌ [Erro Regra] Produto selecionado não existe mais no banco de dados.",
        );
        alert("Produto não encontrado no banco de dados.");
        return;
      }

      const dadosProduto = produtoSnap.data();
      const estoqueAtual = dadosProduto.estoque;

      if (estoqueAtual < quantidadeVendida) {
        console.warn(
          `⚠️ [Estoque Insuficiente] Bloqueando venda. Requisitado: ${quantidadeVendida} | Disponível: ${estoqueAtual}`,
        );
        alert(
          `Estoque insuficiente! Você tem apenas ${estoqueAtual} unidades deste produto.`,
        );
        return;
      }

      const precoVendaMomento = dadosProduto.preco_venda;
      const precoCustoMomento = dadosProduto.preco_custo;

      const faturamentoTotalVenda = precoVendaMomento * quantidadeVendida;
      const custoTotalVenda = precoCustoMomento * quantidadeVendida;
      const lucroTotalVenda = faturamentoTotalVenda - custoTotalVenda;
      

      console.log(
        `🧮 [Cálculos Financeiros] Faturamento: R$${faturamentoTotalVenda} | Custo: R$${custoTotalVenda} | Lucro: R$${lucroTotalVenda}`,
      );

      console.log(
        "📤 [Firestore] Criando registro mestre na coleção 'vendas'...",
      );
      const novaVendaRef = await addDoc(collection(db, "vendas"), {
        faturamento_total: faturamentoTotalVenda,
        lucro_total: lucroTotalVenda,
        criado_em: serverTimestamp(),
      });

      console.log(
        `📤 [Firestore] Vinculando itens à subcoleção de vendas ID: ${novaVendaRef.id}`,
      );
      const subcolecaoItensRef = collection(
        db,
        "vendas",
        novaVendaRef.id,
        "itens",
      );
      await addDoc(subcolecaoItensRef, {
        produto_id: idProduto,
        quantidade: quantidadeVendida,
        preco_venda_momento: precoVendaMomento,
        preco_custo_momento: precoCustoMomento,
        categoria_momento: dadosProduto.categoria,
      });

      console.log(
        `📤 [Firestore] Baixando automaticamente (-${quantidadeVendida}) unidades do estoque do produto.`,
      );
      await updateDoc(produtoRef, {
        estoque: increment(-quantidadeVendida),
      });

      console.log(
        "✅ [Fluxo Completo] Venda gravada, subcoleção populada e estoque decrementado.",
      );
      alert("Venda realizada com sucesso e estoque updated!");

      inputQtdVenda.value = "";

      carregarProdutosNosSelects();
      carregarResumosDoDia();
      verificarEstoqueCritico();

      const btnDiarioRef = document.getElementById("btnRelatorioDiario");
      if (btnDiarioRef) gerarRelatorioPorPeriodo(0, btnDiarioRef);
    } catch (error) {
      console.error(
        "❌ [Erro Crítico Fluxo Venda] Falha no processamento:",
        error,
      );
      alert("Erro ao confirmar a venda. Tente novamente.");
    }
  });
}

// ==========================================
// 6. ABA DE RELATÓRIOS INTEGRADA (EM TELA) - REFATORADA (AGRUPADA)
// ==========================================
const txtFaturamentoRelatorio = document.getElementById("faturamentoRelatorio");
const txtLucroRelatorio = document.getElementById("lucroRelatorio");
const listaItensVendidos = document.getElementById("listaItensVendidos");

const btnDiario = document.getElementById("btnRelatorioDiario");
const btnSemanal = document.getElementById("btnRelatorioSemanal");
const btnMensal = document.getElementById("btnRelatorioMensal");

async function gerarRelatorioPorPeriodo(diasParaTratras, botaoAtivo) {
  console.log(
    `📊 [Relatório] Requisitando dados retroativos a ${diasParaTratras} dias.`,
  );
  try {
    [btnDiario, btnSemanal, btnMensal].forEach((btn) =>
      btn?.classList.remove("ativo"),
    );
    botaoAtivo?.classList.add("ativo");

    const dataLimite = new Date();
    dataLimite.setHours(0, 0, 0, 0);
    if (diasParaTratras > 0) {
      dataLimite.setDate(dataLimite.getDate() - diasParaTratras);
    }

    console.log(
      `🔍 [Relatório Query] Filtrando vendas com data de criação >= ${dataLimite.toISOString()}`,
    );
    const q = query(
      collection(db, "vendas"),
      where("criado_em", ">=", dataLimite),
    );
    const vendasSnapshot = await getDocs(q);

    console.log(
      `📊 [Relatório Query] Quantidade de vendas mestre encontradas: ${vendasSnapshot.size}`,
    );

    let faturamentoAcumulado = 0;
    let lucroAcumulado = 0;
    
    // Lista temporária na memória para guardar todos os sub-itens antes do agrupamento
    const todosOsItensBrutos = [];

    // Passo 1: Coleta dos dados transacionais do banco
    for (const docVenda of vendasSnapshot.docs) {
      const dadosVenda = docVenda.data();

      faturamentoAcumulado += dadosVenda.faturamento_total || 0;
      lucroAcumulado += dadosVenda.lucro_total || 0;

      const itensSnapshot = await getDocs(
        collection(db, "vendas", docVenda.id, "itens"),
      );

      itensSnapshot.forEach((docItem) => {
        todosOsItensBrutos.push(docItem.data());
      });
    }

    // Passo 2: Aplicação do algoritmo de redução (Agrupamento por Categoria/Nome)
    const itensAgrupados = todosOsItensBrutos.reduce((acumulador, itemAtual) => {
      // Usamos a categoria ou o ID do produto como chave única do agrupamento
      const chave = itemAtual.categoria_momento || "Geral";
      const quantidadeItem = Number(itemAtual.quantidade) || 0;
      const faturamentoItem = (Number(itemAtual.preco_venda_momento) || 0) * quantidadeItem;
      const custoItem = (Number(itemAtual.preco_custo_momento) || 0) * quantidadeItem;
      const lucroItem = faturamentoItem - custoItem;

      if (!acumulador[chave]) {
        acumulador[chave] = {
          categoria: chave,
          quantidade_total: 0,
          faturamento_total: 0,
          lucro_total: 0
        };
      }

      acumulador[chave].quantidade_total += quantidadeItem;
      acumulador[chave].faturamento_total += faturamentoItem;
      acumulador[chave].lucro_total += lucroItem;

      return acumulador;
    }, {});

    // Passo 3: Renderização controlada da Interface
    if (listaItensVendidos) listaItensVendidos.innerHTML = "";
    const listaFinalParaTela = Object.values(itensAgrupados);

    listaFinalParaTela.forEach((item) => {
      if (listaItensVendidos) {
        listaItensVendidos.innerHTML += `
          <div class="item-vendido-card" style="background: #2a2a2a; padding: 12px; margin-bottom: 10px; border-left: 4px solid #ff9800; border-radius: 6px; text-align: left;">
              <strong>${item.categoria}</strong> — <strong style="color: #ff9800; font-size: 16px;">${item.quantidade_total}x</strong> un.<br>
              <span style="font-size: 13px; color: #2196f3;">Venda: R$ ${item.faturamento_total.toFixed(2)}</span> | 
              <span style="font-size: 13px; color: #4caf50; font-weight: bold;">Lucro: R$ ${item.lucro_total.toFixed(2)}</span>
          </div>
        `;
      }
    });

    if (txtFaturamentoRelatorio)
      txtFaturamentoRelatorio.innerText = `R$ ${faturamentoAcumulado.toFixed(2)}`;
    if (txtLucroRelatorio)
      txtLucroRelatorio.innerText = `R$ ${lucroAcumulado.toFixed(2)}`;

    if (listaFinalParaTela.length === 0 && listaItensVendidos) {
      listaItensVendidos.innerHTML =
        "<p class='feedback-relatorio'>Nenhuma venda registrada neste período.</p>";
    }
    console.log(
      "✅ [Relatório] Processamento analítico e renderização agrupada concluídos.",
    );
  } catch (error) {
    console.error(
      "❌ [Erro Relatório] Erro fatal ao consolidar períodos:",
      error,
    );
    alert("Erro ao processar o relatório. Verifique o console.");
  }
}

if (btnDiario)
  btnDiario.addEventListener("click", () =>
    gerarRelatorioPorPeriodo(0, btnDiario),
  );
if (btnSemanal)
  btnSemanal.addEventListener("click", () =>
    gerarRelatorioPorPeriodo(7, btnSemanal),
  );
if (btnMensal)
  btnMensal.addEventListener("click", () =>
    gerarRelatorioPorPeriodo(30, btnMensal),
  );

// ==========================================
// 7. RESUMO GERAL DA HOME
// ==========================================
async function carregarResumosDoDia() {
  console.log(
    "📥 [Home Dashboard] Carregando blocos de faturamento do dia corrente...",
  );
  const divFaturamento = document.querySelector(".faturamente");
  const divLucro = document.querySelector(".lucro");
  const txtTotalEspetos = document.getElementById("totalEspetosVendidos");

  if (!divFaturamento || !divLucro) {
    console.warn(
      "⚠️ [Interface] Blocos visuais da home do painel diário não encontrados.",
    );
    return;
  }

  try {
    const hojeInicio = new Date();
    hojeInicio.setHours(0, 0, 0, 0);

    const q = query(
      collection(db, "vendas"),
      where("criado_em", ">=", hojeInicio),
    );
    const querySnapshot = await getDocs(q);

    let fat = 0;
    let luc = 0;
    let totalEspetosHoje = 0;

    for (const docVenda of querySnapshot.docs) {
      const v = docVenda.data();
      fat += v.faturamento_total || 0;
      luc += v.lucro_total || 0;

      const itensSnapshot = await getDocs(
        collection(db, "vendas", docVenda.id, "itens"),
      );
      itensSnapshot.forEach((docItem) => {
        const item = docItem.data();
        totalEspetosHoje += item.quantidade || 0;
      });
    }

    divFaturamento.innerHTML = `Faturamento<br><strong>R$ ${fat.toFixed(2)}</strong>`;
    divLucro.innerHTML = `Lucro<br><strong>R$ ${luc.toFixed(2)}</strong>`;

    if (txtTotalEspetos) {
      txtTotalEspetos.innerText = `${totalEspetosHoje} Vendidos`;
    }
    console.log(
      `✅ [Home Dashboard] Atualizada. Faturamento Hoje: R$${fat.toFixed(2)} | Unidades: ${totalEspetosHoje}`,
    );
  } catch (error) {
    console.error(
      "❌ [Erro Dashboard Home] Falha ao coletar dados do painel:",
      error,
    );
  }
}

// ==========================================
// 8. MONITOR DE ESTOQUE CRÍTICO
// ==========================================
async function verificarEstoqueCritico() {
  console.log(
    "📥 [Estoque Alerta] Monitorando integridade volumétrica dos espetos...",
  );
  const containerCritico = document.getElementById("listaEstoqueCritico");
  const txtTotalProdutosCriticos = document.getElementById(
    "totalProdutosCriticos",
  );

  if (!containerCritico) {
    console.warn(
      "⚠️ [Interface] Container de exibição crítica de estoque indisponível.",
    );
    return;
  }

  try {
    const querySnapshot = await getDocs(collection(db, "produtos"));
    containerCritico.innerHTML = "";
    let contadorCriticos = 0;

    querySnapshot.forEach((doc) => {
      const produto = doc.data();
      if (produto.estoque < 20) {
        contadorCriticos++;
        containerCritico.innerHTML += `
                    <div style="background: rgba(255, 68, 68, 0.15); border-left: 4px solid #ff4444; padding: 10px 12px; margin-bottom: 8px; border-radius: 4px; font-size: 14px; text-align: left; color: #fff; ">
                        🚨 <strong>${produto.nome}</strong> está acabando! Restam apenas <strong>${produto.estoque}</strong> unidades.
                    </div>
                `;
      }
    });

    if (txtTotalProdutosCriticos) {
      txtTotalProdutosCriticos.innerText = `${contadorCriticos} produtos em alerta`;
    }

    if (contadorCriticos === 0) {
      containerCritico.innerHTML =
        "<p style='font-size: 14px; color: #4caf50; opacity: 0.9;'>✅ Tudo certo! Todos os espetos estão com estoque abastecido.</p>";
    }
    console.log(
      `✅ [Estoque Alerta] Varredura completa. Itens em estado crítico: ${contadorCriticos}`,
    );
  } catch (error) {
    console.error(
      "❌ [Erro Monitor Estoque] Falha na análise volumétrica:",
      error,
    );
  }
}
document.addEventListener("vendaAtualizada", () => {
    console.log("🔄 [Interface] Atualizando dados da tela pós-escaneamento...");
    carregarProdutosNosSelects();
    carregarResumosDoDia();
    verificarEstoqueCritico();
});

// ==========================================
// 9. RECURSO: ALTERAÇÃO DE DADOS DE PRODUTOS (CRUD)
// ==========================================
const selectAlterar = document.getElementById("selectAlterarProduto");
const editNome = document.getElementById("inputAlterarNome");
const editCategoria = document.getElementById("inputAlterarCategoria");
const editCusto = document.getElementById("inputAlterarCusto");
const editVenda = document.getElementById("inputAlterarVenda");
const editQrCode = document.getElementById("inputAlterarQrCode");
const btnSalvarAlteracao = document.getElementById("btnSalvarAlteracaoProduto");

// Dicionário local na memória para evitar fazer requisições repetidas ao Firestore
let cacheProdutosLocal = {};

// Interceptamos a sua função original para injetar a atualização deste novo select também
const funcaoCarregarOriginal = carregarProdutosNosSelects;
carregarProdutosNosSelects = async function() {
    await funcaoCarregarOriginal(); // Executa o que já existia
    
    if (!selectAlterar) return;
    console.log("📥 [CRUD] Atualizando o select de modificação de produtos...");
    
    try {
        const querySnapshot = await getDocs(collection(db, "produtos"));
        selectAlterar.innerHTML = '<option value="">-- Selecione um produto para editar --</option>';
        cacheProdutosLocal = {}; // Reseta o cache anterior

        querySnapshot.forEach((doc) => {
            const produto = doc.data();
            const id = doc.id;
            
            // Salva no cache local indexando pelo ID único
            cacheProdutosLocal[id] = produto;
            
            selectAlterar.innerHTML += `<option value="${id}">${produto.nome}</option>`;
        });
        console.log("✅ [CRUD] Select de edição sincronizado com sucesso.");
    } catch (error) {
        console.error("❌ [CRUD] Falha ao sincronizar catálogo para edição:", error);
    }
};

// Evento 1: Detecta seleção e preenche o formulário automaticamente
if (selectAlterar) {
    selectAlterar.addEventListener("change", (e) => {
        const idSelecionado = e.target.value;
        console.log(`🔍 [CRUD] Produto selecionado para edição ID: ${idSelecionado}`);
        
        if (!idSelecionado || !cacheProdutosLocal[idSelecionado]) {
            // Limpa o formulário se desmarcar o select
            if(editNome) editNome.value = "";
            if(editCategoria) editCategoria.value = "";
            if(editCusto) editCusto.value = "";
            if(editVenda) editVenda.value = "";
            if(editQrCode) editQrCode.value = "";
            return;
        }

        const dadosProduto = cacheProdutosLocal[idSelecionado];
        
        // Aloca os dados atuais nos inputs correspondentes
        if(editNome) editNome.value = dadosProduto.nome || "";
        if(editCategoria) editCategoria.value = dadosProduto.categoria || "";
        if(editCusto) editCusto.value = dadosProduto.preco_custo ?? "";
        if(editVenda) editVenda.value = dadosProduto.preco_venda ?? "";
        if(editQrCode) editQrCode.value = dadosProduto.qr_code || "";
        console.log("📝 [CRUD] Inputs populados com dados atuais do Firestore.");
    });
}

// Evento 2: Processa a alteração e atualiza o banco de dados
if (btnSalvarAlteracao) {
    btnSalvarAlteracao.addEventListener("click", async () => {
        const idProduto = selectAlterar.value;
        
        if (!idProduto) {
            alert("Por favor, selecione primeiro um produto na lista superior!");
            return;
        }

        const novoNome = editNome.value.trim();
        const novaCategoria = editCategoria.value.trim();
        const novoCusto = parseFloat(editCusto.value);
        const novoVenda = parseFloat(editVenda.value);
        const novoQrCode = editQrCode.value.trim();

        // Validação sanitária de tipos antes de subir pro banco
        if (!novoNome || !novaCategoria || isNaN(novoCusto) || isNaN(novoVenda) || !novoQrCode) {
            alert("Não são permitidos campos em branco ou valores numéricos inválidos!");
            return;
        }

        console.log(`📤 [CRUD] Iniciando persistência de alteração para o documento: ${idProduto}`);
        
        try {
            const produtoRef = doc(db, "produtos", idProduto);
            
            // Gravação direta das novas propriedades mantendo o estoque intacto
            await updateDoc(produtoRef, {
                nome: novoNome,
                categoria: novaCategoria,
                preco_custo: novoCusto,
                preco_venda: novoVenda,
                qr_code: novoQrCode
            });

            console.log(`✅ [CRUD] Documento ${idProduto} atualizado com sucesso no Firestore.`);
            alert("Produto alterado com sucesso no sistema!");

            // Atualiza globalmente todos os selects e resumos do painel automaticamente
            carregarProdutosNosSelects();
            carregarResumosDoDia();
            verificarEstoqueCritico();

        } catch (error) {
            console.error("❌ [CRUD] Erro crítico ao salvar modificações do produto:", error);
            alert("Erro de permissão ou rede ao atualizar o produto: " + error.message);
        }
    });
}
// ==========================================
// 11. RECURSO: CONSUMO DE FUNCIONÁRIOS & ESTOQUE (CORRIGIDO)
// ==========================================

const btnConfirmarInterno = document.getElementById("btnConfirmarInterno");
const selectFuncionario = document.getElementById("func");
const selectProdutoFunc = document.getElementById("produtoFunc");
const inputQuantidadeFunc = document.getElementById("quantidade");

// Captura dos botões de período do funcionário
const btnFuncDiario = document.getElementById("btnFuncDiario");
const btnFuncSemanal = document.getElementById("btnFuncSemanal");
const btnFuncMensal = document.getElementById("btnFuncMensal");

// 🟢 FIX: Declarada explicitamente no escopo global do arquivo para evitar o ReferenceError
function alternarEstiloBotoesFunc(botaoAtivo) {
    const botoes = [btnFuncDiario, btnFuncSemanal, btnFuncMensal];
    botoes.forEach(btn => {
        if (btn) {
            btn.style.background = "#2a2a2a";
            btn.style.borderColor = "#444";
        }
    });
    if (botaoAtivo) {
        botaoAtivo.style.background = "#ff9800"; // Laranja ativo
        botaoAtivo.style.borderColor = "#ff9800";
    }
}

// Monitor de cliques para registrar o consumo interno
if (btnConfirmarInterno && selectFuncionario) {
    btnConfirmarInterno.addEventListener("click", async () => {
        const funcionario = selectFuncionario.value;
        const idProduto = selectProdutoFunc.value;
        const quantidade = parseInt(inputQuantidadeFunc.value) || 0;

        if (!funcionario) return alert("Selecione qual funcionário consumiu o item!");
        if (!idProduto) return alert("Selecione o produto consumido!");
        if (quantidade <= 0) return alert("A quantidade consumida deve ser maior que zero!");

        console.log(`📥 [Consumo] Processando lançamento para ${funcionario}...`);

        try {
            const produtoRef = doc(db, "produtos", idProduto);
            const produtoSnap = await getDoc(produtoRef);

            if (!produtoSnap.exists()) {
                alert("Produto não encontrado no banco de dados.");
                return;
            }

            const dadosProduto = produtoSnap.data();
            const estoqueAtual = parseInt(dadosProduto.estoque) || 0;
            const precoCustoUnitario = parseFloat(dadosProduto.preco_custo) || 0;

            if (estoqueAtual < quantidade) {
                alert(`Estoque insuficiente! O produto possui apenas ${estoqueAtual} unidades em estoque.`);
                return;
            }

            const novoEstoque = estoqueAtual - quantidade;
            await updateDoc(produtoRef, { estoque: novoEstoque });
            console.log(`📉 [Estoque] Baixa efetuada com sucesso. Novo estoque: ${novoEstoque}`);

            const custoTotalConsumido = precoCustoUnitario * quantidade;
            
            await addDoc(collection(db, "consumo_interno"), {
                funcionario: funcionario,
                produtoNome: dadosProduto.nome,
                idProduto: idProduto,
                quantidade: quantidade,
                custoTotal: custoTotalConsumido,
                dataLancamento: new Date()
            });
            console.log(`✅ [Consumo] Registro de custo adicionado para ${funcionario}.`);

            alert("Consumo lançado e estoque atualizado com sucesso!");

            inputQuantidadeFunc.value = 1;
            selectProdutoFunc.value = "";
            
            carregarProdutosNosSelects(); 
            carregarRelatorioConsumoFuncionarios(0, btnFuncDiario); // Força a atualização no Diário

        } catch (error) {
            console.error("❌ [Erro Crítico] Falha ao processar consumo interno:", error);
            alert("Erro ao salvar no banco: " + error.message);
        }
    });
}

// Função analítica de Relatório com Agrupamento por Nome + Produto
async function carregarRelatorioConsumoFuncionarios(diasParaTratras = 0, botaoAcionado = null) {
    const tabelaBody = document.getElementById("tabelaConsumoFunc");
    const divCustoTotal = document.getElementById("custoTotalFuncionarios");
    
    if (!tabelaBody || !divCustoTotal) return;

    // Aplica o estilo visual nos botões
    if (botaoAcionado) {
        alternarEstiloBotoesFunc(botaoAcionado);
    } else if (diasParaTratras === 0 && btnFuncDiario) {
        alternarEstiloBotoesFunc(btnFuncDiario);
    }

    try {
        const dataLimite = new Date();
        dataLimite.setHours(0, 0, 0, 0);
        if (diasParaTratras > 0) {
            dataLimite.setDate(dataLimite.getDate() - diasParaTratras);
        }

        console.log(`🔍 [Relatório Func] Buscando consumos a partir de: ${dataLimite.toISOString()}`);
        
        const q = query(
            collection(db, "consumo_interno"), 
            where("dataLancamento", ">=", dataLimite)
        );
        const querySnapshot = await getDocs(q);

        tabelaBody.innerHTML = "";
        let custoAcumuladoGeral = 0;
        
        const consumosBrutos = [];
        querySnapshot.forEach((doc) => {
            consumosBrutos.push(doc.data());
        });

        // Algoritmo de Agrupamento
        const consumosAgrupados = consumosBrutos.reduce((acumulador, itemAtual) => {
            const chaveUnica = `${itemAtual.funcionario}_${itemAtual.produtoNome}`;
            
            const qtdAtual = parseInt(itemAtual.quantidade) || 0;
            const custoAtual = parseFloat(itemAtual.custoTotal) || 0;

            if (!acumulador[chaveUnica]) {
                acumulador[chaveUnica] = {
                    funcionario: itemAtual.funcionario,
                    produtoNome: itemAtual.produtoNome,
                    quantidadeTotal: 0,
                    custoTotalAcumulado: 0
                };
            }

            acumulador[chaveUnica].quantidadeTotal += qtdAtual;
            acumulador[chaveUnica].custoTotalAcumulado += custoAtual;

            return acumulador;
        }, {});

        const listaAgrupadaParaTela = Object.values(consumosAgrupados);

        listaAgrupadaParaTela.forEach((registro) => {
            custoAcumuladoGeral += registro.custoTotalAcumulado;

            tabelaBody.innerHTML += `
                <tr style="border-bottom: 1px solid #2a2a2a;">
                    <td style="padding: 10px 6px; font-weight: 500;">${registro.funcionario}</td>
                    <td style="padding: 10px 6px; color: #aaa;">${registro.produtoNome}</td>
                    <td style="padding: 10px 6px; text-align: center; color: #ff9800; font-weight: bold;">${registro.quantidadeTotal}x</td>
                    <td style="padding: 10px 6px; text-align: right; color: #ff4444; font-weight: bold;">
                        R$ ${registro.custoTotalAcumulado.toFixed(2)}
                    </td>
                </tr>
            `;
        });

        divCustoTotal.innerText = `R$ ${custoAcumuladoGeral.toFixed(2)}`;
        
        if (listaAgrupadaParaTela.length === 0) {
            tabelaBody.innerHTML = `<tr><td colspan="4" style="text-align: center; padding: 20px; color: #aaa;">Nenhum consumo registrado neste período.</td></tr>`;
        }

        console.log("📊 [Relatório Func] Consolidação e agrupamento concluídos.");

    } catch (error) {
        console.error("❌ [Erro Relatório] Falha ao renderizar histórico agrupado:", error);
    }
}

// Configuração dos escutadores de evento dos botões de período
if (btnFuncDiario) btnFuncDiario.addEventListener("click", () => carregarRelatorioConsumoFuncionarios(0, btnFuncDiario));
if (btnFuncSemanal) btnFuncSemanal.addEventListener("click", () => carregarRelatorioConsumoFuncionarios(7, btnFuncSemanal));
if (btnFuncMensal) btnFuncMensal.addEventListener("click", () => carregarRelatorioConsumoFuncionarios(30, btnFuncMensal));