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
            qrbox: function(viewfinderWidth, viewfinderHeight) {
                const minEdge = Math.min(viewfinderWidth, viewfinderHeight);
                const qrboxSize = Math.floor(minEdge * 0.8); 
                return { width: qrboxSize, height: qrboxSize };
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
    const agora = Date.now();
    if (decodedText === ultimoCodigoLido && (agora - ultimaLeituraTime) < 2500) {
        return; 
    }
    ultimaLeituraTime = agora;
    ultimoCodigoLido = decodedText;

    alert("Passo 1: Leitura detectada: " + decodedText);
    
    // Execução assíncrona desacoplada da biblioteca principal
    processarTransacaoFirebase(decodedText).catch(fatalError => {
        alert("Erro Crítico Inesperado: " + fatalError.message);
    });
}

// Pipeline de persistência isolado
async function processarTransacaoFirebase(codigoLido) {
    alert("Passo 2: Iniciando busca no Firestore...");
    
    try {
        const produtosRef = collection(db, "produtos");
        const q = query(produtosRef, where("qr_code", "==", codigoLido));
        
        // Se travar exatamente aqui, o problema é conexão de rede ou inicialização do db
        const querySnapshot = await getDocs(q);
        
        alert("Passo 3: Busca respondida. Documentos encontrados: " + querySnapshot.size);

        if (querySnapshot.empty) {
            alert(`X: Código [${codigoLido}] inexistente na coleção 'produtos'.`);
            return;
        }

        const docProduto = querySnapshot.docs[0];
        const idProduto = docProduto.id;
        const dadosProduto = docProduto.data();

        alert(`Passo 4: Produto identificado (${dadosProduto.nome || "Sem nome"}). Processando gravação...`);

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

        // Atualização de Inventário
        await updateDoc(doc(db, "produtos", idProduto), {
            estoque: increment(-1)
        });

        alert("Passo 5: Sucesso total no Firestore!");
        document.dispatchEvent(new Event("vendaAtualizada"));

    } catch (dbError) {
        // Captura rejeições de segurança, falta de index ou problemas de escrita
        alert("🚨 FALHA FIRESTORE:\nNome: " + dbError.name + "\nMensagem: " + dbError.message);
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