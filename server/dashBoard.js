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
// 1. GUARDA DE ROTA & INICIALIZAÇÃO CONTROLADA
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
    
    // 🛡️ SEGURANÇA: As funções que buscam dados do Firestore SÓ rodam aqui dentro agora!
    carregarProdutosNosSelects();
    carregarResumosDoDia();
    verificarEstoqueCritico();
    carregarRelatorioConsumoFuncionarios();
    
    // Inicializa o Scanner de Câmera Dupla se o container existir na página atual
    if (document.getElementById("reader")) {
        inicializarScannerCameraDupla();
    }
  }
});

// ==========================================
// 2. CONFIGURAÇÃO DO SCANNER: QR CODE & EAN-13 (LATINHAS)
// ==========================================
function inicializarScannerCameraDupla() {
    console.log("📸 [Scanner] Configurando leitura de QR Code + EAN-13...");
    
    try {
        // Define os formatos de código que a câmera vai tentar ler simultaneamente
        const formatosSuportados = [
            Html5QrcodeSupportedFormats.QR_CODE, // Códigos quadrados (Comandas/Espetos)
            Html5QrcodeSupportedFormats.EAN_13,  // Códigos de barra tradicionais (Latinhas)
            Html5QrcodeSupportedFormats.EAN_8    // Versão menor para produtos pequenos
        ];

        const html5QrcodeScanner = new Html5QrcodeScanner(
            "reader", 
            { 
                fps: 10, 
                qrbox: { width: 260, height: 160 }, // Enquadramento retangular ideal para latinhas
                formatsToSupport: formatosSuportados 
            },
            /* verbose= */ false
        );

        async function onScanSuccess(decodedText) {
            console.log(`🎯 [Scanner] Código detectado com sucesso: ${decodedText}`);
            
            // Pausa temporariamente para evitar leituras duplicadas no mesmo segundo
            html5QrcodeScanner.clear();

            // Processa a venda buscando o produto correspondente ao código obtido
            await processarVendaPorCodigoDeCamera(decodedText);
            
            // Reinicia o scanner após o término do processamento
            setTimeout(() => {
                inicializarScannerCameraDupla();
            }, 2000);
        }

        html5QrcodeScanner.render(onScanSuccess, () => {
            // Callback de erro silencioso para evitar logs repetitivos de foco da lente
        });

    } catch (error) {
        console.error("❌ [Scanner] Erro ao instanciar a biblioteca Html5Qrcode:", error);
    }
}

// Lógica de processamento de venda via código lido pela câmera
async function processarVendaPorCodigoDeCamera(codigoIdentificado) {
    console.log(`🔍 [Firestore] Buscando produto com o código: ${codigoIdentificado}`);
    
    try {
        const q = query(collection(db, "produtos"), where("qr_code", "==", codigoIdentificado.trim()));
        const querySnapshot = await getDocs(q);

        if (querySnapshot.empty) {
            alert(`Produto com o código ${codigoIdentificado} não encontrado no sistema!`);
            return;
        }

        // Recupera o primeiro produto correspondente localizado
        const produtoDoc = querySnapshot.docs[0];
        const idProduto = produtoDoc.id;
        const dadosProduto = produtoDoc.data();
        const estoqueAtual = dadosProduto.estoque;

        // Regra de Negócio: Quantidade padrão por bip é 1 item
        const quantidadeVendida = 1; 

        if (estoqueAtual < quantidadeVendida) {
            alert(`Estoque insuficiente para ${dadosProduto.nome}! Restam apenas ${estoqueAtual} unidades.`);
            return;
        }

        const faturamentoTotalVenda = dadosProduto.preco_venda * quantidadeVendida;
        const custoTotalVenda = dadosProduto.preco_custo * quantidadeVendida;
        const lucroTotalVenda = faturamentoTotalVenda - custoTotalVenda;

        // Cria a venda mestre
        const novaVendaRef = await addDoc(collection(db, "vendas"), {
            faturamento_total: faturamentoTotalVenda,
            lucro_total: lucroTotalVenda,
            criado_em: serverTimestamp(),
        });

        // Aloca os itens da venda
        await addDoc(collection(db, "vendas", novaVendaRef.id, "itens"), {
            produto_id: idProduto,
            quantidade: quantidadeVendida,
            preco_venda_momento: dadosProduto.preco_venda,
            preco_custo_momento: dadosProduto.preco_custo,
            categoria_momento: dadosProduto.categoria,
        });

        // Decrementa o estoque
        await updateDoc(doc(db, "produtos", idProduto), {
            estoque: increment(-quantidadeVendida),
        });

        console.log(`✅ [Venda Câmera] Registro efetuado! 1x ${dadosProduto.nome} vendido.`);
        
        // Dispara o evento personalizado para atualizar os dados visuais da dashboard
        document.dispatchEvent(new Event("vendaAtualizada"));

    } catch (error) {
        console.error("❌ [Erro Venda Câmera] Falha ao processar bip do produto:", error);
        alert("Erro ao processar o escaneamento do produto.");
    }
}

// ==========================================
// 3. CADASTRO DE PRODUTOS
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

    if (
      !nome ||
      !categoria ||
      isNaN(precoCusto) ||
      isNaN(precoVenda) ||
      isNaN(estoque) ||
      !qrCode
    ) {
      console.warn("⚠️ [Validação] Falha: Campos obrigatórios vazios ou inválidos no cadastro.");
      alert("Por favor, preencha todos os campos do cadastro corretamente!");
      return;
    }

    try {
      await addDoc(collection(db, "produtos"), {
        nome: nome,
        categoria: categoria,
        preco_custo: precoCusto,
        preco_venda: precoVenda,
        estoque: estoque,
        criado_em: serverTimestamp(),
        qr_code: qrCode,
      });

      alert(`Produto "${nome}" cadastrado com sucesso!`);

      inputProd.value = "";
      inputCat.value = "";
      inputPrecoCusto.value = "";
      inputPrecoVenda.value = "";
      inputEstoqueInicial.value = "";
      qrCodeInput.value = "";

      carregarProdutosNosSelects();
    } catch (error) {
      console.error("❌ [Erro Firestore] Falha ao cadastrar produto:", error);
      alert("Erro ao salvar o produto. Tente novamente.");
    }
  });
}

// ==========================================
// 4. ATUALIZAÇÃO DOS SELECTS
// ==========================================
async function carregarProdutosNosSelects() {
  const selectEstoque = document.getElementById("nomeProduto");
  const selectVendas = document.getElementById("produto");
  const selectFunc = document.getElementById("produtoFunc");

  try {
    const querySnapshot = await getDocs(collection(db, "produtos"));

    if (selectEstoque) selectEstoque.innerHTML = '<option value="">Selecione o produto</option>';
    if (selectVendas) selectVendas.innerHTML = '<option value="">Selecione o produto</option>';
    if (selectFunc) selectFunc.innerHTML = '<option value="">Selecione o produto</option>';

    querySnapshot.forEach((doc) => {
      const produto = doc.data();
      const idProduto = doc.id;
      const optionHTML = `<option value="${idProduto}">${produto.nome} (Qtd: ${produto.estoque})</option>`;

      if (selectEstoque) selectEstoque.innerHTML += optionHTML;
      if (selectVendas) selectVendas.innerHTML += optionHTML;
      if (selectFunc) selectFunc.innerHTML += optionHTML;
    });
  } catch (error) {
    console.error("❌ [Erro Firestore] Erro ao buscar produtos para selects: ", error);
  }
}

// ==========================================
// 5. ENTRADA DE ESTOQUE
// ==========================================
const selectEstoque = document.getElementById("nomeProduto");
const inputQtdEntrada = document.getElementById("qtdEntrada");
const btnConfirmarEntrada = document.getElementById("btnConfirmarEntrada");

if (btnConfirmarEntrada) {
  btnConfirmarEntrada.addEventListener("click", async () => {
    const idProduto = selectEstoque.value;
    const quantidadeEntrada = parseInt(inputQtdEntrada.value);

    if (!idProduto || isNaN(quantidadeEntrada) || quantidadeEntrada <= 0) {
      alert("Por favor, selecione um produto e insira uma quantidade válida!");
      return;
    }

    try {
      const produtoRef = doc(db, "produtos", idProduto);
      await updateDoc(produtoRef, {
        estoque: increment(quantidadeEntrada),
      });

      alert("Estoque atualizado com sucesso!");
      inputQtdEntrada.value = "";
      carregarProdutosNosSelects();
      verificarEstoqueCritico();
    } catch (error) {
      console.error("❌ [Erro Firestore] Falha ao atualizar estoque:", error);
    }
  });
}

// ==========================================
// 6. FLUXO DE CONFIRMAR VENDA (MANUAL VIA SELECT)
// ==========================================
const selectVendaProduto = document.getElementById("produto");
const inputQtdVenda = document.getElementById("quantidade");
const btnConfirmarVenda = document.getElementById("btnConfirmarVenda");

if (btnConfirmarVenda) {
  btnConfirmarVenda.addEventListener("click", async () => {
    const idProduto = selectVendaProduto.value;
    const quantidadeVendida = parseInt(inputQtdVenda.value);

    if (!idProduto || isNaN(quantidadeVendida) || quantidadeVendida <= 0) {
      alert("Por favor, selecione o produto e informe uma quantidade válida.");
      return;
    }

    try {
      const produtoRef = doc(db, "produtos", idProduto);
      const produtoSnap = await getDoc(produtoRef);

      if (!produtoSnap.exists()) {
        alert("Produto não encontrado no banco de dados.");
        return;
      }

      const dadosProduto = produtoSnap.data();
      const estoqueAtual = dadosProduto.estoque;

      if (estoqueAtual < quantidadeVendida) {
        alert(`Estoque insuficiente! Você tem apenas ${estoqueAtual} unidades.`);
        return;
      }

      const faturamentoTotalVenda = dadosProduto.preco_venda * quantidadeVendida;
      const custoTotalVenda = dadosProduto.preco_custo * quantidadeVendida;
      const lucroTotalVenda = faturamentoTotalVenda - custoTotalVenda;

      const novaVendaRef = await addDoc(collection(db, "vendas"), {
        faturamento_total: faturamentoTotalVenda,
        lucro_total: lucroTotalVenda,
        criado_em: serverTimestamp(),
      });

      await addDoc(collection(db, "vendas", novaVendaRef.id, "itens"), {
        produto_id: idProduto,
        quantidade: quantidadeVendida,
        preco_venda_momento: dadosProduto.preco_venda,
        preco_custo_momento: dadosProduto.preco_custo,
        categoria_momento: dadosProduto.categoria,
      });

      await updateDoc(produtoRef, {
        estoque: increment(-quantidadeVendida),
      });

      alert("Venda realizada com sucesso!");
      inputQtdVenda.value = "";

      carregarProdutosNosSelects();
      carregarResumosDoDia();
      verificarEstoqueCritico();

      const btnDiarioRef = document.getElementById("btnRelatorioDiario");
      if (btnDiarioRef) gerarRelatorioPorPeriodo(0, btnDiarioRef);
    } catch (error) {
      console.error("❌ [Erro Fluxo Venda] Falha no processamento:", error);
    }
  });
}

// ==========================================
// 7. ABA DE RELATÓRIOS INTEGRADA (AGRUPADA)
// ==========================================
const txtFaturamentoRelatorio = document.getElementById("faturamentoRelatorio");
const txtLucroRelatorio = document.getElementById("lucroRelatorio");
const listaItensVendidos = document.getElementById("listaItensVendidos");

const btnDiario = document.getElementById("btnRelatorioDiario");
const btnSemanal = document.getElementById("btnRelatorioSemanal");
const btnMensal = document.getElementById("btnRelatorioMensal");

async function gerarRelatorioPorPeriodo(diasParaTratras, botaoAtivo) {
  try {
    [btnDiario, btnSemanal, btnMensal].forEach((btn) => btn?.classList.remove("ativo"));
    botaoAtivo?.classList.add("ativo");

    const dataLimite = new Date();
    dataLimite.setHours(0, 0, 0, 0);
    if (diasParaTratras > 0) {
      dataLimite.setDate(dataLimite.getDate() - diasParaTratras);
    }

    const q = query(collection(db, "vendas"), where("criado_em", ">=", dataLimite));
    const vendasSnapshot = await getDocs(q);

    let faturamentoAcumulado = 0;
    let lucroAcumulado = 0;
    const todosOsItensBrutos = [];

    for (const docVenda of vendasSnapshot.docs) {
      const dadosVenda = docVenda.data();
      faturamentoAcumulado += dadosVenda.faturamento_total || 0;
      lucroAcumulado += dadosVenda.lucro_total || 0;

      const   itensSnapshot = await getDocs(collection(db, "vendas", docVenda.id, "itens"));
      itensSnapshot.forEach((docItem) => {
        todosOsItensBrutos.push(docItem.data());
      });
    }

    const itensAgrupados = todosOsItensBrutos.reduce((acumulador, itemAtual) => {
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

    if (txtFaturamentoRelatorio) txtFaturamentoRelatorio.innerText = `R$ ${faturamentoAcumulado.toFixed(2)}`;
    if (txtLucroRelatorio) txtLucroRelatorio.innerText = `R$ ${lucroAcumulado.toFixed(2)}`;

    if (listaFinalParaTela.length === 0 && listaItensVendidos) {
      listaItensVendidos.innerHTML = "<p class='feedback-relatorio'>Nenhuma venda registrada neste período.</p>";
    }
  } catch (error) {
    console.error("❌ [Erro Relatório] Falha ao consolidar períodos:", error);
  }
}

if (btnDiario) btnDiario.addEventListener("click", () => gerarRelatorioPorPeriodo(0, btnDiario));
if (btnSemanal) btnSemanal.addEventListener("click", () => gerarRelatorioPorPeriodo(7, btnSemanal));
if (btnMensal) btnMensal.addEventListener("click", () => gerarRelatorioPorPeriodo(30, btnMensal));

// ==========================================
// 8. RESUMO GERAL DA HOME
// ==========================================
async function carregarResumosDoDia() {
  const divFaturamento = document.querySelector(".faturamente");
  const divLucro = document.querySelector(".lucro");
  const txtTotalEspetos = document.getElementById("totalEspetosVendidos");

  if (!divFaturamento || !divLucro) return;

  try {
    const hojeInicio = new Date();
    hojeInicio.setHours(0, 0, 0, 0);

    const q = query(collection(db, "vendas"), where("criado_em", ">=", hojeInicio));
    const querySnapshot = await getDocs(q);

    let fat = 0;
    let luc = 0;
    let totalEspetosHoje = 0;

    for (const docVenda of querySnapshot.docs) {
      const v = docVenda.data();
      fat += v.faturamento_total || 0;
      luc += v.lucro_total || 0;

      const itensSnapshot = await getDocs(collection(db, "vendas", docVenda.id, "itens"));
      itensSnapshot.forEach((docItem) => {
        const item = docItem.data();
        totalEspetosHoje += item.quantidade || 0;
      });
    }

    divFaturamento.innerHTML = `Faturamento<br><strong>R$ ${fat.toFixed(2)}</strong>`;
    divLucro.innerHTML = `Lucro<br><strong>R$ ${luc.toFixed(2)}</strong>`;

    if (txtTotalEspetos) txtTotalEspetos.innerText = `${totalEspetosHoje} Vendidos`;
  } catch (error) {
    console.error("❌ [Erro Dashboard Home] Falha ao coletar dados:", error);
  }
}

// ==========================================
// 9. MONITOR DE ESTOQUE CRÍTICO
// ==========================================
async function verificarEstoqueCritico() {
  const containerCritico = document.getElementById("listaEstoqueCritico");
  const txtTotalProdutosCriticos = document.getElementById("totalProdutosCriticos");

  if (!containerCritico) return;

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

    if (txtTotalProdutosCriticos) txtTotalProdutosCriticos.innerText = `${contadorCriticos} produtos em alerta`;
    if (contadorCriticos === 0) {
      containerCritico.innerHTML = "<p style='font-size: 14px; color: #4caf50; opacity: 0.9;'>✅ Tudo certo! Estoques em conformidade.</p>";
    }
  } catch (error) {
    console.error("❌ [Erro Monitor Estoque] Falha na análise volumétrica:", error);
  }
}

// Escuta evento disparado pelo scanner automático
document.addEventListener("vendaAtualizada", () => {
    console.log("🔄 [Interface] Atualizando dados da tela pós-escaneamento...");
    carregarProdutosNosSelects();
    carregarResumosDoDia();
    verificarEstoqueCritico();
});

// ==========================================
// 10. RECURSO: EDITAR PRODUTOS (CRUD)
// ==========================================
const selectAlterar = document.getElementById("selectAlterarProduto");
const editNome = document.getElementById("inputAlterarNome");
const editCategoria = document.getElementById("inputAlterarCategoria");
const editCusto = document.getElementById("inputAlterarCusto");
const editVenda = document.getElementById("inputAlterarVenda");
const editQrCode = document.getElementById("inputAlterarQrCode");
const btnSalvarAlteracao = document.getElementById("btnSalvarAlteracaoProduto");

let cacheProdutosLocal = {};

// Função auxiliar para injetar as opções no select de alteração
async function sincronizarSelectAlterar() {
    if (!selectAlterar) return;
    try {
        const querySnapshot = await getDocs(collection(db, "produtos"));
        selectAlterar.innerHTML = '<option value="">-- Selecione um produto para editar --</option>';
        cacheProdutosLocal = {};
        querySnapshot.forEach((doc) => {
            const produto = doc.data();
            cacheProdutosLocal[doc.id] = produto;
            selectAlterar.innerHTML += `<option value="${doc.id}">${produto.nome}</option>`;
        });
    } catch (error) {
        console.error("❌ [CRUD] Falha ao sincronizar select de alteração:", error);
    }
}

if (selectAlterar) {
    selectAlterar.addEventListener("change", (e) => {
        const idSelecionado = e.target.value;
        if (!idSelecionado || !cacheProdutosLocal[idSelecionado]) {
            if(editNome) editNome.value = "";
            if(editCategoria) editCategoria.value = "";
            if(editCusto) editCusto.value = "";
            if(editVenda) editVenda.value = "";
            if(editQrCode) editQrCode.value = "";
            return;
        }
        const dadosProduto = cacheProdutosLocal[idSelecionado];
        if(editNome) editNome.value = dadosProduto.nome || "";
        if(editCategoria) editCategoria.value = dadosProduto.categoria || "";
        if(editCusto) editCusto.value = dadosProduto.preco_custo ?? "";
        if(editVenda) editVenda.value = dadosProduto.preco_venda ?? "";
        if(editQrCode) editQrCode.value = dadosProduto.qr_code || "";
    });
}

if (btnSalvarAlteracao) {
    btnSalvarAlteracao.addEventListener("click", async () => {
        const idProduto = selectAlterar.value;
        if (!idProduto) {
            alert("Por favor, selecione primeiro um produto na lista!");
            return;
        }

        const novoNome = editNome.value.trim();
        const novaCategoria = editCategoria.value.trim();
        const novoCusto = parseFloat(editCusto.value);
        const novoVenda = parseFloat(editVenda.value);
        const novoQrCode = editQrCode.value.trim();

        if (!novoNome || !novaCategoria || isNaN(novoCusto) || isNaN(novoVenda) || !novoQrCode) {
            alert("Não são permitidos campos em branco ou numéricos inválidos!");
            return;
        }

        try {
            await updateDoc(doc(db, "produtos", idProduto), {
                nome: novoNome,
                categoria: novaCategoria,
                preco_custo: novoCusto,
                preco_venda: novoVenda,
                qr_code: novoQrCode
            });

            alert("Produto alterado com sucesso no sistema!");
            carregarProdutosNosSelects();
            carregarResumosDoDia();
            verificarEstoqueCritico();
            sincronizarSelectAlterar();
        } catch (error) {
            console.error("❌ [CRUD] Erro ao salvar modificações:", error);
        }
    });
}

// ==========================================
// 11. RECURSO: CONSUMO DE FUNCIONÁRIOS
// ==========================================
const btnConfirmarInterno = document.getElementById("btnConfirmarInterno");
const selectFuncionario = document.getElementById("func");
const selectProdutoFunc = document.getElementById("produtoFunc");
const inputQuantidadeFunc = document.getElementById("quantidade");

if (btnConfirmarInterno && selectFuncionario) {
    btnConfirmarInterno.addEventListener("click", async () => {
        const funcionario = selectFuncionario.value;
        const idProduto = selectProdutoFunc.value;
        const quantidade = parseInt(inputQuantidadeFunc.value) || 0;

        if (!funcionario || !idProduto || quantidade <= 0) {
            alert("Preencha todos os campos do consumo interno corretamente!");
            return;
        }

        try {
            const produtoRef = doc(db, "produtos", idProduto);
            const produtoSnap = await getDoc(produtoRef);

            if (!produtoSnap.exists()) return alert("Produto não encontrado.");

            const dadosProduto = produtoSnap.data();
            const estoqueAtual = parseInt(dadosProduto.estoque) || 0;
            const precoCustoUnitario = parseFloat(dadosProduto.preco_custo) || 0;

            if (estoqueAtual < quantidade) {
                alert(`Estoque insuficiente! Restam apenas ${estoqueAtual} unidades.`);
                return;
            }

            await updateDoc(produtoRef, { estoque: estoqueAtual - quantidade });
            
            await addDoc(collection(db, "consumo_interno"), {
                funcionario: funcionario,
                produtoNome: dadosProduto.nome,
                idProduto: idProduto,
                quantidade: quantidade,
                custoTotal: precoCustoUnitario * quantity,
                dataLancamento: new Date()
            });

            alert("Consumo lançado com sucesso!");
            inputQuantidadeFunc.value = 1;
            selectProdutoFunc.value = "";
            
            carregarProdutosNosSelects(); 
            carregarRelatorioConsumoFuncionarios(0); 
        } catch (error) {
            console.error("❌ [Erro] Falha ao processar consumo:", error);
        }
    });
}

// Adiciona gancho extra para carregar a sincronização de edição quando a carga principal acontecer
const carregarOriginalModificado = carregarProdutosNosSelects;
carregarProdutosNosSelects = async function() {
    await carregarOriginalModificado();
    await sincronizarSelectAlterar();
};

async function carregarRelatorioConsumoFuncionarios(diasParaTratras = 0) {
    // Mantido para compatibilidade com a assinatura interna original
    console.log("📊 [Consumo] Carregando relatórios internos...");
}