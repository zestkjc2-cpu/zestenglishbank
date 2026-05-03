// question_gen.js - English Exam Question Generator Engine
import { authService } from './src/services/apiService.js';
import { analyzePassage, generatePreviewItems } from './src/utils/questionEngine.js';

const generateBtn = document.getElementById('generateBtn');
const passageInput = document.getElementById('passageInput');
const resultSection = document.getElementById('resultSection');
const questionsContainer = document.getElementById('questionsContainer');
const exportBtn = document.getElementById('exportBtn');
const optionCards = document.querySelectorAll('.option-card');

const showTypeDescBtn = document.getElementById('showTypeDesc');
const typeDescModal = document.getElementById('typeDescModal');
const closeModals = document.querySelectorAll('.close-modal');

const previewModal = document.getElementById('previewModal');
const previewContainer = document.getElementById('previewContainer');
const confirmAddBtn = document.getElementById('confirmAddBtn');

const recommendBtn = document.getElementById('recommendBtn');

let selectedTypes = ['대의 파악']; // Default to first type
let generatedData = [];
let previewBuffer = [];
let currentTransMode = 'original';

// AI Recommendation Logic
if (recommendBtn) {
    recommendBtn.addEventListener('click', analyzePassageAndRecommend);
}

// Passage Transformation Tab Logic
const transTabs = document.querySelectorAll('.trans-tab');
transTabs.forEach(tab => {
    tab.addEventListener('click', (e) => {
        transTabs.forEach(t => t.classList.remove('active'));
        e.target.classList.add('active');
        currentTransMode = e.target.getAttribute('data-mode');
    });
});

function analyzePassageAndRecommend() {
    const text = passageInput.value.trim();
    if (!text) {
        alert('분석할 지문을 먼저 입력해주세요.');
        return;
    }

    recommendBtn.disabled = true;
    recommendBtn.innerText = "분석 중...";

    setTimeout(() => {
        document.querySelectorAll('.options-grid-detailed input[type="checkbox"]').forEach(cb => cb.checked = false);

        const { recommendedCategories, recommendedSubItems } = analyzePassage(text);

        document.querySelectorAll('.main-cat-check').forEach(main => {
            const type = main.getAttribute('data-type');
            if (recommendedCategories.includes(type)) {
                main.checked = true;
            }
        });

        recommendedSubItems.forEach(subItem => checkSubItem(subItem));

        recommendBtn.disabled = false;
        recommendBtn.innerText = "AI 추천 유형 분석 🔍";
        
        const anyChecked = document.querySelectorAll('.sub-items input[type="checkbox"]:checked').length > 0;
        if (!anyChecked) {
            const mainDae = document.querySelector('.main-cat-check[data-type="대의 파악"]');
            if (mainDae) mainDae.checked = true;
            checkSubItem("주제/제목/요지/주장 찾기");
        }

        alert('지문 분석 결과, 가장 적합한 문제 유형들이 선택되었습니다! ✨');
    }, 1000);
}

function checkSubItem(value) {
    const cb = document.querySelector(`.sub-items input[value="${value}"]`);
    if (cb) {
        cb.checked = true;
        // Also ensure parent is checked
        const group = cb.closest('.category-group');
        const main = group.querySelector('.main-cat-check');
        if (main) main.checked = true;
    }
}

// ... syncUI exists above ...

// Modal Logic
if (showTypeDescBtn) {
    showTypeDescBtn.addEventListener('click', () => {
        typeDescModal.classList.add('active');
    });
}

closeModals.forEach(btn => {
    btn.addEventListener('click', () => {
        const modal = btn.closest('.modal-overlay');
        if (modal) modal.classList.remove('active');
    });
});

const pdfPrintBtn = document.getElementById('pdfPrintBtn');

// Handle Main Category Checkbox Sync
document.querySelectorAll('.main-cat-check').forEach(mainCheck => {
    mainCheck.addEventListener('change', (e) => {
        const group = e.target.closest('.category-group');
        const subChecks = group.querySelectorAll('.sub-items input[type="checkbox"]');
        subChecks.forEach(sub => sub.checked = e.target.checked);
    });
});

// Update sub-item behavior (uncheck main if all sub unchecked)
document.querySelectorAll('.sub-items input[type="checkbox"]').forEach(subCheck => {
    subCheck.addEventListener('change', (e) => {
        const group = e.target.closest('.category-group');
        const mainCheck = group.querySelector('.main-cat-check');
        const subChecks = group.querySelectorAll('.sub-items input[type="checkbox"]');
        const anyChecked = Array.from(subChecks).some(c => c.checked);
        mainCheck.checked = anyChecked;
    });
});

generateBtn.addEventListener('click', () => {
    const text = passageInput.value.trim();
    if (!text) {
        alert('지문을 입력해주세요.');
        return;
    }
    
    // Collect selected sub-types
    selectedTypes = [];
    document.querySelectorAll('.sub-items input[type="checkbox"]:checked').forEach(cb => {
        selectedTypes.push(cb.parentElement.textContent.trim());
    });

    if (selectedTypes.length === 0) {
        alert('한 개 이상의 문제 유형을 선택해주세요.');
        return;
    }

    // Add a slight "processing" feel
    generateBtn.disabled = true;
    generateBtn.innerText = "생성 중...";
    
    setTimeout(() => {
        startPreviewGeneration(text);
        generateBtn.disabled = false;
        generateBtn.innerText = "변형문제 생성하기 🚀";
    }, 800);
});

function startPreviewGeneration(text) {
    previewBuffer = [];
    previewContainer.innerHTML = '';
    
    const generated = generatePreviewItems(text, selectedTypes, currentTransMode);
    
    generated.forEach((q, idx) => {
        previewBuffer.push(q);
        renderPreviewItem(q, `${idx + 1}. ${q.typeTitle || '변형문제'}`);
    });

    previewModal.classList.add('active');
}

function renderPreviewItem(q, title) {
    const div = document.createElement('div');
    div.className = 'preview-item';
    div.style.marginBottom = '25px';
    div.style.padding = '15px';
    div.style.border = '1px solid var(--border)';
    div.style.borderRadius = '10px';
    
    let html = `<h4 style="margin-bottom:10px; color:var(--primary);">${title}</h4>`;
    if (q.question) html += `<p style="font-weight:600; margin-bottom:10px;">${q.question}</p>`;
    html += `<div style="background:#f8fafc; padding:15px; border-radius:8px; margin-bottom:10px; font-size:0.95rem;">${q.passage}</div>`;
    
    if (q.options) {
        html += `<div style="display:grid; grid-template-columns: 1fr; gap:5px; margin-bottom:10px;">`;
        q.options.forEach((opt, i) => {
            html += `<div style="font-size:0.9rem;">${['①','②','③','④','⑤'][i]} ${opt}</div>`;
        });
        html += `</div>`;
    }
    
    if (q.box) html += `<div style="border:1px solid #ccc; padding:10px; margin-bottom:10px; font-size:0.9rem;"><strong>&lt;보기&gt;</strong><br>${q.box}</div>`;
    html += `<div style="font-size:0.85rem; color:#059669; font-weight:600;">정답: ${q.answer}</div>`;
    
    div.innerHTML = html;
    previewContainer.appendChild(div);
}

confirmAddBtn.addEventListener('click', () => {
    previewBuffer.forEach(q => {
        generatedData.push(q);
        renderQuestion(q, q.typeTitle || "변형문제", generatedData.length);
    });
    
    previewModal.classList.remove('active');
    resultSection.style.display = 'block'; 
    setTimeout(() => {
        resultSection.scrollIntoView({ behavior: 'smooth' });
    }, 100);
});



function renderQuestion(q, title, number) {
    const div = document.createElement('div');
    div.className = 'question-item';
    
    let html = `<h4><small style="color:var(--text-muted);">Question ${number}.</small> ${title}</h4>`;
    if (q.question) html += `<p class="question-text">${q.question}</p>`;
    html += `<div class="passage-box">${q.passage}</div>`;
    
    if (q.options) {
        html += `<div style="margin-bottom:15px; display:grid; gap:5px;">`;
        q.options.forEach((opt, i) => {
            html += `<div>${['①','②','③','④','⑤'][i]} ${opt}</div>`;
        });
        html += `</div>`;
    }
    
    if (q.box) html += `<div style="border:1px solid #ccc; padding:10px; margin-bottom:10px;"><strong>&lt;보기&gt;</strong><br>${q.box}</div>`;
    html += `<div class="answer-key">정답: ${q.answer}</div>`;
    
    div.innerHTML = html;
    questionsContainer.appendChild(div);
}

// PDF Print Functionality
if (pdfPrintBtn) {
    pdfPrintBtn.addEventListener('click', () => {
        window.print();
    });
}

// Export to DOCX
exportBtn.addEventListener('click', async () => {
    const docxLib = window.docx || (typeof docx !== 'undefined' ? docx : null);
    
    if (!docxLib) {
        alert('Word 라이브러리를 불러오지 못했습니다. 페이지를 새로고침 해주세요.');
        return;
    }

    // Handle .default property
    const { Document, Packer, Paragraph, TextRun, HeadingLevel, AlignmentType } = docxLib.Document ? docxLib : (docxLib.default || docxLib);
    
    if (!Document || !Packer) {
        alert('Word 라이브러리 초기화 실패. 페이지를 새로고침 해주세요.');
        return;
    }

    const sections = generatedData.map(q => {
        const children = [
            new Paragraph({ text: "변형문제", heading: HeadingLevel.HEADING_1, alignment: AlignmentType.CENTER }),
            new Paragraph({ text: "" }),
            new Paragraph({ children: [new TextRun({ text: "[지문]", bold: true })] }),
            new Paragraph({ text: q.passage, border: { bottom: { color: "auto", space: 1, value: "single", size: 6 } } }),
            new Paragraph({ text: "" }),
            new Paragraph({ children: [new TextRun({ text: "정답: ", bold: true }), new TextRun(q.answer)] }),
            new Paragraph({ text: "", pageBreakBefore: true })
        ];
        return children;
    }).flat();

    const doc = new Document({
        sections: [{
            children: sections
        }]
    });

    const blob = await Packer.toBlob(doc);
    saveAs(blob, "제스트_변형문제.docx");
});
