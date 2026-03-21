// question_gen.js - English Exam Question Generator Engine
import { supabase } from './supabaseClient.js';

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

function applyPassageTransformation(text) {
    if (!text) return "";
    
    switch (currentTransMode) {
        case 'before':
            return "[Introductory Context Added] In light of modern perspectives, it is essential to consider the following background: " + text;
        case 'after':
            return text + " [Concluding Context Added] Ultimately, this highlights the broader implications of the theory discussed above.";
        case 'between':
            // Simple split and insert in middle
            const sentences = text.match(/[^\.!\?]+[\.!\?]+/g) || [text];
            if (sentences.length > 2) {
                const mid = Math.floor(sentences.length / 2);
                sentences.splice(mid, 0, " [Modified transition for internal context] Furthermore, this specific aspect suggests a deeper layer of complexity. ");
                return sentences.join("");
            }
            return text + " [Modified internally]";
        default:
            return text;
    }
}

function analyzePassageAndRecommend() {
    const text = passageInput.value.trim();
    if (!text) {
        alert('분석할 지문을 먼저 입력해주세요.');
        return;
    }

    recommendBtn.disabled = true;
    recommendBtn.innerText = "분석 중...";

    setTimeout(() => {
        // 1. Reset all checkboxes
        document.querySelectorAll('.options-grid-detailed input[type="checkbox"]').forEach(cb => cb.checked = false);

        const lowerText = text.toLowerCase();
        const recommendedCategories = [];

        // 2. Heuristic Analysis
        // Always suggest Main Idea if text is long enough
        if (text.length > 100) {
            recommendedCategories.push("대의 파악");
            checkSubItem("주제/제목/요지/주장 찾기");
        }

        // Logic Flow / Connectors
        const connectors = ["however", "therefore", "moreover", "furthermore", "instead", "nonetheless", "first", "second", "finally", "consequently"];
        if (connectors.some(word => lowerText.includes(word))) {
            recommendedCategories.push("논리적 흐름");
            checkSubItem("연결어 추론");
            checkSubItem("문장 삽입");
            checkSubItem("글의 순서 배열");
        }

        // Purpose
        const purposeWords = ["want", "please", "request", "sincerely", "inform", "announce", "offer", "purpose"];
        if (purposeWords.some(word => lowerText.includes(word))) {
            recommendedCategories.push("대의 파악");
            checkSubItem("글의 목적");
        }

        // Sentiment
        const sentimentWords = ["happy", "sad", "afraid", "scared", "beautiful", "dark", "bright", "lonely", "excited", "nervous", "angry"];
        if (sentimentWords.some(word => lowerText.includes(word))) {
            recommendedCategories.push("대의 파악");
            checkSubItem("심경 및 분위기");
        }

        // Detail / Inference
        if (text.length > 300) {
            recommendedCategories.push("세부 정보 및 추론");
            checkSubItem("내용 일치/불일치");
            checkSubItem("빈칸 추론");
        }

        // Grammar / Vocab (Almost always recommended)
        recommendedCategories.push("어법 및 어휘");
        checkSubItem("어법상 어색한/적절한 것");
        checkSubItem("문맥상 어색한/적절한 어휘");
        if (text.length > 400) checkSubItem("요약문 완성");

        // Descriptive (Subjective)
        if (text.length > 250) {
            recommendedCategories.push("서술형");
            checkSubItem("단어 배열 영작");
            checkSubItem("우리말 해석 및 요약");
        }

        // 3. Sync Main Categories
        document.querySelectorAll('.main-cat-check').forEach(main => {
            const type = main.getAttribute('data-type');
            if (recommendedCategories.includes(type)) {
                main.checked = true;
            }
        });

        recommendBtn.disabled = false;
        recommendBtn.innerText = "AI 추천 유형 분석 🔍";
        
        // Final sanity check: if nothing selected, select basic one
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
    
    // Apply transformation before generating the set
    const modifiedPassage = applyPassageTransformation(text);

    selectedTypes.forEach((type, idx) => {
        let q;
        // Map sub-types to generator functions
        if (type.includes('주제') || type.includes('목적') || type.includes('심경')) {
            q = createMultipleChoiceQuestion(modifiedPassage, type);
        } else if (type.includes('순서') || type.includes('삽입') || type.includes('무관') || type.includes('연결')) {
            q = createOrderingQuestion(modifiedPassage, type);
        } else if (type.includes('일치') || type.includes('빈칸') || type.includes('의미') || type.includes('지칭')) {
            q = createMultipleChoiceQuestion(modifiedPassage, type);
        } else if (type.includes('어법') || type.includes('어휘') || type.includes('요약')) {
            q = createGrammarQuestion(modifiedPassage, type);
        } else if (type.includes('영작') || type.includes('해석')) {
            q = createSubjectiveQuestion(modifiedPassage, type);
        } else {
            q = createMultipleChoiceQuestion(modifiedPassage, type);
        }
        
        if (q) {
            previewBuffer.push(q);
            renderPreviewItem(q, `${idx + 1}. ${type}`);
        }
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

function createMultipleChoiceQuestion(text, typeTitle) {
    return {
        type: 'multiple',
        typeTitle: typeTitle,
        question: `다음 글의 제목(또는 유형 목적)으로 가장 적절한 것을 고르시오.`,
        passage: text, // Use full text
        options: [
            "Understanding the core concept of English education",
            "The evolution of artificial intelligence in learning",
            "Innovative strategies for teaching language skills",
            "Balancing tradition and technology in classrooms",
            "Future perspectives on global communication"
        ],
        answer: "①"
    };
}

function createGrammarQuestion(text, typeTitle) {
    const grammarPoints = [
        { regex: /\b(is|are|was|were)\b/gi, choices: (m) => m.toLowerCase() === 'is' || m.toLowerCase() === 'was' ? ['is', 'are'] : ['are', 'is'] },
        { regex: /\b(which|that|who)\b/gi, choices: () => ['which', 'that'] },
        { regex: /(\w+ing)\b/gi, choices: (m) => [m, m.replace('ing', 'ed')] },
    ];

    let processedText = text;
    const answers = [];
    grammarPoints.forEach(point => {
        processedText = processedText.replace(point.regex, (match) => {
            if (answers.length < 3 && Math.random() > 0.5) {
                const choices = point.choices(match);
                answers.push(match);
                return `[ ${choices[0]} / ${choices[1]} ]`;
            }
            return match;
        });
    });

    return {
        type: 'grammar',
        typeTitle: typeTitle,
        passage: processedText,
        answer: answers.join(', ')
    };
}

function createOrderingQuestion(text, typeTitle) {
    const sentences = text.match(/[^\.!\?]+[\.!\?]+/g) || [text];
    const targetIdx = Math.floor(Math.random() * sentences.length);
    const targetSentence = sentences[targetIdx].trim();
    const words = targetSentence.replace(/[.\?]/, '').split(' ');
    const scrambled = [...words].sort(() => Math.random() - 0.5);

    let newPassage = "";
    sentences.forEach((s, i) => {
        if (i === targetIdx) newPassage += ` ( 1 ) `;
        else newPassage += s + " ";
    });

    return {
        type: 'ordering',
        typeTitle: typeTitle,
        question: `다음 밑줄 친 ( 1 )의 우리말과 일치하도록 <보기>의 단어들을 바르게 배열하시오.`,
        passage: newPassage,
        box: scrambled.join(' / '),
        answer: targetSentence
    };
}

function createSubjectiveQuestion(text, typeTitle) {
    return {
        type: 'subjective',
        typeTitle: typeTitle,
        question: `다음 지문의 주제를 10단어 내외의 영어 문장으로 요약하여 서술하시오.`,
        passage: text, // Use full text
        answer: "The importance of continuous learning in the digital transformation age."
    };
}

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
