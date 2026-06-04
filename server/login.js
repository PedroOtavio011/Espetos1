// login.js
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import { getAuth, signInWithEmailAndPassword } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";

// COLE AQUI AS SUAS CHAVES DO PASSO 0
const firebaseConfig = {
  apiKey: "AIzaSyC3BV2K0x4n0OOUfiFLBR6-fX-7DwGVSGA",
  authDomain: "espetos.firebaseapp.com",
  databaseURL: "https://espetos-default-rtdb.firebaseio.com",
  projectId: "espetos",
  storageBucket: "espetos.firebasestorage.app",
  messagingSenderId: "112705479220",
  appId: "1:112705479220:web:81741585cb73f919ede061",
  measurementId: "G-R3Y2PJ10DM"
};

// Inicializa o Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);

// Mapeia os elementos do HTML
const inputLogin = document.getElementById('login');
const inputSenha = document.getElementById('senha');
const btnAcessar = document.getElementById('btnAcessar');

btnAcessar.addEventListener('click', async () => {
    const email = inputLogin.value;
    const senha = inputSenha.value;

    if (!email || !senha) {
        alert("Por favor, preencha todos os campos.");
        return;
    }

    try {
        // Faz o login no Firebase com o usuário que você criou no painel
        await signInWithEmailAndPassword(auth, email, senha);
        
        // Se o login der certo, redireciona para a Dashboard
        window.location.href = "dashBoard.html";
    } catch (error) {
        console.error("Erro ao autenticar: ", error);
        alert("Login ou senha incorretos.");
    }
});