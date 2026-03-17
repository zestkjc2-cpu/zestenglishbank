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

convertBtn.addEventListener('click', async () => {
    if (!currentFile) return;

    const convMode = document.querySelector('input[name="convMode"]:checked').value;
    convertBtn.disabled = true;
    convertBtn.textContent = '변환 중...';
    progressContainer.style.display = 'block';
    statusText.textContent = 'PDF 준비 중...';

    try {
        const arrayBuffer = await currentFile.arrayBuffer();
        
        if (typeof pdfjsLib === 'undefined') {
            throw new Error('PDF 라이브러리가 로드되지 않았습니다.');
        }

        const docxLib = window.docx || (typeof docx !== 'undefined' ? docx : null);
        if (!docxLib) throw new Error('Word 라이브러리를 찾을 수 없습니다.');
        const { Document, Packer, Paragraph, TextRun } = docxLib.Document ? docxLib : (docxLib.default || docxLib);

        const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
        const totalPages = pdf.numPages;
        const docSections = [];

        if (convMode === 'ocr') {
            statusText.textContent = 'OCR 엔진 초기화 중 (한글/영어)...';
            const worker = await Tesseract.createWorker('kor+eng');
            
            for (let i = 1; i <= totalPages; i++) {
                statusText.textContent = `페이지 OCR 분석 중 (${i} / ${totalPages})...`;
                progressBar.style.width = `${(i / totalPages) * 90}%`;

                const page = await pdf.getPage(i);
                const viewport = page.getViewport({ scale: 2.5 }); // High DPI for OCR
                const canvas = document.createElement('canvas');
                const context = canvas.getContext('2d');
                canvas.height = viewport.height;
                canvas.width = viewport.width;

                await page.render({ canvasContext: context, viewport: viewport }).promise;
                
                const { data: { text } } = await worker.recognize(canvas);
                const cleanedParas = reconstructParagraphs(text);

                docSections.push({
                    children: cleanedParas.map(para => new Paragraph({
                        children: [new TextRun({ text: para, font: "Pretendard" })],
                        spacing: { before: 200, after: 200 }
                    }))
                });
            }
            await worker.terminate();
        } else {
            // Layout Mode
            for (let i = 1; i <= totalPages; i++) {
                statusText.textContent = `페이지 레이아웃 분석 중 (${i} / ${totalPages})...`;
                progressBar.style.width = `${(i / totalPages) * 90}%`;

                const page = await pdf.getPage(i);
                const textContent = await page.getTextContent();
                
                const lines = [];
                textContent.items.forEach(item => {
                    const y = Math.round(item.transform[5]);
                    const fontSize = Math.abs(item.transform[0]); 
                    const x = item.transform[4];
                    let line = lines.find(l => Math.abs(l.y - y) < 4);
                    if (!line) {
                        line = { y: y, items: [] };
                        lines.push(line);
                    }
                    line.items.push({ text: item.str, x: x, width: item.width, fontSize: fontSize });
                });

                lines.sort((a, b) => b.y - a.y);
                const pageParagraphs = lines.map(line => {
                    line.items.sort((a, b) => a.x - b.x);
                    const children = [];
                    let currentText = "";
                    let lastX = -1;
                    let lastFS = 10;

                    line.items.forEach(it => {
                        const gap = lastX !== -1 ? (it.x - lastX) : 0;
                        if (gap > 60) {
                            if (currentText) children.push(new TextRun({ text: currentText.trim() + "   ", size: Math.round(lastFS * 2), font: "Pretendard" }));
                            currentText = it.text;
                        } else if (gap > 2) {
                            currentText += " " + it.text;
                        } else {
                            currentText += it.text;
                        }
                        lastX = it.x + it.width;
                        lastFS = it.fontSize;
                    });
                    if (currentText) children.push(new TextRun({ text: currentText.trim(), size: Math.round(lastFS * 2), font: "Pretendard" }));
                    return new Paragraph({ children: children, spacing: { before: 80, after: 80 } });
                });
                docSections.push({ children: pageParagraphs });
            }
        }

        const doc = new Document({ sections: docSections });
        const blob = await Packer.toBlob(doc);
        saveAs(blob, currentFile.name.replace('.pdf', '') + (convMode === 'ocr' ? "_OCR_Text.docx" : "_Layout.docx"));

        progressBar.style.width = '100%';
        statusText.textContent = '변환 완료!';
        convertBtn.textContent = '다시 변환하기';
        convertBtn.disabled = false;
    } catch (error) {
        console.error(error);
        statusText.textContent = `오류: ${error.message}`;
        convertBtn.disabled = false;
        convertBtn.textContent = '다시 시도 🚀';
    }
});
