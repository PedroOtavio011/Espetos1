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

    // Inicializa o leitor apontando para a div do HTML (Biblioteca global carregada no head)
    html5QrcodeScanner = new Html5Qrcode("leitor-camera");

    html5QrcodeScanner.start(
        { facingMode: "environment" }, 
        {
            fps: 15, // Aumentado para ler mais rápido por segundo
            qrbox: function(viewfinderWidth, viewfinderHeight) {
                // Deixa a caixa de leitura bem maior (80% da área do visor)
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
    
    // Filtro anti-duplicação (2 segundos de segurança para o mesmo código)
    if (decodedText === ultimoCodigoLido && (agora - ultimaLeituraTime) < 2000) {
        return; 
    }

    ultimaLeituraTime = agora;
    ultimoCodigoLido = decodedText;
    
    console.log(`█║▌ Código detectado com sucesso: ${decodedText}`);
    vibrarOuBipar();

    try {
        const produtosRef = collection(db, "produtos");
        const q = query(produtosRef, where("qr_code", "==", decodedText));
        const querySnapshot = await getDocs(q);

        if (querySnapshot.empty) {
            console.warn(`⚠️ Produto com o código [${decodedText}] não está cadastrado.`);
            alert(`Código [${decodedText}] não encontrado no sistema!`);
            return;
        }

        const docProduto = querySnapshot.docs[0];
        const idProduto = docProduto.id;
        const dadosProduto = docProduto.data();

        if (dadosProduto.estoque < 1) {
            alert(`⚠️ Estoque esgotado para: ${dadosProduto.nome}`);
            return;
        }

        const faturamento = dadosProduto.preco_venda * 1;
        const custo = dadosProduto.preco_custo * 1;
        const lucro = faturamento - custo;

        console.log(`📤 Gravando venda automática de 1 unidade para: ${dadosProduto.nome}`);

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
            preco_venda_momento: dadosProduto.preco_venda,
            preco_custo_momento: dadosProduto.preco_custo,
            categoria_momento: dadosProduto.categoria
        });

        // Baixa no estoque
        await updateDoc(doc(db, "produtos", idProduto), {
            estoque: increment(-1)
        });

        console.log(`✅ Venda concluída com sucesso: 1x ${dadosProduto.nome}!`);
        
        // Dispara um evento global avisando o arquivo dashBoard.js para se atualizar sozinho no fundo
        document.dispatchEvent(new Event("vendaAtualizada"));

    } catch (error) {
        console.error("Erro no processamento do fluxo da câmera:", error);
    }
}

function pararScanner() {
    console.log("🔌 [Scanner] Solicitando desligamento da câmera...");

    // Forçamos a interface a resetar IMEDIATAMENTE para o usuário não achar que travou
    if (containerCamera) containerCamera.style.display = "none";
    if (btnCamera) {
        btnCamera.innerText = "📷 Ligar Scanner Contínuo";
        btnCamera.style.background = ""; // Remove o vermelho e volta ao padrão do CSS
    }
    estaEscaneando = false;

    // Agora desligamos o hardware da câmera em segundo plano com segurança
    if (html5QrcodeScanner) {
        html5QrcodeScanner.stop()
            .then(() => {
                console.log("✅ [Scanner] Câmera desligada e hardware liberado com sucesso.");
                html5QrcodeScanner = null; // Limpa a instância da memória
            })
            .catch(err => {
                // Mesmo se o navegador der um aviso chato ao desligar, a interface já foi resetada!
                console.warn("⚠️ [Scanner] Aviso capturado ao parar hardware da câmera (ignorado para o usuário):", err);
                html5QrcodeScanner = null;
            });
    }
}