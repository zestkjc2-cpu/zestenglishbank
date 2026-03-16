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

    // Intercept Gated Buttons on Home Page
    const entryFreeBtn = document.getElementById('entryFreeBtn');
    const converterBtn = document.getElementById('converterBtn');
    const questionGenBtn = document.getElementById('questionGenBtn');

    async function handleGatedLink(e, url) {
        e.preventDefault();
        const { data: { session } } = await supabase.auth.getSession();
        if (session) {
            window.location.href = url;
        } else {
            alert('로그인이 필요한 서비스입니다.');
            openModal(loginModal);
        }
    }

    if(entryFreeBtn) entryFreeBtn.addEventListener('click', (e) => handleGatedLink(e, 'trial.html'));
    if(converterBtn) converterBtn.addEventListener('click', (e) => handleGatedLink(e, 'converter.html'));
    if(questionGenBtn) questionGenBtn.addEventListener('click', (e) => handleGatedLink(e, 'question_gen.html'));

    closeModals.forEach(btn => {
        btn.addEventListener('click', () => {
             const modal = btn.closest('.modal-overlay');
             closeModal(modal);
        });
    });

    // ── Session Check & Logout Logic ──────────────────────────────────────
    async function checkSession() {
        const { data: { session } } = await supabase.auth.getSession();
        
        const updateBtn = (btn, text, isLogout = false) => {
            if (!btn) return;
            if (isLogout) {
                btn.innerHTML = text;
                btn.onclick = async (e) => {
                    e.preventDefault();
                    if (confirm('로그아웃 하시겠습니까?')) {
                        const { error } = await supabase.auth.signOut();
                        if (error) alert('로그아웃 오류: ' + error.message);
                        else window.location.href = 'index.html';
                    }
                };
            } else {
                btn.innerHTML = text;
            }
        };

        // All elements that should toggle Orange -> Indigo
        const dynamicBtns = [
            loginBtn, 
            entryLoginBtn, 
            document.querySelector('.zest-brand'),
            document.getElementById('searchBtn'),
            document.getElementById('modalSubmitBtn'), 
            document.getElementById('signupZest')
        ];

        if (session) {
            // Change Nav Login to Logout
            updateBtn(loginBtn, 'Logout', true);
            // Change Hero Login to Logout
            updateBtn(entryLoginBtn, '로그아웃 <span>👤</span>', true);
            dynamicBtns.forEach(btn => btn && btn.classList.add('logged-in'));
        } else {
            dynamicBtns.forEach(btn => btn && btn.classList.remove('logged-in'));
            // Auto open login modal if requested via URL
            const urlParams = new URLSearchParams(window.location.search);
            if (urlParams.get('login') === 'true') {
                setTimeout(() => {
                    alert('로그인이 필요한 서비스입니다.');
                    openModal(loginModal);
                }, 500);
            }
        }
    }

    checkSession();

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
                window.location.reload();
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
                options: { redirectTo: window.location.origin + '/trial.html' }
            });
            if(error) alert('구글 로그인 오류: ' + error.message);
        });
    }

    // Naver OAuth
    const loginNaver = document.getElementById('loginNaver');
    if(loginNaver) {
        loginNaver.addEventListener('click', async () => {
            const { error } = await supabase.auth.signInWithOAuth({
                provider: 'naver',
                options: { redirectTo: window.location.origin + '/trial.html' }
            });
            if(error) alert('네이버 로그인 오류: ' + error.message);
        });
    }


    // Search Functionality
    const searchInput = document.getElementById('searchInput');
    const searchBtn = document.getElementById('searchBtn');
    const searchResultsModal = document.getElementById('searchResultsModal');
    const searchResultsContent = document.getElementById('searchResultsContent');
    const searchCount = document.getElementById('searchCount');

    async function performSearch() {
        if (!searchInput || searchInput.value.trim() === '') return;
        
        const term = searchInput.value.trim();
        searchCount.textContent = `'${term}' 검색 중...`;
        searchResultsContent.innerHTML = '<tr><td colspan="3" class="loading-msg">🔍 자료를 검색하는 중...</td></tr>';
        openModal(searchResultsModal);

        // Fetch session for download permission check
        const { data: { session } } = await supabase.auth.getSession();

        const { data, error } = await supabase
            .from('files')
            .select('*')
            .ilike('title', `%${term}%`)
            .order('created_at', { ascending: false });

        if (error) {
            searchResultsContent.innerHTML = `<tr><td colspan="3" class="loading-msg" style="color:red;">오류 발생: ${error.message}</td></tr>`;
            return;
        }

        if (!data || data.length === 0) {
            searchCount.textContent = `'${term}'에 대한 검색 결과가 없습니다.`;
            searchResultsContent.innerHTML = '<tr><td colspan="3" class="loading-msg">검색 결과가 없습니다.</td></tr>';
            return;
        }

        searchCount.textContent = `'${term}'에 대해 ${data.length}개의 자료를 찾았습니다.`;
        searchResultsContent.innerHTML = '';
        
        data.forEach((file, i) => {
            const ext = file.file_path.split('.').pop().toLowerCase();
            const badgeClass = ext === 'pdf' ? 'badge-pdf' : ext === 'hwp' ? 'badge-hwp' : 'badge-docx';
            const { data: urlData } = supabase.storage.from('documents').getPublicUrl(file.file_path);

            let actionHtml = '';
            if (session) {
                actionHtml = `<a class="download-btn" href="${urlData.publicUrl}" download target="_blank">↓ 다운로드</a>`;
            } else {
                actionHtml = `<button class="lock-btn" onclick="document.getElementById('loginModal').classList.add('active')">🔒 로그인 필요</button>`;
            }

            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td>${i + 1}</td>
                <td class="title-cell"><span class="badge-type ${badgeClass}">${ext.toUpperCase()}</span>${file.title}</td>
                <td>${actionHtml}</td>
            `;
            searchResultsContent.appendChild(tr);
        });
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
        const itemHeight = 36;
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

        // Click logic for ticker items
        tickerList.addEventListener('click', async (e) => {
            const li = e.target.closest('li');
            if (!li) return;

            const category = li.getAttribute('data-category');
            if (!category) return;

            const { data: { session } } = await supabase.auth.getSession();
            if (session || category === 'Manual') {
                window.location.href = `board.html?category=${category}`;
            } else {
                const loginModal = document.getElementById('loginModal');
                if (loginModal) {
                    alert('로그인이 필요한 서비스입니다.');
                    loginModal.classList.add('active');
                }
            }
        });
    }
});
