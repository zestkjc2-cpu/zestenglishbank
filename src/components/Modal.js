/**
 * Modal.js
 * 
 * ZEST ENGLISH BANK common modal component.
 * Handles rendering and form submission for login and other popups.
 */
import { authService } from '../services/apiService.js';

export class LoginModal {
    constructor() {
        this.render();
        this.attachEvents();
    }

    render() {
        if (document.getElementById('loginModal')) return;

        const modalOverlay = document.createElement('div');
        modalOverlay.className = 'modal-overlay';
        modalOverlay.id = 'loginModal';
        modalOverlay.innerHTML = `
            <div class="modal-content">
                <button class="close-modal" aria-label="Close Modal">&times;</button>
                <div class="modal-header">
                    <h2 class="modal-title">Welcome Back</h2>
                    <p class="modal-subtitle">로그인하여 모든 자료를 이용하세요.</p>
                </div>
                <form id="loginForm" class="login-form">
                    <div class="form-group">
                        <label for="email">Email Address</label>
                        <input type="email" id="email" placeholder="name@company.com" required>
                    </div>
                    <div class="form-group">
                        <label for="password">Password</label>
                        <input type="password" id="password" placeholder="••••••••" required>
                    </div>
                    <button type="submit" class="btn btn-primary btn-full">Sign In</button>
                    
                    <div class="social-login-separator">
                        <span>OR</span>
                    </div>
                    
                    <div class="social-login-grid">
                        <button type="button" id="loginGoogle" class="btn btn-outline btn-full">Google Login</button>
                        <button type="button" id="loginNaver" class="btn btn-outline btn-full" style="background:#03C75A; color:white; border:none;">Naver Login</button>
                    </div>
                </form>
                <div class="modal-footer">
                    <p>계정이 없으신가요? <a href="#" id="signupZest">회원가입 요청</a></p>
                </div>
            </div>
        `;
        document.body.appendChild(modalOverlay);
        this.modalEl = modalOverlay;
    }

    attachEvents() {
        const closeBtn = this.modalEl.querySelector('.close-modal');
        const loginForm = this.modalEl.querySelector('#loginForm');
        const loginGoogle = this.modalEl.querySelector('#loginGoogle');
        const loginNaver = this.modalEl.querySelector('#loginNaver');
        const signupZest = this.modalEl.querySelector('#signupZest');

        closeBtn.addEventListener('click', () => {
            this.modalEl.classList.remove('active');
        });

        // Close on overlay click
        this.modalEl.addEventListener('click', (e) => {
            if (e.target === this.modalEl) {
                this.modalEl.classList.remove('active');
            }
        });

        // Email / Password Login
        loginForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const email = loginForm.querySelector('#email').value;
            const password = loginForm.querySelector('#password').value;
            const submitBtn = loginForm.querySelector('button[type="submit"]');

            try {
                submitBtn.disabled = true;
                submitBtn.textContent = 'Signing in...';
                const { data, error } = await authService.signIn(email, password);
                if (error) throw error;
                window.location.reload(); 
            } catch (error) {
                alert('로그인 실패: ' + (error.message || '이메일 또는 비밀번호를 확인하세요.'));
            } finally {
                submitBtn.disabled = false;
                submitBtn.textContent = 'Sign In';
            }
        });

        // Google OAuth
        loginGoogle.addEventListener('click', async () => {
            const { error } = await authService.signInWithOAuth('google');
            if(error) alert('구글 로그인 오류: ' + error.message);
        });

        // Naver OAuth
        loginNaver.addEventListener('click', async () => {
            const { error } = await authService.signInWithOAuth('naver');
            if(error) alert('네이버 로그인 오류: ' + error.message);
        });

        // Signup Request
        signupZest.addEventListener('click', async (e) => {
            e.preventDefault();
            const email = prompt('가입할 이메일을 입력하세요:');
            const password = prompt('사용할 비밀번호를 입력하세요 (6자 이상):');
            if (!email || !password) return;
            const { error } = await authService.signUp(email, password);
            if (error) {
                alert('회원가입 실패: ' + error.message);
            } else {
                alert('회원가입 완료! 이메일을 확인해 주세요.');
            }
        });
    }

    show() {
        this.modalEl.classList.add('active');
    }
}
