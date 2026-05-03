// converter.js using pdf.js and docx.js
import { authService } from './src/services/apiService.js';
import { reconstructParagraphs, processItemsToParagraphs, getBlocksFromItems, extractQuestionBlocks } from './src/utils/pdfExtractor.js';

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
    const { data: { session } } = await authService.getSession();
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
        const { Document, Packer, Paragraph, TextRun, ColumnBreak, PageBreak } = docxLib.Document ? docxLib : (docxLib.default || docxLib);

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
                
                // Get midX using the same Peak Alignment logic
                const content = await page.getTextContent();
                const items = content.items;
                const viewport = page.getViewport({ scale: 1 }); // Use a base scale for text content analysis
                let midX = viewport.width / 2;
                if (items.length > 0) {
                    const xFreq = {};
                    items.forEach(it => {
                        const x = Math.round(it.transform[4] / 10) * 10;
                        if (x < viewport.width * 0.1 || x > viewport.width * 0.9) return;
                        xFreq[x] = (xFreq[x] || 0) + 1;
                    });
                    const sortedX = Object.keys(xFreq).sort((a, b) => xFreq[b] - xFreq[a]);
                    let pL = -1, pR = -1;
                    for (const xStr of sortedX) {
                        const x = parseInt(xStr);
                        if (pL === -1) pL = x;
                        else if (Math.abs(x - pL) > viewport.width * 0.2) { pR = x; break; }
                    }
                    if (pL !== -1 && pR !== -1) midX = (pL + pR) / 2;
                }

                const canvasScale = 2.0; 
                const canvasViewport = page.getViewport({ scale: canvasScale });
                const canvas = document.createElement('canvas');
                const context = canvas.getContext('2d');
                canvas.height = canvasViewport.height;
                canvas.width = canvasViewport.width;

                await page.render({ canvasContext: context, viewport: canvasViewport }).promise;

                const splitFactor = midX / viewport.width;
                const splitX = canvas.width * splitFactor;

                const columns = [
                    { x: 0, y: 0, w: splitX, h: canvas.height },
                    { x: splitX, y: 0, w: canvas.width - splitX, h: canvas.height }
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
                    // Add PageBreak between columns in OCR mode too
                    if (columns.indexOf(col) === 0) {
                        pageParas.push(new Paragraph({ children: [new PageBreak()] }));
                    }
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
                const paras = await extractQuestionBlocks(page, { Paragraph, TextRun, PageBreak });
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
