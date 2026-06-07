/**
 * Header.js
 * 
 * ZEST EXAM MASTER common header component.
 * Handles dynamic rendering and auth state synchronization.
 */
import { authService } from '../services/apiService.js';

export class Header {
    constructor(options = {}) {
        this.options = options;
        this.init();
    }

    async init() {
        this.render();
        this.attachEvents();
        await this.syncAuthState();
    }

    render() {
        // Find existing header or create one
        let headerEl = document.querySelector('header.header');
        const headerHTML = `
            <div class="container nav-container">
                <a href="index.html" class="brand-logo">
                    <span class="zest-brand">ZEST EXAM MASTER</span>
                </a>

                <nav class="main-nav">
                    <div class="header-actions">
                        <a href="board.html?category=Manual" class="nav-link gray-btn">사용안내</a>
                        <a href="#" class="nav-link auth-dynamic-btn" id="loginBtn">Login</a>
                    </div>
                    <ul class="nav-list" style="display:none;">
                    </ul>
                </nav>
                <button class="mobile-menu-btn" aria-label="Toggle Menu">
                    <span></span>
                    <span></span>
                    <span></span>
                </button>
            </div>
        `;

        if (headerEl) {
            headerEl.innerHTML = headerHTML;
        } else {
            headerEl = document.createElement('header');
            headerEl.className = 'header';
            headerEl.innerHTML = headerHTML;
            document.body.prepend(headerEl);
        }
        this.headerEl = headerEl;
    }

    attachEvents() {
        const mobileMenuBtn = this.headerEl.querySelector('.mobile-menu-btn');
        const mainNav = this.headerEl.querySelector('.main-nav');

        if (mobileMenuBtn && mainNav) {
            mobileMenuBtn.addEventListener('click', () => {
                mobileMenuBtn.classList.toggle('active');
                mainNav.classList.toggle('active');
            });
        }
    }

    async syncAuthState() {
        const loginBtn = document.getElementById('loginBtn');
        if (!loginBtn) return;

        try {
            const { data: { session } } = await authService.getSession();
            
            if (session) {
                loginBtn.textContent = 'Logout';
                loginBtn.id = 'logoutBtn'; // ID change to match app.js logic if needed, or just use class
                loginBtn.addEventListener('click', async (e) => {
                    e.preventDefault();
                    if (confirm('로그아웃 하시겠습니까?')) {
                        await authService.signOut();
                        window.location.reload();
                    }
                });
                
                // Add "logged-in" class for styling (Toss-style highlights)
                const brand = document.querySelector('.zest-brand');
                if (brand) brand.classList.add('logged-in');
            } else {
                loginBtn.addEventListener('click', (e) => {
                    e.preventDefault();
                    const loginModal = document.getElementById('loginModal');
                    if (loginModal) loginModal.classList.add('active');
                });
            }
        } catch (error) {
            console.error('Auth sync error:', error);
        }
    }
}

// Auto-initialize if not imported as a class (optional, but good for quick migration)
// new Header();
