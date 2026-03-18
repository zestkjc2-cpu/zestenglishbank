// converter.js using pdf.js and docx.js
import { supabase } from './supabaseClient.js';

const dropZone = document.getElementById('dropZone');
const fileInput = document.getElementById('fileInput');
const fileInfo = document.getElementById('fileInfo');
const defaultContent = document.querySelector('.default-content');
const selectedFileName = document.getElementById('selectedFileName');
const changeFileBtn = document.getElementById('changeFileBtn');
const convertBtn = document.getElementById('convertBtn');
const progressContainer = document.getElementById('progressContainer');
const progressBar = document.getElementById('progressBar');
const statusText = document.getElementById('statusText');

let currentFile = null;
let abortController = null;

const NARROW_MARGINS = {
    top: 567,
    right: 567,
    bottom: 567,
    left: 567,
};

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

// Event Listeners for Drop Zone
dropZone.addEventListener('click', () => fileInput.click());

dropZone.addEventListener('dragover', (e) => {
    e.preventDefault();
    dropZone.classList.add('active');
});

dropZone.addEventListener('dragleave', () => {
    dropZone.classList.remove('active');
});

dropZone.addEventListener('drop', (e) => {
    e.preventDefault();
    dropZone.classList.remove('active');
    if (e.dataTransfer.files.length > 0) {
        handleFile(e.dataTransfer.files[0]);
    }
});

fileInput.addEventListener('change', (e) => {
    if (e.target.files.length > 0) {
        handleFile(e.target.files[0]);
    }
});

changeFileBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    fileInput.click();
});

// Mode Selection UI Logic
document.querySelectorAll('input[name="convMode"]').forEach(radio => {
    radio.addEventListener('change', (e) => {
        document.querySelectorAll('.mode-option').forEach(opt => opt.classList.remove('active'));
        e.target.closest('.mode-option').classList.add('active');
    });
});

function handleFile(file) {
    if (file.type !== 'application/pdf') {
        alert('PDF 파일만 선택 가능합니다.');
        return;
    }
    currentFile = file;
    selectedFileName.textContent = file.name;
    defaultContent.style.display = 'none';
    fileInfo.style.display = 'flex';
    document.getElementById('modeSelection').style.display = 'flex';
    convertBtn.style.display = 'block';
    
    // Reset button state
    convertBtn.classList.remove('btn-stop');
    convertBtn.textContent = '워드 파일(DOCX)로 변환하기 🚀';
    
    resetProgress();
}

/**
 * Heuristic to merge lines into a single sentence for Exam Questions
 */
function reconstructParagraphs(text) {
    const lines = text.split('\n');
    let reconstructed = [];
    let currentPara = "";

    lines.forEach(line => {
        const trimmed = line.trim();
        if (!trimmed) {
            if (currentPara) reconstructed.push(currentPara);
            currentPara = "";
            return;
        }

        if (currentPara) {
            // If the previous line doesn't end with a terminal or current starts with lowercase/punctuation
            const lastChar = currentPara.slice(-1);
            const isTerminal = '.?!:)]'.includes(lastChar);
            const startsWithLower = /^[a-z가-힣0-9]/.test(trimmed) && !/^[A-Z]/.test(trimmed);

            if (!isTerminal || startsWithLower) {
                currentPara += " " + trimmed;
            } else {
                reconstructed.push(currentPara);
                currentPara = trimmed;
            }
        } else {
            currentPara = trimmed;
        }
    });
    if (currentPara) reconstructed.push(currentPara);
    return reconstructed;
}

/**
 * Process a list of items into grouped lines of text (paragraphs)
 */
function processItemsToParagraphs(items, docxComponents) {
    const { Paragraph, TextRun } = docxComponents;
    const lines = [];
    items.forEach(item => {
        const y = Math.round(item.transform[5]);
        const x = item.transform[4];
        let line = lines.find(l => Math.abs(l.y - y) < 4);
        if (!line) {
            line = { y: y, items: [] };
            lines.push(line);
        }
        line.items.push({ text: item.str, x: x, width: item.width });
    });

    lines.sort((a, b) => b.y - a.y);
    const paragraphs = [];
    lines.forEach(line => {
        line.items.sort((a, b) => a.x - b.x);
        let lineText = "";
        let lastX = -1;

        line.items.forEach(it => {
            const gap = lastX !== -1 ? (it.x - lastX) : 0;
            if (gap > 60) {
                lineText += "   " + it.text;
            } else if (gap > 2) {
                lineText += " " + it.text;
            } else {
                lineText += it.text;
            }
            lastX = it.x + it.width;
        });

        paragraphs.push(new Paragraph({
            children: [new TextRun({ text: lineText.trim(), size: 24, font: "Pretendard" })],
            spacing: { before: 200, after: 200 }
        }));
    });
    return paragraphs;
}

/**
 * Smart extraction for exam questions:
 * 1. Handles 2-column split internally
 * 2. Filters out headers/footers
 * 3. Groups items into "Question Blocks" starting with "1.", "2.", "3.", etc.
 */
async function extractQuestionBlocks(page, docxComponents) {
    const viewport = page.getViewport({ scale: 1.0 });
    const content = await page.getTextContent();
    const items = content.items;
    
    if (items.length === 0) return [];

    const midX = viewport.width / 2;
    const leftItems = items.filter(it => it.transform[4] < midX);
    const rightItems = items.filter(it => it.transform[4] >= midX);

    const leftParas = getBlocksFromItems(leftItems, viewport.height, docxComponents);
    const rightParas = getBlocksFromItems(rightItems, viewport.height, docxComponents);

    return [...leftParas, ...rightParas];
}

function getBlocksFromItems(items, pageHeight, { Paragraph, TextRun }) {
    if (items.length === 0) return [];

    // Noise filtering (Y-axis) - slightly more generous range
    const topLimit = pageHeight * 0.95; 
    const bottomLimit = pageHeight * 0.05;
    
    const filtered = items.filter(it => {
        const y = it.transform[5];
        return y < topLimit && y > bottomLimit && it.str.trim().length > 0;
    });

    if (filtered.length === 0) return [];

    // Grouping by Y-lines
    const lines = [];
    filtered.forEach(it => {
        const y = Math.round(it.transform[5]);
        let line = lines.find(l => Math.abs(l.y - y) < 4);
        if (!line) {
            line = { y: y, items: [] };
            lines.push(line);
        }
        line.items.push({ text: it.str, x: it.transform[4], w: it.width });
    });
    lines.sort((a, b) => b.y - a.y);

    const blocks = [];
    let currentBlock = [];

    // Enhanced heuristic: "1.", "1)", "1-2.", "[1-5]" etc.
    const questionStartRegex = /^([0-9]{1,3}[\.\)]|\[[0-9]{1,3}([-~][0-9]{1,3})?\]|◈|◆|Q\d+)/;

    lines.forEach(line => {
        line.items.sort((a, b) => a.x - b.x);
        const lineText = line.items.map(it => it.text).join(" ").replace(/\s+/g, ' ').trim();
        if (!lineText) return;

        if (questionStartRegex.test(lineText)) {
            if (currentBlock.length > 0) blocks.push(currentBlock);
            currentBlock = [lineText];
        } else {
            if (currentBlock.length > 0) currentBlock.push(lineText);
        }
    });
    if (currentBlock.length > 0) blocks.push(currentBlock);

    const paras = [];
    blocks.forEach(block => {
        block.forEach((line, idx) => {
            paras.push(new Paragraph({
                children: [new TextRun({ 
                    text: line, 
                    font: "Pretendard", 
                    size: 24,
                    bold: idx === 0 
                })],
                spacing: { before: idx === 0 ? 400 : 80, after: 80 }
            }));
        });
    });
    
    return paras;
}

convertBtn.addEventListener('click', async () => {
    if (!currentFile) return;

    // IF ALREADY CONVERTING -> STOP/CANCEL
    if (abortController) {
        abortController.abort();
        statusText.textContent = '변환이 중단되었습니다.';
        convertBtn.textContent = '다시 변환하기 🚀';
        convertBtn.classList.remove('btn-stop');
        progressBar.style.width = '0%';
        abortController = null;
        return;
    }

    const convMode = document.querySelector('input[name="convMode"]:checked').value;
    
    // Start Conversion Flow
    abortController = new AbortController();
    convertBtn.textContent = '중단하기 (취소) ⏹️';
    convertBtn.classList.add('btn-stop');
    convertBtn.disabled = false; // Keep enabled for cancellation
    
    progressContainer.style.display = 'block';
    statusText.textContent = 'PDF 준비 중...';

    try {
        const arrayBuffer = await currentFile.arrayBuffer();
        
        if (typeof pdfjsLib === 'undefined') throw new Error('PDF 라이브러리가 로드되지 않았습니다.');
        const docxLib = window.docx || (typeof docx !== 'undefined' ? docx : null);
        if (!docxLib) throw new Error('Word 라이브러리를 찾을 수 없습니다.');
        const { Document, Packer, Paragraph, TextRun, ColumnBreak } = docxLib.Document ? docxLib : (docxLib.default || docxLib);

        const pdf = await pdfjsLib.getDocument({ data: arrayBuffer, signal: abortController.signal }).promise;
        const totalPages = pdf.numPages;
        const docSections = [];

        if (convMode === 'ocr') {
            statusText.textContent = 'OCR 엔진 초기화 중 (한글/영어)...';
            const worker = await Tesseract.createWorker('kor+eng');
            
            for (let i = 1; i <= totalPages; i++) {
                if (abortController.signal.aborted) throw new Error('CANCELED');
                
                statusText.textContent = `페이지 OCR 분석 중 (${i} / ${totalPages})...`;
                progressBar.style.width = `${(i / totalPages) * 90}%`;

                const page = await pdf.getPage(i);
                const viewport = page.getViewport({ scale: 2.5 });
                const canvas = document.createElement('canvas');
                const context = canvas.getContext('2d');
                canvas.height = viewport.height;
                canvas.width = viewport.width;
                await page.render({ canvasContext: context, viewport: viewport }).promise;
                
                const midX = canvas.width / 2;
                const columns = [
                    { x: 0, y: 0, w: midX, h: canvas.height },
                    { x: midX, y: 0, w: midX, h: canvas.height }
                ];

                const pageParas = [];
                for (const col of columns) {
                    if (abortController.signal.aborted) break;
                    const colCanvas = document.createElement('canvas');
                    colCanvas.width = col.w;
                    colCanvas.height = col.h;
                    const colCtx = colCanvas.getContext('2d');
                    colCtx.drawImage(canvas, col.x, col.y, col.w, col.h, 0, 0, col.w, col.h);
                    
                    const { data: { text } } = await worker.recognize(colCanvas);
                    const cleaned = reconstructParagraphs(text);
                    cleaned.forEach(p => {
                        pageParas.push(new Paragraph({
                            children: [new TextRun({ text: p, font: "Pretendard" })],
                            spacing: { before: 200, after: 200 }
                        }));
                    });
                }
                docSections.push({ 
                    properties: { page: { margin: NARROW_MARGINS } },
                    children: pageParas 
                });
            }
            await worker.terminate();

        } else if (convMode === 'smart') {
            let totalQuestions = 0;
            for (let i = 1; i <= totalPages; i++) {
                if (abortController.signal.aborted) throw new Error('CANCELED');
                statusText.textContent = `스마트 문제 추출 중 (${i} / ${totalPages})...`;
                progressBar.style.width = `${(i / totalPages) * 90}%`;
                const page = await pdf.getPage(i);
                const paras = await extractQuestionBlocks(page, { Paragraph, TextRun });
                if (paras.length > 0) {
                    totalQuestions += (paras.length / 2); // Roughly
                    docSections.push({ 
                        properties: { page: { margin: NARROW_MARGINS } },
                        children: paras 
                    });
                }
            }
            if (docSections.length === 0) {
                throw new Error('텍스트를 찾을 수 없습니다. 이미지가 포함된 PDF라면 [OCR] 모드를 사용해 보세요.');
            }
        }

        if (abortController.signal.aborted) throw new Error('CANCELED');

        const doc = new Document({ sections: docSections });
        const blob = await Packer.toBlob(doc);
        const suffixMap = { ocr: "_OCR.docx", smart: "_SmartExam.docx" };
        saveAs(blob, currentFile.name.replace('.pdf', '') + (suffixMap[convMode] || ".docx"));

        progressBar.style.width = '100%';
        statusText.textContent = '변환 완료!';
        convertBtn.textContent = '다시 변환하기';
        convertBtn.classList.remove('btn-stop');
    } catch (error) {
        if (error.message === 'CANCELED' || (error.name === 'AbortError')) {
            console.log('Conversion Aborted');
        } else {
            console.error(error);
            statusText.textContent = `오류: ${error.message}`;
            convertBtn.textContent = '다시 시도 🚀';
            convertBtn.classList.remove('btn-stop');
        }
    } finally {
        abortController = null;
    }
});
