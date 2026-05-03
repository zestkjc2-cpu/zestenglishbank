import { authService, fileService } from './src/services/apiService.js';
import { Header } from './src/components/Header.js';
import { LoginModal } from './src/components/Modal.js';

document.addEventListener('DOMContentLoaded', async () => {
    // 1. Initialize Common UI Components
    new Header();
    const loginModalComp = new LoginModal();

    // 2. Intercept Gated Buttons
    const gatedButtons = [
        { id: 'entryFreeBtn', url: 'trial.html' },
        { id: 'converterBtn', url: 'converter_select.html' },
        { id: 'questionGenBtn', url: 'question_gen.html' },
        { id: 'pdfEditBtn', url: 'pdf_editor.html' },
        { id: 'workbookBtn', url: 'workbook.html' }
    ];

    gatedButtons.forEach(btnInfo => {
        const btn = document.getElementById(btnInfo.id);
        if (btn) {
            btn.addEventListener('click', async (e) => {
                e.preventDefault();
                const { data: { session } } = await authService.getSession();
                if (session) {
                    window.location.href = btnInfo.url;
                } else {
                    window.showZestAlert('로그인이 필요한 서비스입니다.');
                    loginModalComp.show();
                }
            });
        }
    });

    // 3. Custom Alert Modal Helper (Global utility)
    window.showZestAlert = function(message) {
        let alertModal = document.getElementById('zestAlertModal');
        if (!alertModal) {
            const modalHtml = `
                <div class="modal-overlay" id="zestAlertModal">
                    <div class="glass-modal modal-mini" style="text-align: center;">
                        <div class="modal-header" style="margin-bottom: 20px;">
                            <h2 style="color: var(--text-main); font-size: 1.4rem;">알림</h2>
                            <p id="zestAlertMessage">${message}</p>
                        </div>
                        <div class="modal-actions-row">
                            <button class="btn auth-dynamic-btn" id="confirmZestAlert" style="width: 100%;">확인</button>
                        </div>
                    </div>
                </div>
            `;
            document.body.insertAdjacentHTML('beforeend', modalHtml);
            alertModal = document.getElementById('zestAlertModal');
            document.getElementById('confirmZestAlert').addEventListener('click', () => {
                alertModal.classList.remove('active');
            });
        } else {
            document.getElementById('zestAlertMessage').innerText = message;
        }
        setTimeout(() => alertModal.classList.add('active'), 10);
    };

    // 4. URL-based Login Prompt
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get('login') === 'true') {
        const { data: { session } } = await authService.getSession();
        if (!session) {
            setTimeout(() => {
                window.showZestAlert('로그인이 필요한 서비스입니다.');
                loginModalComp.show();
            }, 500);
        }
    }

    // 5. Search Functionality
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
        if (searchResultsModal) searchResultsModal.classList.add('active');

        const { data: { session } } = await authService.getSession();
        const { data, error } = await fileService.searchFiles(term);

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
            const { data: urlData } = fileService.getPublicUrl(file.file_path);

            let actionHtml = '';
            if (session) {
                actionHtml = `<a class="download-btn" href="${urlData.publicUrl}" download target="_blank">↓ 다운로드</a>`;
            } else {
                actionHtml = `<button class="lock-btn" onclick="window.showZestAlert('로그인이 필요한 서비스입니다.'); document.getElementById('loginModal').classList.add('active')">🔒 로그인 필요</button>`;
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

    if(searchBtn) searchBtn.addEventListener('click', performSearch);
    if(searchInput) searchInput.addEventListener('keypress', (e) => { if(e.key === 'Enter') performSearch(); });

    // 6. Ticker Logic
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

        tickerList.addEventListener('click', async (e) => {
            const li = e.target.closest('li');
            if (!li) return;
            const category = li.getAttribute('data-category');
            if (!category) return;

            const { data: { session } } = await authService.getSession();
            if (session || category === 'Manual') {
                window.location.href = `board.html?category=${category}`;
            } else {
                window.showZestAlert('로그인이 필요한 서비스입니다.');
                loginModalComp.show();
            }
        });
    }
});
