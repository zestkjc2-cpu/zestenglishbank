import { supabase } from './supabaseClient.js';

document.addEventListener('DOMContentLoaded', () => {
    // Modal Logic
    const loginModal = document.getElementById('loginModal');
    const loginBtn = document.getElementById('loginBtn');
    const entryLoginBtn = document.getElementById('entryLoginBtn');
    const closeModals = document.querySelectorAll('.close-modal');

    function openModal(modal) {
        if(modal) modal.classList.add('active');
    }

    function closeModal(modal) {
        if(modal) modal.classList.remove('active');
    }

    if(loginBtn) {
        loginBtn.addEventListener('click', (e) => {
            e.preventDefault();
            openModal(loginModal);
        });
    }

    if(entryLoginBtn) {
        entryLoginBtn.addEventListener('click', (e) => {
            e.preventDefault();
            openModal(loginModal);
        });
    }

    closeModals.forEach(btn => {
        btn.addEventListener('click', () => {
            closeModal(loginModal);
        });
    });

    // Close on overlay click
    window.addEventListener('click', (e) => {
        if (e.target.classList.contains('modal-overlay')) {
            e.target.classList.remove('active');
        }
    });

    // Mobile Menu Toggle
    const mobileMenuBtn = document.querySelector('.mobile-menu-btn');
    const navList = document.querySelector('.nav-list');
    
    if (mobileMenuBtn && navList) {
        mobileMenuBtn.addEventListener('click', () => {
            mobileMenuBtn.classList.toggle('active');
            navList.classList.toggle('active');
        });
        
        // Close mobile menu when clicking a link
        const navLinks = document.querySelectorAll('.nav-link');
        navLinks.forEach(link => {
            link.addEventListener('click', () => {
                mobileMenuBtn.classList.remove('active');
                navList.classList.remove('active');
            });
        });
    }

    // ── Supabase Authentication ──────────────────────────────────────────
    const loginForm = document.getElementById('loginForm');
    const loginEmail = document.getElementById('loginEmail');
    const loginPassword = document.getElementById('loginPassword');
    const loginError = document.getElementById('loginError');

    // Email / Password Login
    if (loginForm) {
        loginForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            if(loginError) loginError.textContent = '';
            const { data, error } = await supabase.auth.signInWithPassword({
                email: loginEmail.value.trim(),
                password: loginPassword.value,
            });
            if (error) {
                if(loginError) loginError.textContent = '로그인 실패: ' + error.message;
            } else {
                window.location.href = 'dashboard.html';
            }
        });
    }

    // 제스트 회원가입하기 – open email signup page / prompt
    const signupZest = document.getElementById('signupZest');
    if(signupZest) {
        signupZest.addEventListener('click', async () => {
            const email = prompt('가입할 이메일을 입력하세요:');
            const password = prompt('사용할 비밀번호를 입력하세요 (6자 이상):');
            if (!email || !password) return;
            const { error } = await supabase.auth.signUp({ email, password });
            if (error) {
                alert('회원가입 실패: ' + error.message);
            } else {
                alert('회원가입 완료! 이메일을 확인해 주세요.');
            }
        });
    }

    // Google OAuth
    const loginGoogle = document.getElementById('loginGoogle');
    if(loginGoogle) {
        loginGoogle.addEventListener('click', async () => {
            const { error } = await supabase.auth.signInWithOAuth({
                provider: 'google',
                options: { redirectTo: window.location.origin + '/dashboard.html' }
            });
            if(error) alert('구글 로그인 오류: ' + error.message);
        });
    }

    // Facebook OAuth
    const loginFacebook = document.getElementById('loginFacebook');
    if(loginFacebook) {
        loginFacebook.addEventListener('click', async () => {
            const { error } = await supabase.auth.signInWithOAuth({
                provider: 'facebook',
                options: { redirectTo: window.location.origin + '/dashboard.html' }
            });
            if(error) alert('페이스북 로그인 오류: ' + error.message);
        });
    }

    // Search Functionality
    const searchInput = document.getElementById('searchInput');
    const searchBtn = document.getElementById('searchBtn');

    function performSearch() {
        if(searchInput && searchInput.value.trim() !== '') {
            const query = encodeURIComponent(searchInput.value.trim());
            window.location.href = `https://www.google.com/search?q=${query}`;
        }
    }

    if(searchBtn) {
        searchBtn.addEventListener('click', performSearch);
    }

    if(searchInput) {
        searchInput.addEventListener('keypress', (e) => {
            if(e.key === 'Enter') {
                performSearch();
            }
        });
    }

    // Ticker Logic
    const tickerList = document.getElementById('noticeTicker');
    if (tickerList) {
        const items = tickerList.querySelectorAll('li');
        const itemHeight = 24;
        let currentIndex = 0;

        if (items.length > 1) {
            const firstClone = items[0].cloneNode(true);
            tickerList.appendChild(firstClone);
            
            setInterval(() => {
                currentIndex++;
                tickerList.style.transition = 'transform 0.5s ease-in-out';
                tickerList.style.transform = `translateY(-${currentIndex * itemHeight}px)`;

                if (currentIndex === items.length) {
                    setTimeout(() => {
                        tickerList.style.transition = 'none';
                        tickerList.style.transform = `translateY(0)`;
                        currentIndex = 0;
                    }, 500);
                }
            }, 3000);
        }
    }
});
