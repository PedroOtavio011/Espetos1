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

// Variáveis de controle do Scanner
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
    if (!containerCamera) {
        console.error("❌ Elemento 'leitor-camera' não foi encontrado no HTML.");
        return;
    }
    
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
        console.error("Erro ao iniciar a câmera: ", err);
        alert("Não foi possível acessar a câmera do aparelho.");
        pararScanner();
    });
}

// 🎯 FUNÇÃO DE VENDA AUTOMÁTICA SEQUENCIAL
async function onScanSuccess(decodedText, decodedResult) {
    alert("A câmera conseguiu ler: " + decodedText);
    const agora = Date.now();
    
    // Filtro anti-duplicação (2 segundos de segurança)
    if (decodedText === ultimoCodigoLido && (agora - ultimaLeituraTime) < 2000) {
        return; 
    }

    ultimaLeituraTime = agora;
    ultimoCodigoLido = decodedText;
    
    console.log(`█║▌ Código detectado com sucesso: ${decodedText}`);
    
    // Chamar a função agora com segurança
    vibrarOuBipar();

    try {
        const produtosRef = collection(db, "produtos");
        const q = query(produtosRef, where("qr_code", "==", decodedText));
        const querySnapshot = await getDocs(q);

        if (querySnapshot.empty) {
            alert(`⚠️ Código [${decodedText}] não encontrado no Firebase! Verifique o cadastro do produto.`);
            return;
        }

        const docProduto = querySnapshot.docs[0];
        const idProduto = docProduto.id;
        const dadosProduto = docProduto.data();

        const estoqueAtual = Number(dadosProduto.estoque) || 0;
        if (estoqueAtual < 1) {
            alert(`⚠️ Estoque esgotado para: ${dadosProduto.nome || "Produto"}`);
            return;
        }

        const precoVenda = Number(dadosProduto.preco_venda) || 0;
        const precoCusto = Number(dadosProduto.preco_custo) || 0;
        const faturamento = precoVenda;
        const lucro = faturamento - precoCusto;
        const categoriaProduto = dadosProduto.categoria || "Geral";
        const nomeProduto = dadosProduto.nome || "Produto Sem Nome";

        console.log(`📤 Gravando venda automática de 1 unidade para: ${nomeProduto}`);

        // Salva venda mestre
        const novaVendaRef = await addDoc(collection(db, "vendas"), {
            faturamento_total: faturamento,
            lucro_total: lucro,
            criado_em: serverTimestamp()
        });

        // Vincula item
        await addDoc(collection(db, "vendas", novaVendaRef.id, "itens"), {
            produto_id: idProduto,
            quantidade: 1,
            preco_venda_momento: precoVenda,
            preco_custo_momento: precoCusto,
            categoria_momento: categoriaProduto
        });

        // Baixa no estoque
        await updateDoc(doc(db, "produtos", idProduto), {
            estoque: increment(-1)
        });

        alert(`✅ VENDA CONCLUÍDA!\nProduto: ${nomeProduto}\nEstoque Atualizado!`);
        
        document.dispatchEvent(new Event("vendaAtualizada"));

    } catch (error) {
        console.error("Erro fatal no fluxo do Firebase:", error);
        alert("🚨 Erro Crítico no Firebase: " + error.message);
    }
}

function pararScanner() {
    console.log("🔌 [Scanner] Solicitando desligamento da câmera...");

    if (containerCamera) containerCamera.style.display = "none";
    if (btnCamera) {
        btnCamera.innerText = "📷 Ligar Scanner Contínuo";
        btnCamera.style.background = ""; 
    }
    estaEscaneando = false;

    if (html5QrcodeScanner) {
        html5QrcodeScanner.stop()
            .then(() => {
                console.log("✅ [Scanner] Câmera desligada com sucesso.");
                html5QrcodeScanner = null; 
            })
            .catch(err => {
                console.warn("⚠️ [Scanner] Aviso ao parar hardware da câmera:", err);
                html5QrcodeScanner = null;
            });
    }
}

// 🔊 FUNÇÃO ADICIONADA PARA EVITAR O TRAVAMENTO DO CÓDIGO
function vibrarOuBipar() {
    try {
        if (navigator.vibrate) {
            navigator.vibrate(100); // Dá uma tremidinha de confirmação no celular
        }
    } catch (e) {
        console.warn("Vibração não suportada pelo navegador.");
    }
}