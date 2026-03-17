// question_gen.js - English Exam Question Generator Engine
import { supabase } from './supabaseClient.js';

const generateBtn = document.getElementById('generateBtn');
const passageInput = document.getElementById('passageInput');
const resultSection = document.getElementById('resultSection');
const questionsContainer = document.getElementById('questionsContainer');
const exportBtn = document.getElementById('exportBtn');
const optionCards = document.querySelectorAll('.option-card');

let selectedTypes = ['blank']; // Default
let generatedData = [];

// UI Sync with Auth State
async function syncUI() {
    const { data: { session } } = await supabase.auth.getSession();
    const dynamicElements = [
        document.querySelector('.zest-brand'),
        ...document.querySelectorAll('.text-orange')
    ];
    if (session) {
        dynamicElements.forEach(el => el && el.classList.add('logged-in'));
    }
}
syncUI();

// Handle Option Card Selection
optionCards.forEach(card => {
    card.addEventListener('click', () => {
        const type = card.dataset.type;
        const checkbox = card.querySelector('input');
        
        if (type === 'blank') return; // Blank is always required or handled specially

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

    generateQuestions(text);
});

function generateQuestions(text) {
    generatedData = [];
    questionsContainer.innerHTML = '';
    resultSection.style.display = 'block';

    // 1. Blank Fill Question
    if (selectedTypes.includes('blank')) {
        const q = createBlankQuestion(text);
        generatedData.push(q);
        renderQuestion(q, "유형 1: 빈칸 추론 (Blank Fill)");
    }

    // 2. Grammar Choice Question
    if (selectedTypes.includes('grammar')) {
        const q = createGrammarQuestion(text);
        generatedData.push(q);
        renderQuestion(q, "유형 2: 어법 선택 (Grammar Selection)");
    }

    // 3. Sentence Ordering Question
    if (selectedTypes.includes('ordering')) {
        const q = createOrderingQuestion(text);
        generatedData.push(q);
        renderQuestion(q, "유형 3: 문장 배열 (Sentence Ordering)");
    }

    resultSection.scrollIntoView({ behavior: 'smooth' });
}

function createBlankQuestion(text) {
    const words = text.split(/\s+/);
    const answers = [];
    const processedWords = words.map((word, index) => {
        // Simple heuristic: blank out words longer than 7 chars or specific keywords
        // In a real app, this would use a dictionary or POS tagging
        const cleanWord = word.replace(/[.,!?;:"]/g, "");
        if (cleanWord.length > 7 && Math.random() > 0.7 && answers.length < 5) {
            answers.push(cleanWord);
            return word.replace(cleanWord, `(   ${answers.length}   )`);
        }
        return word;
    });

    return {
        type: 'blank',
        passage: processedWords.join(' '),
        answer: answers.map((a, i) => `${i + 1}: ${a}`).join(', ')
    };
}

function createGrammarQuestion(text) {
    // Find common grammar points (verbs, relatives)
    // Heuristic: words ending in -ing, -ed, or common relatives
    const grammarPoints = [
        { regex: /\b(is|are|was|were)\b/gi, choices: (m) => m.toLowerCase() === 'is' || m.toLowerCase() === 'was' ? ['is', 'are'] : ['are', 'is'] },
        { regex: /\b(which|that|who)\b/gi, choices: () => ['which', 'that'] },
        { regex: /(\w+ing)\b/gi, choices: (m) => [m, m.replace('ing', 'ed')] },
    ];

    let processedText = text;
    const answers = [];

    grammarPoints.forEach(point => {
        processedText = processedText.replace(point.regex, (match) => {
            if (answers.length < 5 && Math.random() > 0.5) {
                const choices = point.choices(match);
                answers.push(match);
                return `[ ${choices[0]} / ${choices[1]} ]`;
            }
            return match;
        });
    });

    return {
        type: 'grammar',
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
        if (i === targetIdx) {
            newPassage += ` ( 1 ) `;
        } else {
            newPassage += s + " ";
        }
    });

    return {
        type: 'ordering',
        question: `다음 밑줄 친 ( 1 )의 우리말과 일치하도록 <보기>의 단어들을 바르게 배열하시오.`,
        passage: newPassage,
        box: scrambled.join(' / '),
        answer: targetSentence
    };
}

function renderQuestion(q, title) {
    const div = document.createElement('div');
    div.className = 'question-item';
    
    let html = `<h4>${title}</h4>`;
    if (q.question) html += `<p class="question-text">${q.question}</p>`;
    html += `<div class="passage-box">${q.passage}</div>`;
    if (q.box) html += `<div style="border:1px solid #ccc; padding:10px; margin-bottom:10px;"><strong>&lt;보기&gt;</strong><br>${q.box}</div>`;
    html += `<div class="answer-key">정답: ${q.answer}</div>`;
    
    div.innerHTML = html;
    questionsContainer.appendChild(div);
}

// Export to DOCX
exportBtn.addEventListener('click', async () => {
    const { Document, Packer, Paragraph, TextRun, HeadingLevel, AlignmentType } = window.docx || docx;

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
