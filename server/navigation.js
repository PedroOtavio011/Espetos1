console.log("📱 [Abas] Inicializando gerenciador de navegação da Tab Bar...");

const dashboardBtn = document.querySelector('.navDashBoard');
const cadastrarProdutosBtn = document.querySelector('.navCadastrarProdutos');
const estoqueBtn = document.querySelector('.navEstoque');
const vendasBtn = document.querySelector('.navVendas');
const relatoriosBtn = document.querySelector('.navRelatorios');

// IDs apontando exatamente para os elementos em minúsculo do novo HTML
const sectionDashboard = document.getElementById('containerdashboard'); 
const sectionCadastrarProdutos = document.getElementById('containercadastro');
const sectionEstoque = document.getElementById('containerestoque');
const sectionVendas = document.getElementById('containervendas');
const sectionRelatorios = document.getElementById('containerrelatorios');

const todosOsBotoes = [dashboardBtn, cadastrarProdutosBtn, estoqueBtn, vendasBtn, relatoriosBtn];

function alternarAba(secaoAtiva, botaoAtivo) {
    if (!secaoAtiva || !botaoAtivo) {
        console.warn("⚠️ [Navegação] Erro: A seção ou o botão clicado não existem no HTML.");
        return;
    }

    // Oculta todas as seções de forma segura
    if (sectionDashboard) sectionDashboard.style.display = 'none';
    if (sectionCadastrarProdutos) sectionCadastrarProdutos.style.display = 'none';
    if (sectionEstoque) sectionEstoque.style.display = 'none';
    if (sectionVendas) sectionVendas.style.display = 'none';
    if (sectionRelatorios) sectionRelatorios.style.display = 'none';
    
    // Torna a seção desejada visível
    secaoAtiva.style.display = 'block';
    
    // Atualiza as classes visuais nos botões inferiores
    todosOsBotoes.forEach(btn => {
        if (btn) btn.classList.remove('ativo');
    });
    botaoAtivo.classList.add('ativo');
    
    console.log(`🎯 [Navegação] Mudou com sucesso para a aba: ${botaoAtivo.innerText.trim()}`);
}

// Configuração dos gatilhos de clique com tratamento de erros
if (dashboardBtn) dashboardBtn.addEventListener('click', () => alternarAba(sectionDashboard, dashboardBtn));
if (cadastrarProdutosBtn) cadastrarProdutosBtn.addEventListener('click', () => alternarAba(sectionCadastrarProdutos, cadastrarProdutosBtn));
if (estoqueBtn) estoqueBtn.addEventListener('click', () => alternarAba(sectionEstoque, estoqueBtn));
if (vendasBtn) vendasBtn.addEventListener('click', () => alternarAba(sectionVendas, vendasBtn));
if (relatoriosBtn) relatoriosBtn.addEventListener('click', () => alternarAba(sectionRelatorios, relatoriosBtn));

// Define a aba inicial correta ao abrir a aplicação
if (sectionDashboard && dashboardBtn) {
    alternarAba(sectionDashboard, dashboardBtn);
}