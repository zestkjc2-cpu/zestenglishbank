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

let selectedTypes = ['대의 파악']; // Default to first type
let generatedData = [];
let previewBuffer = [];

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

// Handle Option Card Selection
optionCards.forEach(card => {
    card.addEventListener('click', () => {
        const type = card.dataset.type;
        const checkbox = card.querySelector('input');
        
        card.classList.toggle('active');
        checkbox.checked = !checkbox.checked;
        
        if (card.classList.contains('active')) {
            if (!selectedTypes.includes(type)) selectedTypes.push(type);
        } else {
            selectedTypes = selectedTypes.filter(t => t !== type);
        }
    });
});

generateBtn.addEventListener('click', () => {
    const text = passageInput.value.trim();
    if (!text) {
        alert('지문을 입력해주세요.');
        return;
    }
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
    
    selectedTypes.forEach((type, idx) => {
        let q;
        if (type === '대의 파악') {
            q = createMultipleChoiceQuestion(text, "대의 파악 (Main Idea)");
        } else if (type === '논리적 흐름') {
            q = createOrderingQuestion(text);
        } else if (type === '세부 정보 및 추론') {
            q = createMultipleChoiceQuestion(text, "세부 정보 및 추론 (Detail Check)");
        } else if (type === '어법 및 어휘') {
            q = createGrammarQuestion(text);
        } else if (type === '서술형') {
            q = createSubjectiveQuestion(text);
        }
        
        if (q) {
            previewBuffer.push(q);
            renderPreviewItem(q, `추천 문항 ${idx + 1}: ${type}`);
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
    // Clear container if starting fresh results or append if desired. 
    // User requested "Add to list", so we append.
    previewBuffer.forEach(q => {
        generatedData.push(q);
        renderQuestion(q, q.typeTitle || "변형문제");
    });
    
    previewModal.classList.remove('active');
    resultSection.style.display = 'block'; // Ensure it becomes visible
    setTimeout(() => {
        resultSection.scrollIntoView({ behavior: 'smooth' });
    }, 100);
});

function createMultipleChoiceQuestion(text, typeTitle) {
    const sentences = text.match(/[^\.!\?]+[\.!\?]+/g) || [text];
    const passage = sentences.slice(0, 3).join(' ') + (sentences.length > 3 ? "..." : "");
    
    return {
        type: 'multiple',
        typeTitle: typeTitle,
        question: `다음 글의 제목으로 가장 적절한 것을 고르시오.`,
        passage: passage,
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

function createGrammarQuestion(text) {
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
        typeTitle: "어법 및 어휘",
        passage: processedText,
        answer: answers.join(', ')
    };
}

function createOrderingQuestion(text) {
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
        typeTitle: "논리적 흐름 (Sentence Ordering)",
        question: `다음 밑줄 친 ( 1 )의 우리말과 일치하도록 <보기>의 단어들을 바르게 배열하시오.`,
        passage: newPassage,
        box: scrambled.join(' / '),
        answer: targetSentence
    };
}

function createSubjectiveQuestion(text) {
    const sentences = text.match(/[^\.!\?]+[\.!\?]+/g) || [text];
    const target = sentences[0].trim();
    
    return {
        type: 'subjective',
        typeTitle: "서술형 (Subjective)",
        question: `다음 지문의 주제를 10단어 내외의 영어 문장으로 요약하여 서술하시오.`,
        passage: text.substring(0, 200) + "...",
        answer: "The importance of continuous learning in the digital transformation age."
    };
}

function renderQuestion(q, title) {
    const div = document.createElement('div');
    div.className = 'question-item';
    
    let html = `<h4>${title}</h4>`;
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
