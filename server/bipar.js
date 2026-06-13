console.log("📷 [Sistema] Inicializando o arquivo de Scanner (bipar.js)...");

// 1. IMPORTAÇÕES NECESSÁRIAS DO FIREBASE
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import { 
    getFirestore, 
    collection, 
    query, 
    where, 
    getDocs, 
    doc, 
    addDoc, 
    updateDoc, 
    increment, 
    serverTimestamp 
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

const firebaseConfig = {
    apiKey: "AIzaSyC3BV2K0x4n0OOUfiFLBR6-fX-7DwGVSGA",
    authDomain: "espetos.firebaseapp.com",
    projectId: "espetos",
    storageBucket: "espetos.firebasestorage.app",
    messagingSenderId: "112705479220",
    appId: "1:112705479220:web:81741585cb73f919ede061",
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

let html5QrcodeScanner = null;
let estaEscaneando = false;
let ultimaLeituraTime = 0;
let ultimoCodigoLido = "";
let processandoVenda = false;

const btnCamera = document.getElementById("btnAlternarCamera");
const containerCamera = document.getElementById("leitor-camera");

if (btnCamera) {
    btnCamera.addEventListener("click", () => {
        if (!estaEscaneando) {
            iniciarScannerContinuo();
        } else {
            pararScanner();
        }
    });
}

function iniciarScannerContinuo() {
    if (!containerCamera) return;
    containerCamera.style.display = "block";
    btnCamera.innerText = "🛑 Desligar Scanner";
    btnCamera.style.background = "#ff4444";
    estaEscaneando = true;

    html5QrcodeScanner = new Html5Qrcode("leitor-camera");
    html5QrcodeScanner.start(
        { facingMode: "environment" }, 
        {
            fps: 15, 
            // ║▌║ AQUI ESTÁ A ADAPTAÇÃO: Força a câmera a aceitar QR Code E códigos de barras
            formatsToSupport: [ 
                Html5QrcodeSupportedFormats.QR_CODE, 
                Html5QrcodeSupportedFormats.EAN_13,
                Html5QrcodeSupportedFormats.EAN_8
            ],
            // 📐 Ajuste de foco: Retangular para facilitar a leitura das latinhas
            qrbox: function(viewfinderWidth, viewfinderHeight) {
                const widthBox = Math.floor(viewfinderWidth * 0.85); // Pega boa parte da largura
                const heightBox = Math.floor(viewfinderHeight * 0.4); // Fica mais baixo (formato de fita)
                return { width: widthBox, height: heightBox };
            }
        },
        onScanSuccess 
    ).catch(err => {
        alert("Erro Câmera HW: " + err.message);
        pararScanner();
    });
}

// Handler da biblioteca isolado para não engolir erros síncronos
function onScanSuccess(decodedText, decodedResult) {
    // Se já tiver uma venda rodando no Firebase, ignora completamente qualquer nova leitura
    if (processandoVenda) {
        console.log("⏳ [Scanner] Ignorando leitura: Existe uma transação em andamento.");
        return;
    }

    const agora = Date.now();
    if (decodedText === ultimoCodigoLido && (agora - ultimaLeituraTime) < 3000) {
        return; 
    }
    
    // Ativa a trava imediatamente para ninguém mais entrar aqui
    processandoVenda = true;
    ultimaLeituraTime = agora;
    ultimoCodigoLido = decodedText;

    //alert("Passo 1: Leitura detectada: " + decodedText);
    
    // ⏸️ PAUSA A CÂMERA: Congela a imagem para o sensor parar de bipar enquanto salvamos no banco
    if (html5QrcodeScanner && typeof html5QrcodeScanner.pause === "function") {
        html5QrcodeScanner.pause();
        console.log("⏸️ [Scanner] Câmera pausada para processamento.");
    }
    
    // Execução assíncrona desacoplada da biblioteca principal
    processarTransacaoFirebase(decodedText).catch(fatalError => {
        alert("Erro Crítico Inesperado: " + fatalError.message);
        liberarScannerParaProximaLeitura(); // Garante que destrava se algo der muito errado
    });
}
// Pipeline de persistência isolado
async function processarTransacaoFirebase(codigoLido) {
    //alert("Passo 2: Iniciando busca no Firestore...");
    
    try {
        const produtosRef = collection(db, "produtos");
        const q = query(produtosRef, where("qr_code", "==", codigoLido));
        
        const querySnapshot = await getDocs(q);
        
        //alert("Passo 3: Busca respondida. Documentos encontrados: " + querySnapshot.size);

        if (querySnapshot.empty) {
            alert(`X: Código [${codigoLido}] inexistente na coleção 'produtos'.`);
            liberarScannerParaProximaLeitura(); // Código errado: Destrava a câmera para tentar outro
            return;
        }

        const docProduto = querySnapshot.docs[0];
        const idProduto = docProduto.id;
        const dadosProduto = docProduto.data();

        const estoqueAtual = Number(dadosProduto.estoque) || 0;

        if (estoqueAtual <= 0) {
            const continuarVenda = confirm(
            `⚠️ ATENÇÃO: ESTOQUE ZERADO!\n\nO produto [${dadosProduto.nome.toUpperCase()}] está com estoque zerado (Qtd: ${estoqueAtual}).\n\nDeseja continuar com a venda assim mesmo? (O estoque ficará negativo)`
            );

            // Se o funcionário clicar em "Cancelar" (Não)
            if (!continuarVenda) {
                console.log("🚫 [Venda] Operação cancelada pelo usuário devido ao estoque zerado.");
                
                if (typeof liberarScannerParaProximaLeitura === "function") {
                    liberarScannerParaProximaLeitura(); 
                }
                return; // Para a execução aqui e NÃO grava no banco
            }
            
            // Se ele clicar em "OK", o código passa batido por aqui e executa as próximas linhas normalmente!
            console.log("⚠️ [Venda] Funcionário permitiu furar o estoque para o produto: " + dadosProduto.nome);
        }

        //alert(`Passo 4: Produto identificado (${dadosProduto.nome || "Sem nome"}). Processando gravação...`);

        const precoVenda = Number(dadosProduto.preco_venda) || 0;
        const precoCusto = Number(dadosProduto.preco_custo) || 0;

        // Operação Atômica de Venda Mestre
        const novaVendaRef = await addDoc(collection(db, "vendas"), {
            faturamento_total: precoVenda,
            lucro_total: (precoVenda - precoCusto),
            criado_em: serverTimestamp()
        });

        // Subcoleção Itens
        await addDoc(collection(db, "vendas", novaVendaRef.id, "itens"), {
            produto_id: idProduto,
            quantidade: 1,
            preco_venda_momento: precoVenda,
            preco_custo_momento: precoCusto,
            categoria_momento: dadosProduto.categoria || "Geral"
        });

        // penúltimo passo: Atualização de Inventário
        await updateDoc(doc(db, "produtos", idProduto), {
            estoque: increment(-1)
        });

        alert("Venda do produto [" + (dadosProduto.nome || "Sem nome") + "] registrada com SUCESSO!");
        document.dispatchEvent(new Event("vendaAtualizada"));

        // Finalizou com sucesso total? Chama a função que espera o usuário agir e limpa o scanner
        liberarScannerParaProximaLeitura();

    } catch (dbError) {
        alert("🚨 FALHA FIRESTORE:\nNome: " + dbError.name + "\nMensagem: " + dbError.message);
        liberarScannerParaProximaLeitura(); // Erro de rede: Destrava para permitir nova tentativa
    }
}

function pararScanner() {
    if (containerCamera) containerCamera.style.display = "none";
    if (btnCamera) {
        btnCamera.innerText = "📷 Ligar Scanner Contínuo";
        btnCamera.style.background = ""; 
    }
    estaEscaneando = false;
    if (html5QrcodeScanner) {
        html5QrcodeScanner.stop().finally(() => { html5QrcodeScanner = null; });
    }
}

function liberarScannerParaProximaLeitura() {
    // Damos um tempo de 2 segundos (2000ms) com a câmera congelada/travada.
    // Isso dá tempo de sobra para o funcionário ver o alert de sucesso e tirar o espeto/lata de frente da câmera.
    setTimeout(() => {
        ultimoCodigoLido = ""; // Limpa o último código para permitir bipar o mesmo produto em seguida
        processandoVenda = false; // Abre o cadeado lógico
        
        // ▶️ RETOMA A CÂMERA: Volta a procurar códigos na imagem
        if (html5QrcodeScanner && estaEscaneando) {
            html5QrcodeScanner.resume();
            console.log("▶️ [Scanner] Câmera retomada e pronta para o próximo produto!");
        }
    }, 2000); 
}