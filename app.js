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

    // Handle Form Submit to change pages
    const loginForm = document.querySelector('.login-form');
    if (loginForm) {
        loginForm.addEventListener('submit', (e) => {
            e.preventDefault(); // Prevent page reload
            window.location.href = 'dashboard.html'; // Navigate to the new page
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
        const itemHeight = 24; // matches CSS height
        let currentIndex = 0;

        // Clone the first item and append to the end for smooth looping
        if (items.length > 1) {
            const firstClone = items[0].cloneNode(true);
            tickerList.appendChild(firstClone);
            
            setInterval(() => {
                currentIndex++;
                tickerList.style.transition = 'transform 0.5s ease-in-out';
                tickerList.style.transform = `translateY(-${currentIndex * itemHeight}px)`;

                // Reset position after reaching the clone
                if (currentIndex === items.length) {
                    setTimeout(() => {
                        tickerList.style.transition = 'none';
                        tickerList.style.transform = `translateY(0)`;
                        currentIndex = 0;
                    }, 500); // Wait for transition to finish
                }
            }, 3000);
        }
    }
});
